import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type LLMProvider = "openai" | "anthropic" | "deepseek";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

// Pricing per 1M tokens (input / output)
export const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    "gpt-4o-mini": { input: 0.15, output: 0.60 },
    "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.60 },
    "gpt-4o": { input: 2.50, output: 10.00 },
    "gpt-4-turbo": { input: 10.00, output: 30.00 },
  },
  anthropic: {
    "claude-3-5-haiku-latest": { input: 0.25, output: 1.25 },
    "claude-3-5-haiku-20241022": { input: 0.25, output: 1.25 },
    "claude-3-5-sonnet-latest": { input: 3.00, output: 15.00 },
    "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },
  },
  deepseek: {
    "deepseek-chat": { input: 0.14, output: 0.28 },
    "deepseek-reasoner": { input: 0.55, output: 2.19 },
  },
};

// Model display info
export const PROVIDERS = {
  openai: {
    name: "OpenAI",
    description: "GPT models from OpenAI",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable" },
      { id: "gpt-4o", name: "GPT-4o", description: "Most capable" },
    ],
  },
  anthropic: {
    name: "Anthropic (Claude)",
    description: "Claude models from Anthropic",
    models: [
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", description: "Fast and affordable" },
      { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", description: "Most capable" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    description: "Cost-effective AI from DeepSeek",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", description: "Best value" },
    ],
  },
};

function calculateCost(
  provider: LLMProvider,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const providerPricing = PRICING[provider];
  const modelPricing = providerPricing?.[model] || providerPricing?.[Object.keys(providerPricing)[0]];

  if (!modelPricing) {
    return 0;
  }

  const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
  const outputCost = (completionTokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}

export async function chat(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  switch (config.provider) {
    case "openai":
      return chatOpenAI(config, systemPrompt, messages);
    case "anthropic":
      return chatAnthropic(config, systemPrompt, messages);
    case "deepseek":
      return chatDeepSeek(config, systemPrompt, messages);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

async function chatOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 1000,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ],
  });

  const usage = response.usage!;
  const cost = calculateCost(
    "openai",
    config.model,
    usage.prompt_tokens,
    usage.completion_tokens
  );

  return {
    content: response.choices[0].message.content || "",
    model: response.model,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
    cost,
  };
}

async function chatAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Filter out system messages for Anthropic (system is separate)
  const chatMessages = messages.filter((m) => m.role !== "system");

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens ?? 1000,
    system: systemPrompt,
    messages: chatMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const usage = response.usage;
  const cost = calculateCost(
    "anthropic",
    config.model,
    usage.input_tokens,
    usage.output_tokens
  );

  return {
    content: response.content[0].type === "text" ? response.content[0].text : "",
    model: response.model,
    usage: {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    },
    cost,
  };
}

async function chatDeepSeek(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  // DeepSeek uses OpenAI-compatible API
  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com/v1",
  });

  const response = await openai.chat.completions.create({
    model: config.model,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 1000,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ],
  });

  const usage = response.usage!;
  const cost = calculateCost(
    "deepseek",
    config.model,
    usage.prompt_tokens,
    usage.completion_tokens
  );

  return {
    content: response.choices[0].message.content || "",
    model: response.model,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
    cost,
  };
}

// Helper to get pricing string for display
export function getPricingString(provider: LLMProvider, model: string): string {
  const pricing = PRICING[provider]?.[model];
  if (!pricing) return "Pricing unavailable";
  return `$${pricing.input.toFixed(2)} / $${pricing.output.toFixed(2)} per 1M tokens`;
}
