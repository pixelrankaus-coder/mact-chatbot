import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/widget/settings - Public endpoint for widget to fetch appearance settings
export async function GET() {
  const supabase = getSupabase();

  try {
    // Fetch appearance settings
    const { data: appearance, error: appearanceError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "appearance")
      .single();

    if (appearanceError && appearanceError.code !== "PGRST116") {
      throw appearanceError;
    }

    // Fetch AI agent settings
    const { data: aiAgent, error: aiAgentError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "ai_agent")
      .single();

    if (aiAgentError && aiAgentError.code !== "PGRST116") {
      throw aiAgentError;
    }

    // Fetch operating hours
    const { data: operatingHours, error: hoursError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "operating_hours")
      .single();

    if (hoursError && hoursError.code !== "PGRST116") {
      throw hoursError;
    }

    // Default values
    const defaultAppearance = {
      primaryColor: "#2563eb",
      position: "bottom-right",
      welcomeMessage: "Hi there! How can I help you today?",
      offlineMessage: "We're currently offline. Leave a message and we'll get back to you.",
      avatarUrl: null,
      companyName: "MACt Support",
      // Visibility and position settings
      desktop: {
        display: true,
        position: "right",
        buttonType: "corner",
      },
      mobile: {
        display: true,
        position: "right",
        buttonType: "corner",
      },
      offsetX: 20,
      offsetY: 80,
      zIndex: 999999,
      // Bubble settings
      bubbleSize: "medium", // small: 50px, medium: 60px, large: 70px
      bubbleIconColor: "#ffffff",
      showBubbleText: false,
      // Chat window settings
      chatWindowHeight: "medium", // small: 450px, medium: 550px, large: 650px
      // Bubble text settings
      bubbleTextSize: "medium", // small: 12px, medium: 14px, large: 16px
      bubbleTextAlign: "left", // left, center, right
      bubblePadding: "normal", // compact: 2px 6px, normal: 4px 8px, spacious: 6px 12px
      // Advanced
      showWhenOffline: true,
      enableSounds: false,
    };

    const defaultAiAgent = {
      enabled: true,
      name: "MACt Assistant",
      welcomeMessage: "Hi there! I'm the MACt Assistant. How can I help you with your GFRC project today?",
      personality: "professional",
    };

    // Default pre-chat form settings (enabled by default for Tidio-style email capture)
    const defaultPreChatForm = {
      enabled: true,
      collectNewsletter: true,
      fields: {
        name: "required",
        email: "required",
        phone: "optional",
      },
    };

    // Default chat triggers (proactive engagement)
    const defaultTriggers = {
      enabled: false,
      timeDelay: { enabled: false, seconds: 10 },
      scrollDepth: { enabled: false, percentage: 50 },
      exitIntent: { enabled: false, message: "Wait! Have a question before you go?" },
      oncePerSession: true,
    };

    const settings = {
      appearance: appearance?.value || defaultAppearance,
      aiAgent: aiAgent?.value || defaultAiAgent,
      operatingHours: operatingHours?.value || null,
      preChatForm: aiAgent?.value?.preChatForm || defaultPreChatForm,
      triggers: aiAgent?.value?.triggers || defaultTriggers,
    };

    // Add CORS headers for cross-origin widget requests
    return NextResponse.json(settings, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Failed to fetch widget settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
