import { chat, type LLMConfig, type LLMProvider, type SkillExecution, PRICING } from "./llm";
import type { SkillContext } from "@/src/lib/skills";

// Types for AI provider abstraction
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AISettings {
  name?: string;
  personality?: "professional" | "friendly" | "casual";
  responseLength?: number; // 0-100 scale
  fallbackAction?: "clarify" | "transfer" | "email";
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  skillExecutions?: SkillExecution[];
}

// Re-export LLMProvider type
export type AIProvider = LLMProvider;

// Calculate cost in USD based on token usage and model
export function calculateTokenCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  provider: LLMProvider = "openai"
): number {
  const providerPricing = PRICING[provider];
  const modelPricing = providerPricing?.[model] || providerPricing?.[Object.keys(providerPricing || {})[0]];

  if (!modelPricing) {
    // Fallback to OpenAI gpt-4o-mini pricing
    const fallback = PRICING.openai["gpt-4o-mini"];
    const inputCost = (promptTokens / 1_000_000) * fallback.input;
    const outputCost = (completionTokens / 1_000_000) * fallback.output;
    return inputCost + outputCost;
  }

  const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
  const outputCost = (completionTokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}

// Build system prompt based on AI settings and knowledge base
export function buildSystemPrompt(
  aiSettings: AISettings,
  knowledgeContent?: string
): string {
  const name = aiSettings.name || "MACt Assistant";
  const personality = aiSettings.personality || "professional";
  const responseLength = aiSettings.responseLength ?? 50;
  const fallbackAction = aiSettings.fallbackAction || "clarify";

  const personalityInstructions: Record<string, string> = {
    professional: "Be professional but human. Talk like a knowledgeable colleague, not a corporate FAQ page. Be direct and helpful without being stiff.",
    friendly: "Be warm and approachable, like chatting with a helpful friend who knows their stuff. Use a conversational tone and show genuine interest in helping.",
    casual: "Be relaxed and natural, like texting a mate who happens to be an expert. Keep it easygoing while still being helpful.",
  };

  const lengthInstructions =
    responseLength < 33
      ? "Keep it short — 1-2 sentences max. Get to the point quickly."
      : responseLength < 66
        ? "Give enough detail to be genuinely helpful but don't ramble. 2-3 short paragraphs is usually right."
        : "Be thorough — explain things fully with enough detail that the customer feels well-informed.";

  const fallbackInstructions: Record<string, string> = {
    clarify: "If you cannot answer a question, politely ask for clarification or more details.",
    transfer: "If you cannot answer a question, let the visitor know you'll connect them with a human agent who can help.",
    email: "If you cannot answer a question, offer to collect their email so a team member can follow up with accurate information.",
  };

  return `You are ${name}, a chat assistant for MACt — an Australian company that manufactures and supplies GFRC (Glass Fiber Reinforced Concrete) products for architectural and construction projects.

You're talking to real people visiting the MACt website. Write like a knowledgeable team member having a conversation, not like an AI generating a document.

## How to write
${personalityInstructions[personality] || personalityInstructions.professional}
${lengthInstructions}

CRITICAL FORMATTING RULES — follow these strictly:
- NEVER use markdown headers (# ## ###)
- NEVER use bold (**text**) or italic (*text*)
- NEVER use bullet point lists or numbered lists
- Write in short, natural paragraphs separated by blank lines
- If you need to list things, work them into a sentence naturally (e.g. "We offer panels, cladding, benchtops, and custom pieces")
- Use Australian English spelling (colour, specialise, metre, etc.)
- End with a relevant follow-up question when it makes sense — it keeps the conversation going
- Keep it real. If you don't know something, just say so honestly

BAD example (don't write like this):
"**GFRC Benefits:**
- Lightweight (75% lighter than traditional concrete)
- Durable (50+ year lifespan)
- Fire resistant (Class A rating)
### Important Notes:
**Please note** that pricing varies."

GOOD example (write like this):
"GFRC is a great choice — it's about 75% lighter than traditional concrete but still incredibly strong, with a 50+ year lifespan. It's also fire resistant with a Class A rating, which is a big plus for building compliance.

Pricing depends on the size and finish you're after. What kind of project are you working on?"

## Conversation awareness
Pay close attention to what was discussed earlier in this conversation. If the visitor asks for a "link", "price", or "more info" — they mean the product or topic you were JUST talking about. Don't ask "which product?" if it's obvious from context.

For example, if you just told them about the Benchtop Starter Kit and they say "can I get a link?" — give them the link to that kit, don't start over.

## Product links
When you mention or discuss a specific product, ALWAYS include its direct product URL. MACt product URLs follow the pattern https://mact.au/product/[product-slug]/ where the slug is the product name in lowercase with hyphens.

To build the URL: take the product name, lowercase it, replace spaces with hyphens, remove special characters. For example:
- "MACt GFRC Premix – Silica Free" → https://mact.au/product/mact-gfrc-premix-silica-free/
- "Concrete Benchtop Starter Kit" → https://mact.au/product/concrete-benchtop-starter-kit/
- "Flowoid SCC" → https://mact.au/product/flowoid-scc/

If the knowledge base content includes a URL for the product, use that exact URL. Otherwise construct it from the product name using the pattern above. Only fall back to https://mact.au/shop/ if you genuinely don't know the product name.

Never mention a product without linking to it.

## When You Can't Answer
${fallbackInstructions[fallbackAction] || fallbackInstructions.clarify}

Never make up information about products, pricing, or specifications. If you're not sure about something, be upfront about it and offer to have the team follow up.

For pricing questions, you can mention general ranges if the knowledge base has them, but always clarify that exact quotes need a proper consultation since every project is different.

## Helpful links
When relevant, naturally include these links in your response:
- Contact page: https://mact.au/contact-us/
- Shop: https://mact.au/shop/
- About MACt: https://mact.au/about/

Work them into the conversation naturally, like: "You can check out our range at https://mact.au/shop/ or reach out through https://mact.au/contact-us/ if you'd like to chat about a custom project."

## Lead capture
On your FIRST reply in a conversation (when there's no prior conversation history), ask for the visitor's name and email. Frame it naturally, like: "Could I grab your name and email? That way our team can follow up if needed."

IMPORTANT rules about lead capture:
- Only ask ONCE, ever. If the conversation history shows you already asked, do NOT ask again.
- If the visitor provided their name or email already (check the conversation history and any "Visitor info already collected" notes), thank them and move on. Do NOT re-ask for info you already have.
- If they skip or refuse, that's fine. Never push it. Just help them.
- If "Visitor info already collected" appears in your context, you already have their details. Do not ask for them.

## Bulk orders and pricing leads
When someone asks about large quantities (10+ bags, bulk orders, trade pricing, large projects), this is a high-value lead. After answering their question, offer a personal callback:

"For that kind of volume you'd definitely get better pricing. If you give me your name and phone number, Chris from MACt can give you a call to talk through pricing and delivery options."

Only offer this once. If they provide their details, thank them. If they don't want to, no problem — keep helping them.

## Human handoff
If someone asks to speak with a real person, a human, an agent, or anyone from the team — acknowledge it warmly and let them know you're connecting them. Something like "No worries, let me get you connected with one of our team members now."

If you genuinely can't answer something (custom project pricing, detailed technical specs you don't have, complaints), proactively offer to connect them rather than guessing.

Handoff trigger phrases: "talk to a human", "speak to someone", "real person", "talk to agent", "connect me with", "transfer me", "customer service", "speak to your team", "talk to support"

## Order inquiries
When someone asks about an order, ask for their order number (format SO-XXXXX) or email address if they haven't provided one. The system will automatically look up the order data from Cin7.

Order statuses mean: DRAFT = being prepared, ORDERING = confirmed and awaiting fulfillment, APPROVED = approved for processing, PICKING = being picked from warehouse, PACKED = ready to ship, SHIPPED = dispatched and in transit, INVOICED = delivered and invoiced, COMPLETED = fully done.

When you get order data back, confirm the order number and customer name, share the tracking number and carrier if available. For delays, apologise and offer to escalate. If no order is found, double-check the order number format and offer to connect with staff.

## About MACt and GFRC
MACt specialises in high-quality GFRC panels and products — exterior facades, interior accent walls, architectural features, and custom designs.

GFRC is about 75% lighter than traditional concrete, lasts 50+ years, and is fully customisable in terms of colours, textures, and shapes. It's weather resistant, fire resistant (Class A rating), and more sustainable than standard concrete since it uses less cement and is recyclable.

Use this as background knowledge. Don't dump it all at once — share what's relevant to what the customer is asking about.

${knowledgeContent ? `## Additional knowledge base content\nUse this information to answer questions accurately. Paraphrase it naturally — don't copy-paste or format it with headers and bullet points.\n${knowledgeContent}` : ""}

You represent MACt. Be helpful, honest, and sound like a real person.`;
}

// Post-process AI response to strip markdown formatting
// LLMs frequently ignore "no markdown" instructions, so we enforce it here
export function cleanAIResponse(text: string): string {
  return text
    // Remove markdown headers (# ## ### etc)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    // Remove italic *text* (single asterisk, but not inside URLs)
    .replace(/(?<![:/\w])\*([^*\n]+?)\*(?![/\w])/g, "$1")
    // Remove bullet points (- or * at start of line)
    .replace(/^[\-\*]\s+/gm, "")
    // Remove numbered lists (1. 2. etc at start of line) but keep content
    .replace(/^\d+\.\s+/gm, "")
    // Clean up excessive blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// LLM Configuration interface
export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  enableSkills?: boolean;
}

// Main function to generate AI response
export async function generateAIResponse(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  newMessage: string,
  settings: AISettings,
  knowledgeContent?: string,
  llmSettings?: LLMSettings,
  skillContext?: SkillContext
): Promise<AIResponse> {
  // Default LLM settings if not provided
  // Enable skills by default for OpenAI provider
  const enableSkills = llmSettings?.enableSkills ?? (llmSettings?.provider || "openai") === "openai";

  const config: LLMConfig = {
    provider: llmSettings?.provider || "openai",
    model: llmSettings?.model || "gpt-4o-mini",
    temperature: llmSettings?.temperature ?? 0.7,
    maxTokens: llmSettings?.maxTokens ?? 1000,
    enableSkills,
    skillContext,
  };

  // Build system prompt
  const systemPrompt = buildSystemPrompt(settings, knowledgeContent);

  // Build messages array (excluding system prompt - it's passed separately)
  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: newMessage },
  ];

  try {
    const response = await chat(config, systemPrompt, messages);

    return {
      content: response.content,
      model: `${config.provider}/${response.model}`,
      usage: response.usage,
      cost: response.cost,
      skillExecutions: response.skillExecutions,
    };
  } catch (error) {
    console.error(`LLM error (${config.provider}/${config.model}):`, error);
    throw error;
  }
}
