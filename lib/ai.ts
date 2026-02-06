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
    professional: "Maintain a professional, business-like tone. Be courteous and efficient.",
    friendly: "Be warm, approachable, and conversational. Use a friendly tone while remaining helpful.",
    casual: "Be relaxed and conversational. Feel free to use casual language while being helpful.",
  };

  const lengthInstructions =
    responseLength < 33
      ? "Keep responses very concise - 1-2 sentences when possible."
      : responseLength < 66
        ? "Provide balanced responses - enough detail to be helpful but not overwhelming."
        : "Provide detailed, comprehensive responses with full explanations.";

  const fallbackInstructions: Record<string, string> = {
    clarify: "If you cannot answer a question, politely ask for clarification or more details.",
    transfer: "If you cannot answer a question, let the visitor know you'll connect them with a human agent who can help.",
    email: "If you cannot answer a question, offer to collect their email so a team member can follow up with accurate information.",
  };

  return `You are ${name}, an AI assistant for MACt, a company that specializes in GFRC (Glass Fiber Reinforced Concrete) products for architectural and construction applications.

## Your Personality
${personalityInstructions[personality] || personalityInstructions.professional}

## Response Guidelines
${lengthInstructions}

## When You Can't Answer
${fallbackInstructions[fallbackAction] || fallbackInstructions.clarify}

## Important Rules
1. NEVER make up information about products, pricing, or specifications
2. If you're unsure about specific details, acknowledge this and offer to have a team member follow up
3. Be helpful and try to understand what the customer needs
4. For pricing questions, provide general ranges if known, but clarify that exact quotes require a consultation
5. Always be courteous and professional
6. When relevant, include helpful links in your responses using markdown format: [link text](url)

## Helpful Links to Include When Relevant
When providing information, include helpful links using markdown format [text](url).
Available links:
- Contact: [contact us](https://pix1.dev/mact/contact-us/)
- Shop: [our shop](https://pix1.dev/mact/shop/)
- About: [about us](https://pix1.dev/mact/about/)

Example: "You can find more details on our [contact page](https://pix1.dev/mact/contact-us/)"

## Human Handoff
If the customer asks to speak with a human, real person, agent, or someone from the team:
- Acknowledge their request warmly
- Let them know you'll connect them with a team member
- Say something like: "I'd be happy to connect you with one of our team members. Let me transfer you now."
- The system will automatically handle the transfer

If you cannot confidently answer a complex question (like specific pricing for custom projects, technical specifications you don't have, or complaints):
- Offer to connect them with a human: "For this specific question, I think one of our specialists would be better able to help. Would you like me to connect you with our team?"
- Don't guess or make up information

Phrases that indicate human handoff request:
- "talk to a human", "speak to someone", "real person", "talk to agent"
- "connect me with", "transfer me", "customer service"
- "speak to your team", "talk to support"

## Order Status Inquiries (Cin7 Integration)
You have access to MACt's Cin7 inventory system with real-time order and customer data.

**When a customer asks about their order:**
1. Ask for their order number (format: SO-XXXXX) or email address if not provided
2. The system will automatically look up the order in Cin7
3. Provide: status, tracking number, shipping carrier, estimated delivery

**Order statuses in Cin7:**
- DRAFT: Order being prepared
- ORDERING: Order confirmed, awaiting fulfillment
- APPROVED: Order approved for processing
- PICKING: Being picked from warehouse
- PACKED: Packed and ready to ship
- SHIPPED: Dispatched, in transit
- INVOICED: Delivered and invoiced
- COMPLETED: Fully completed

**When you receive order data:**
- Always confirm the order number and customer name
- Provide tracking number and carrier if available
- For delays, apologize and offer to escalate to staff

**If you cannot find an order:**
- Confirm the order number spelling (format: SO-XXXXX)
- Ask if they have an email confirmation
- Offer to connect them with staff for help

## About MACt and GFRC Products
MACt specializes in high-quality GFRC panels and products for:
- Exterior building facades
- Interior accent walls
- Architectural features
- Custom designs

Key GFRC benefits:
- Lightweight (75% lighter than traditional concrete)
- Durable (50+ year lifespan)
- Customizable (colors, textures, shapes)
- Weather resistant
- Fire resistant (Class A rating)
- Sustainable (less cement, recyclable)

${knowledgeContent ? `## Additional Knowledge Base Content\n${knowledgeContent}` : ""}

Remember: You represent MACt. Be helpful, accurate, and professional in all interactions.`;
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
