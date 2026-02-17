import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAIResponse, calculateTokenCost } from "@/lib/ai";
import { detectOrderIntent } from "@/lib/woocommerce";
import { detectCin7OrderIntent } from "@/lib/cin7";
import {
  lookupOrderByNumber,
  lookupCustomerByEmail,
  formatOrderForChat,
  formatCustomerForChat,
} from "@/lib/chatbot-lookup";
import { sendNewConversationEmail } from "@/lib/email";
import { logInfo, logError } from "@/lib/logger";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// GET /api/widget/conversations/[id]/messages - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since"); // For polling - get messages after this timestamp

    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (since) {
      query = query.gt("created_at", since);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    return NextResponse.json({ messages }, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/widget/conversations/[id]/messages - Send a message and get AI response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();

  try {
    const { id } = await params;
    const body = await request.json();
    const { content, visitorId } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify the conversation exists and belongs to the visitor
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Optionally verify visitor ownership
    if (visitorId && conversation.visitor_id !== visitorId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Insert user message
    const { data: userMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_type: "visitor",
        sender_name: conversation.visitor_name || "Visitor",
        content: content.trim(),
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Auto-detect email in visitor message and save to conversation
    if (!conversation.visitor_email) {
      const emailMatch = content.trim().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        const detectedEmail = emailMatch[0].toLowerCase();
        await supabase
          .from("conversations")
          .update({
            visitor_email: detectedEmail,
            metadata: {
              ...(conversation.metadata as Record<string, unknown> || {}),
              emailCapturedAt: new Date().toISOString(),
              emailCaptureMethod: "auto-detected",
            },
          })
          .eq("id", id);
      }
    }

    // Check if this is the first visitor message (for email notification)
    const { count: visitorMsgCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", id)
      .eq("sender_type", "visitor");

    const isFirstVisitorMessage = visitorMsgCount === 1;

    // Send email notification for first visitor message
    if (isFirstVisitorMessage) {
      // Get visitor location from conversation metadata
      const visitorLocation = conversation.visitor_location ||
        conversation.metadata?.location ||
        null;

      // Send notification email (non-blocking)
      sendNewConversationEmail({
        visitorName: conversation.visitor_name,
        visitorEmail: conversation.visitor_email,
        visitorLocation: visitorLocation,
        firstMessage: content.trim(),
        conversationId: id,
      }).catch((err) => console.error("Failed to send notification email:", err));
    }

    // Update conversation timestamp
    // If conversation is resolved and visitor sends a message, re-activate it
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };

    // Re-activate resolved conversations when visitor sends a message
    if (conversation.status === "resolved") {
      updateData.status = "active";
      updateData.resolved_at = null;
      console.log(`[Auto-resolve] Re-activating resolved conversation ${id} due to visitor message`);
    }

    await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", id);

    // Check if AI agent is enabled
    const { data: aiSettings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "ai_agent")
      .single();

    const aiEnabled = aiSettings?.value?.enabled !== false;

    let botMessage = null;

    if (aiEnabled) {
      // Get conversation history for context
      const { data: history } = await supabase
        .from("messages")
        .select("sender_type, content")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(20);

      const conversationHistory = (history || [])
        .filter((m) => m.sender_type !== "system")
        .map((m) => ({
          role: m.sender_type === "visitor" ? "user" : "assistant" as "user" | "assistant",
          content: m.content,
        }));

      // Get knowledge base content
      const { data: knowledgeDocs } = await supabase
        .from("knowledge_base")
        .select("content")
        .eq("status", "ready")
        .limit(5);

      let knowledgeContent = knowledgeDocs
        ?.map((doc) => doc.content)
        .filter(Boolean)
        .join("\n\n---\n\n") || "";

      // Detect order intent and look up order from Supabase cache
      // Uses local cache for fast lookups (~200ms) instead of Cin7 API (3-5s)
      const cin7Intent = detectCin7OrderIntent(content.trim());
      const wooIntent = detectOrderIntent(content.trim());
      let orderContext = "";

      if (cin7Intent.hasOrderIntent || wooIntent.hasOrderIntent) {
        // Look up by order number from Supabase cache
        const orderNumber = cin7Intent.orderNumber || wooIntent.orderNumber;
        if (orderNumber) {
          const orderResult = await lookupOrderByNumber(orderNumber);
          if (orderResult.found && orderResult.order) {
            const formattedOrder = formatOrderForChat(orderResult);
            orderContext = `\n\n## Order Information Found\nThe customer asked about their order. Here is the order data from our system:\n${formattedOrder}\n\nPlease share this information with the customer in a friendly way. IMPORTANT: If there is a tracking number, make sure to prominently mention it.`;
          } else {
            orderContext = `\n\n## Order Lookup Result\nThe customer provided order number "${orderNumber}" but no matching order was found in our system. Let them know and offer to help them find their order another way (perhaps using their email address).`;
          }
        }
        // Try email lookup from Supabase cache if no order number
        else if (cin7Intent.email || wooIntent.email) {
          const email = cin7Intent.email || wooIntent.email;
          const customerResult = await lookupCustomerByEmail(email!);
          if (customerResult.found) {
            const formattedCustomer = formatCustomerForChat(customerResult);
            orderContext = `\n\n## Customer Orders Found\nThe customer provided their email. Here is their order history:\n${formattedCustomer}\n\nPlease share this information with the customer. If they're looking for a specific order, ask for the order number.`;
          } else {
            orderContext = `\n\n## Order Lookup Result\nNo orders were found for the email "${email}". Ask the customer to verify their email or provide an order number.`;
          }
        }
        // No order number or email provided
        else {
          orderContext = `\n\n## Order Inquiry Detected\nThe customer appears to be asking about an order but hasn't provided an order number or email. Please ask them to provide their order number (format: SO-XXXXX) or the email address they used when placing the order.`;
        }
      }

      // Append order context to knowledge content
      if (orderContext) {
        knowledgeContent = knowledgeContent + orderContext;
      }

      // Tell the AI what visitor info has already been collected
      const knownEmail = conversation.visitor_email ||
        content.trim().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
      const knownName = conversation.visitor_name && conversation.visitor_name !== "Website Visitor"
        ? conversation.visitor_name : null;

      if (knownEmail || knownName) {
        const parts = [];
        if (knownName) parts.push(`name: ${knownName}`);
        if (knownEmail) parts.push(`email: ${knownEmail}`);
        knowledgeContent += `\n\n## Visitor info already collected\nYou already have this visitor's ${parts.join(" and ")}. Do NOT ask for this information again.`;
      } else if (!isFirstVisitorMessage) {
        knowledgeContent += `\n\n## Visitor info\nYou have already greeted this visitor. If you asked for their name/email and they didn't provide it, do NOT ask again. Just help them.`;
      }

      // Get LLM provider settings
      const { data: llmSettings } = await supabase
        .from("llm_settings")
        .select("*")
        .eq("store_id", "default")
        .single();

      // Generate AI response
      try {
        const aiResponse = await generateAIResponse(
          conversationHistory.slice(0, -1), // Exclude the message we just added
          content.trim(),
          {
            name: aiSettings?.value?.name || "MACt Assistant",
            personality: aiSettings?.value?.personality || "professional",
            responseLength: aiSettings?.value?.responseLength || 50,
            fallbackAction: aiSettings?.value?.fallbackAction || "clarify",
          },
          knowledgeContent,
          llmSettings ? {
            provider: llmSettings.provider,
            model: llmSettings.model,
            temperature: llmSettings.temperature,
            maxTokens: llmSettings.max_tokens,
          } : undefined
        );

        // Insert bot response
        const { data: botMsg, error: botError } = await supabase
          .from("messages")
          .insert({
            conversation_id: id,
            sender_type: "ai",
            sender_name: aiSettings?.value?.name || "MACt Assistant",
            content: aiResponse.content,
          })
          .select()
          .single();

        if (!botError) {
          botMessage = botMsg;

          logInfo("ai", `Widget chat: AI responded using ${aiResponse.model} (${aiResponse.usage?.totalTokens || 0} tokens)`, {
            path: `/api/widget/conversations/${id}/messages`,
            method: "POST",
            status_code: 201,
            metadata: {
              model: aiResponse.model,
              tokens: aiResponse.usage?.totalTokens,
              conversationId: id,
            },
          });

          // Log token usage if available
          if (aiResponse.usage) {
            const cost = calculateTokenCost(
              aiResponse.model,
              aiResponse.usage.promptTokens,
              aiResponse.usage.completionTokens
            );

            await supabase.from("token_usage").insert({
              conversation_id: id,
              message_id: botMsg.id,
              model: aiResponse.model,
              prompt_tokens: aiResponse.usage.promptTokens,
              completion_tokens: aiResponse.usage.completionTokens,
              total_tokens: aiResponse.usage.totalTokens,
              cost_usd: cost,
            });
          }
        }
      } catch (aiError) {
        const errMsg = aiError instanceof Error ? `${aiError.message} | ${aiError.stack?.split('\n')[1]?.trim() || ''}` : String(aiError);
        console.error("AI response error:", errMsg, aiError);

        logError("ai", `Widget chat AI failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`, {
          path: `/api/widget/conversations/${id}/messages`,
          method: "POST",
          status_code: 500,
          metadata: { conversationId: id, error: errMsg },
        });

        // Insert fallback message
        const { data: fallbackMsg } = await supabase
          .from("messages")
          .insert({
            conversation_id: id,
            sender_type: "ai",
            sender_name: aiSettings?.value?.name || "MACt Assistant",
            content: "I apologize, but I'm having trouble responding right now. Please try again in a moment, or a team member will assist you shortly.",
          })
          .select()
          .single();

        botMessage = fallbackMsg;
        // Attach debug error to response (temporary for debugging)
        (botMessage as Record<string, unknown>)._aiError = errMsg;
      }
    }

    return NextResponse.json(
      {
        userMessage,
        botMessage,
        aiEnabled,
        _debug: botMessage?.content?.includes("trouble responding") ? {
          error: "AI generation failed - check Vercel function logs",
        } : undefined,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
