import { createClient } from "@supabase/supabase-js";
import { chat, type LLMConfig } from "@/lib/llm/index";
import { processCampaignBatch } from "@/lib/outreach/send";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export interface ChatContext {
  products_mentioned: string[];
  intent_level: "high" | "medium" | "low";
  summary: string;
}

interface ChatMessage {
  sender_type: string;
  content: string;
}

/**
 * Uses GPT-4.1 Nano to analyze a chat conversation and extract product intent.
 * Returns product mentions, intent level, and a brief summary.
 * Cost: ~$0.0002 per conversation.
 */
export async function extractChatContext(
  messages: ChatMessage[]
): Promise<ChatContext> {
  // Filter to visitor and AI messages only (skip system messages)
  const relevantMessages = messages
    .filter((m) => m.sender_type === "visitor" || m.sender_type === "ai")
    .map((m) => `${m.sender_type === "visitor" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const config: LLMConfig = {
    provider: "openai",
    model: "gpt-4.1-nano",
    temperature: 0.1,
    maxTokens: 300,
  };

  const systemPrompt = `You analyze customer chat conversations to determine purchase intent and extract product mentions.

Respond ONLY with valid JSON in this exact format:
{
  "products_mentioned": ["Product Name 1", "Product Name 2"],
  "intent_level": "high" | "medium" | "low",
  "summary": "Brief 1-sentence summary of what the customer asked about"
}

Intent scoring:
- HIGH: pricing questions, "how much", "buy", "order", "purchase", availability, stock, delivery
- MEDIUM: features, specs, comparisons, "what is", "which is better", "tell me about"
- LOW: greetings only, support/complaints, unrelated questions

Rules:
- Extract actual product names mentioned (MACt Rock Carve, MACt Saw, etc.)
- If no specific product is mentioned but they ask about "your products" or categories, use the category name
- Keep summary customer-focused and conversational
- Always return valid JSON, nothing else`;

  try {
    const response = await chat(config, systemPrompt, [
      { role: "user", content: relevantMessages },
    ]);

    const parsed = JSON.parse(response.content);
    return {
      products_mentioned: parsed.products_mentioned || [],
      intent_level: parsed.intent_level || "low",
      summary: parsed.summary || "",
    };
  } catch (error) {
    console.error("[Chat Followup] Failed to extract context:", error);
    return {
      products_mentioned: [],
      intent_level: "low",
      summary: "",
    };
  }
}

/**
 * Resolves product names to real WooCommerce URLs by fuzzy matching against woo_products.
 * Returns the best matching product URL, or the shop page as fallback.
 */
export async function resolveProductUrl(
  productNames: string[]
): Promise<{ url: string; matchedProduct: string | null }> {
  if (productNames.length === 0) {
    return { url: "https://mact.au/shop/", matchedProduct: null };
  }

  const supabase = getSupabase();

  // Try each product name until we find a match
  for (const name of productNames) {
    // Search by name (case-insensitive partial match)
    const { data: products } = await supabase
      .from("woo_products")
      .select("name, slug, permalink")
      .ilike("name", `%${name}%`)
      .limit(1);

    if (products && products.length > 0) {
      const product = products[0];
      const url =
        product.permalink ||
        `https://mact.au/product/${product.slug}/`;
      return { url, matchedProduct: product.name };
    }
  }

  // Fallback: shop page
  return { url: "https://mact.au/shop/", matchedProduct: null };
}

/**
 * Creates a single-recipient outreach campaign for a chat follow-up
 * and immediately starts sending it.
 *
 * Requires a template named containing "chat-followup" (case-insensitive)
 * to exist in the outreach_templates table.
 */
export async function createChatFollowUpCampaign(
  conversationId: string,
  email: string,
  visitorName: string,
  context: ChatContext,
  productUrl: string,
  matchedProduct: string | null
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  const supabase = getSupabase();

  // Find the chat follow-up template
  const { data: templates } = await supabase
    .from("outreach_templates")
    .select("id, name, subject, body")
    .ilike("name", "%chat-followup%")
    .limit(1);

  if (!templates || templates.length === 0) {
    return {
      success: false,
      error: "No chat-followup template found. Create a template with 'chat-followup' in the name.",
    };
  }

  const template = templates[0];

  // Build campaign name: YYMMDD_chat-followup-{email-prefix}_behavioral
  const now = new Date();
  const datePrefix = now
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, "")
    .slice(0, 6);
  const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
  const campaignName = `${datePrefix}_chat-followup-${emailPrefix}_behavioral`;

  // Build personalization data
  const nameParts = (visitorName || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const productMentioned =
    matchedProduct || context.products_mentioned[0] || "";

  const personalization = {
    first_name: firstName,
    last_name: lastName,
    company: "",
    last_product: "",
    last_order_date: "",
    days_since_order: null,
    total_spent: 0,
    order_count: 0,
    product_mentioned: productMentioned,
    chat_summary: context.summary,
    discount_code: "CHAT10",
    product_url: productUrl,
  };

  // Create campaign
  const { data: campaign, error: createError } = await supabase
    .from("outreach_campaigns")
    .insert({
      name: campaignName,
      template_id: template.id,
      segment: "custom",
      segment_filter: { emails: [email] },
      status: "sending",
      started_at: now.toISOString(),
      total_recipients: 1,
      is_dry_run: false,
      auto_resend_enabled: false,
    })
    .select("id")
    .single();

  if (createError || !campaign) {
    console.error("[Chat Followup] Failed to create campaign:", createError);
    return {
      success: false,
      error: createError?.message || "Failed to create campaign",
    };
  }

  // Create the single email record
  const { error: emailError } = await supabase
    .from("outreach_emails")
    .insert({
      campaign_id: campaign.id,
      recipient_email: email.toLowerCase(),
      recipient_name: visitorName || firstName || email.split("@")[0],
      personalization,
      status: "pending",
    });

  if (emailError) {
    console.error("[Chat Followup] Failed to create email record:", emailError);
    return {
      success: false,
      error: emailError.message,
    };
  }

  // Send immediately
  try {
    const result = await processCampaignBatch(campaign.id, 1);
    console.log(
      `[Chat Followup] Sent follow-up to ${email} for conversation ${conversationId}: processed=${result.processed}`
    );
    return { success: true, campaignId: campaign.id };
  } catch (sendError) {
    console.error("[Chat Followup] Failed to send:", sendError);
    return {
      success: false,
      campaignId: campaign.id,
      error: sendError instanceof Error ? sendError.message : "Send failed",
    };
  }
}
