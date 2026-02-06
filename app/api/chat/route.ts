import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAIResponse, type AISettings } from "@/lib/ai";
import type { Database } from "@/types/database";
import type { SkillContext } from "@/src/lib/skills";

// Initialize Supabase with service role key for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatRequest {
  conversationId?: string;
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  visitorInfo?: {
    name?: string;
    email?: string;
    location?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { conversationId, message, conversationHistory: providedHistory } = body;

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Fetch AI settings from Supabase
    const { data: settingsData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "ai_agent")
      .single();

    const aiSettingsRaw = (settingsData?.value as Record<string, unknown>) || {};
    const aiSettings: AISettings = {
      name: (aiSettingsRaw.name as string) || "MACt Assistant",
      personality: (aiSettingsRaw.personality as AISettings["personality"]) || "professional",
      responseLength: (aiSettingsRaw.responseLength as number) || 50,
      fallbackAction: (aiSettingsRaw.fallbackAction as AISettings["fallbackAction"]) || "clarify",
    };

    // Use provided conversation history or fetch from database
    let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    let skillContext: SkillContext = {};

    if (providedHistory && providedHistory.length > 0) {
      // Use provided history (for test chat)
      conversationHistory = providedHistory;
      // Use visitor info from request for test chat
      if (body.visitorInfo) {
        skillContext = {
          visitorEmail: body.visitorInfo.email,
          visitorName: body.visitorInfo.name,
        };
      }
    } else if (conversationId) {
      // Fetch conversation details including visitor info
      const { data: conversationData } = await supabase
        .from("conversations")
        .select("id, visitor_id, visitors(id, name, email)")
        .eq("id", conversationId)
        .single();

      // Build skill context from conversation data
      if (conversationData) {
        const visitor = conversationData.visitors as { id: string; name?: string; email?: string } | null;
        skillContext = {
          conversationId,
          visitorId: conversationData.visitor_id || undefined,
          visitorEmail: visitor?.email,
          visitorName: visitor?.name,
        };
      }

      // Fetch recent conversation history (last 10 messages)
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10);

      conversationHistory = (messagesData || []).map((msg) => ({
        role: msg.sender_type === "visitor" ? "user" as const : "assistant" as const,
        content: msg.content,
      }));
    }

    // Fetch knowledge base content (ready documents only)
    const { data: knowledgeData } = await supabase
      .from("knowledge_base")
      .select("content, filename")
      .eq("status", "ready")
      .limit(5);

    // Build knowledge content string
    let knowledgeContent: string | undefined;
    if (knowledgeData && knowledgeData.length > 0) {
      const docs = knowledgeData
        .filter((doc) => doc.content)
        .map((doc) => `### ${doc.filename}\n${doc.content}`);
      if (docs.length > 0) {
        knowledgeContent = docs.join("\n\n");
      }
    }

    // Generate AI response using the abstraction
    // Skills are enabled by default for OpenAI provider
    const aiResponse = await generateAIResponse(
      conversationHistory,
      message,
      aiSettings,
      knowledgeContent,
      undefined, // llmSettings - use defaults
      skillContext
    );

    // Save AI response to messages table (only if we have a conversationId)
    let savedMessage = null;
    if (conversationId) {
      const { data, error: saveError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "ai",
          sender_name: aiSettings.name || "MACt Assistant",
          content: aiResponse.content,
        })
        .select()
        .single();

      if (saveError) {
        console.error("Failed to save AI message:", saveError);
        // Still return the response even if saving fails
      } else {
        savedMessage = data;
      }

      // Update conversation's updated_at timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    return NextResponse.json({
      success: true,
      message: savedMessage || {
        content: aiResponse.content,
        sender_type: "ai",
        sender_name: aiSettings.name,
      },
      response: aiResponse.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      skillExecutions: aiResponse.skillExecutions,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return NextResponse.json(
          { error: "AI service is busy. Please try again in a moment." },
          { status: 429 }
        );
      }
      if (error.message.includes("authentication") || error.message.includes("401") || error.message.includes("API key")) {
        return NextResponse.json(
          { error: "AI service authentication failed. Please check configuration." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate AI response. Please try again." },
      { status: 500 }
    );
  }
}
