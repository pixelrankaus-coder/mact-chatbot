import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAIResponse, calculateTokenCost } from "@/lib/ai";
import {
  detectOrderIntent,
  lookupOrderByNumber,
  lookupOrdersByEmail,
  formatOrderForChat,
  formatOrdersListForChat,
} from "@/lib/woocommerce";
import {
  detectCin7OrderIntent,
  searchSales,
  getSale,
  formatSaleForChat,
  formatSaleListItemForChat,
  formatSalesListForChat,
} from "@/lib/cin7";
import { sendNewConversationEmail } from "@/lib/email";

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
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
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

      // Detect order intent and look up order if needed
      // Try Cin7 first (primary source of truth), then fallback to WooCommerce
      const cin7Intent = detectCin7OrderIntent(content.trim());
      const wooIntent = detectOrderIntent(content.trim());
      let orderContext = "";

      if (cin7Intent.hasOrderIntent || wooIntent.hasOrderIntent) {
        // Try Cin7 lookup first (primary system)
        if (cin7Intent.orderNumber) {
          const cin7Result = await searchSales({ search: cin7Intent.orderNumber, limit: 1 });
          if (cin7Result.SaleList && cin7Result.SaleList.length > 0) {
            const saleListItem = cin7Result.SaleList[0];
            // Try to fetch full sale details for richer information (line items, shipping)
            const fullSale = await getSale(saleListItem.SaleID);
            if (fullSale) {
              orderContext = `\n\n## Order Information Found (Cin7)\nThe customer asked about their order. Here is the order data:\n${formatSaleForChat(fullSale)}\n\nPlease share this information with the customer in a friendly way.`;
            } else {
              // Fall back to list item data if full details can't be fetched
              orderContext = `\n\n## Order Information Found (Cin7)\nThe customer asked about their order. Here is the order data:\n${formatSaleListItemForChat(saleListItem)}\n\nPlease share this information with the customer in a friendly way.`;
            }
          } else {
            // Cin7 didn't find it, try WooCommerce as fallback
            if (wooIntent.orderNumber) {
              const orderResult = await lookupOrderByNumber(wooIntent.orderNumber);
              if (orderResult.success && orderResult.order) {
                orderContext = `\n\n## Order Information Found (WooCommerce)\nThe customer asked about their order. Here is the order data:\n${formatOrderForChat(orderResult.order)}\n\nPlease share this information with the customer in a friendly way.`;
              } else {
                orderContext = `\n\n## Order Lookup Result\nThe customer provided order number "${cin7Intent.orderNumber}" but no matching order was found in our system. Let them know and offer to help them find their order another way (perhaps using their email).`;
              }
            } else {
              orderContext = `\n\n## Order Lookup Result\nThe customer provided order number "${cin7Intent.orderNumber}" but no matching order was found. Ask them to verify the order number format (e.g., SO-12345) or provide their email address.`;
            }
          }
        }
        // Try email lookup if no order number
        else if (cin7Intent.email || wooIntent.email) {
          const email = cin7Intent.email || wooIntent.email;
          // Try WooCommerce for email lookup (Cin7 requires customer ID for email search)
          const ordersResult = await lookupOrdersByEmail(email!);
          if (ordersResult.success && ordersResult.orders && ordersResult.orders.length > 0) {
            orderContext = `\n\n## Orders Found for Email\nThe customer provided their email. Here are their orders:\n${formatOrdersListForChat(ordersResult.orders)}\n\nPlease share this information with the customer.`;
          } else {
            orderContext = `\n\n## Order Lookup Result\nNo orders were found for the email "${email}". Ask the customer to verify their email or provide an order number.`;
          }
        }
        // No order number or email provided
        else {
          orderContext = `\n\n## Order Inquiry Detected\nThe customer appears to be asking about an order but hasn't provided an order number or email. Please ask them to provide their order number (format: SO-XXXXX for Cin7, or #12345 for web orders) or the email address they used when placing the order.`;
        }
      }

      // Append order context to knowledge content
      if (orderContext) {
        knowledgeContent = knowledgeContent + orderContext;
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
        console.error("AI response error:", aiError);
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
      }
    }

    return NextResponse.json(
      {
        userMessage,
        botMessage,
        aiEnabled,
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
