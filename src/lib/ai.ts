import OpenAI from "openai";

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
}

// AI Provider type for future extensibility
export type AIProvider = "openai" | "anthropic";

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

## Order Status Inquiries
When customers ask about their order, tracking, delivery, or shipping status:
1. If they haven't provided an order number, ask them to provide it (e.g., "Could you please provide your order number so I can look up the status?")
2. If they provide an order number (like #1234, order 1234, etc.), I will automatically look up the order details and include them in my response
3. If they prefer to look up by email, I can also search their orders using their email address
4. Be helpful and reassuring - let them know you can help track their order

Common order status types:
- "Pending Payment" - Awaiting payment confirmation
- "Processing" - Order received and being prepared
- "On Hold" - Temporarily paused, may need customer action
- "Completed" - Order fulfilled and shipped/delivered
- "Shipped" - On the way to customer

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

// OpenAI provider implementation
class OpenAIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model: string = "gpt-4o-mini") {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
  }

  async generateResponse(messages: AIMessage[]): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: 1024,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content ||
      "I apologize, but I was unable to generate a response. Please try again.";

    return {
      content,
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
}

// Factory function to get AI provider
export function getAIProvider(
  provider: AIProvider = "openai",
  options?: { apiKey?: string; model?: string }
) {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(options?.apiKey, options?.model || "gpt-4o-mini");
    case "anthropic":
      // Placeholder for future Anthropic support
      throw new Error("Anthropic provider not currently implemented. Use OpenAI.");
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// Main function to generate AI response
export async function generateAIResponse(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  newMessage: string,
  settings: AISettings,
  knowledgeContent?: string,
  options?: { provider?: AIProvider; model?: string }
): Promise<AIResponse> {
  const provider = getAIProvider(options?.provider || "openai", {
    model: options?.model,
  });

  // Build system prompt
  const systemPrompt = buildSystemPrompt(settings, knowledgeContent);

  // Build messages array
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: newMessage },
  ];

  return provider.generateResponse(messages);
}
