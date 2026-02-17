import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase";
import {
  getSkillsAsFunctions,
  executeSkill,
  type SkillContext,
} from "@/src/lib/skills";

// Import handlers to register them
import "@/src/lib/skills/handlers";

export type LLMProvider = "openai" | "anthropic" | "deepseek";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  enableSkills?: boolean;
  skillContext?: SkillContext;
}

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SkillExecution {
  skill: string;
  params: Record<string, unknown>;
  result: {
    success: boolean;
    data?: unknown;
    message?: string;
    error?: string;
  };
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
  skillExecutions?: SkillExecution[];
}

// Pricing per 1M tokens (input / output) — updated Feb 2026
export const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    // GPT-4.1 series (Apr 2025+)
    "gpt-4.1-nano": { input: 0.10, output: 0.40 },
    "gpt-4.1-mini": { input: 0.40, output: 1.60 },
    "gpt-4.1": { input: 2.00, output: 8.00 },
    // GPT-4o series
    "gpt-4o-mini": { input: 0.15, output: 0.60 },
    "gpt-4o-mini-2024-07-18": { input: 0.15, output: 0.60 },
    "gpt-4o": { input: 2.50, output: 10.00 },
    // Reasoning models
    "o3-mini": { input: 1.10, output: 4.40 },
    "o4-mini": { input: 1.10, output: 4.40 },
    "o3": { input: 2.00, output: 8.00 },
    // Legacy
    "gpt-4-turbo": { input: 10.00, output: 30.00 },
  },
  anthropic: {
    // Claude 4.5+ series (current)
    "claude-sonnet-4-5-20250929": { input: 3.00, output: 15.00 },
    "claude-haiku-4-5-20251001": { input: 1.00, output: 5.00 },
    // Claude 3.5 series (legacy)
    "claude-3-5-haiku-latest": { input: 0.80, output: 4.00 },
    "claude-3-5-haiku-20241022": { input: 0.80, output: 4.00 },
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
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "Ultra-fast, cheapest option" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Fast and affordable" },
      { id: "gpt-4.1", name: "GPT-4.1", description: "Best all-round model" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Legacy, fast and affordable" },
      { id: "gpt-4o", name: "GPT-4o", description: "Legacy, most capable" },
    ],
  },
  anthropic: {
    name: "Anthropic (Claude)",
    description: "Claude models from Anthropic",
    models: [
      { id: "claude-haiku-4-5-20251001", name: "Claude 4.5 Haiku", description: "Fast and affordable" },
      { id: "claude-sonnet-4-5-20250929", name: "Claude 4.5 Sonnet", description: "Most capable" },
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", description: "Legacy, fast" },
      { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", description: "Legacy, capable" },
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

// --- API Key Resolution (DB-first, env-fallback) ---

let apiKeyCache: { keys: Record<string, string>; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getApiKey(provider: LLMProvider): Promise<string> {
  // Check cache
  if (apiKeyCache && Date.now() - apiKeyCache.fetchedAt < CACHE_TTL) {
    const cached = apiKeyCache.keys[provider];
    if (cached) return cached;
  }

  // Try DB
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", "ai_providers")
      .single();

    if (data?.settings) {
      const settings = data.settings as Record<string, string>;
      apiKeyCache = {
        keys: {
          openai: settings.openai_api_key || "",
          anthropic: settings.anthropic_api_key || "",
          deepseek: settings.deepseek_api_key || "",
        },
        fetchedAt: Date.now(),
      };
      const dbKey = apiKeyCache.keys[provider];
      if (dbKey) return dbKey;
    }
  } catch {
    // Fall through to env vars
  }

  // Fallback to env vars
  const envMap: Record<LLMProvider, string> = {
    openai: process.env.OPENAI_API_KEY || "",
    anthropic: process.env.ANTHROPIC_API_KEY || "",
    deepseek: process.env.DEEPSEEK_API_KEY || "",
  };
  return envMap[provider];
}

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
  const openai = new OpenAI({ apiKey: await getApiKey("openai") });

  // Get enabled skills as tools if skills are enabled
  let tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined;
  if (config.enableSkills) {
    try {
      const skillTools = await getSkillsAsFunctions();
      tools = skillTools.length > 0 ? skillTools : undefined;
    } catch (skillError) {
      console.warn("Failed to load skills (tables may not exist):", skillError);
      // Continue without skills
    }
  }

  // Build initial messages
  const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  // Track total usage and skill executions
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  const skillExecutions: SkillExecution[] = [];

  // Initial API call
  let response = await openai.chat.completions.create({
    model: config.model,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 1000,
    messages: chatMessages,
    tools,
    tool_choice: tools ? "auto" : undefined,
  });

  totalPromptTokens += response.usage?.prompt_tokens || 0;
  totalCompletionTokens += response.usage?.completion_tokens || 0;

  let assistantMessage = response.choices[0].message;

  // Handle tool calls (skills) - loop until no more tool calls
  const MAX_TOOL_ITERATIONS = 5; // Prevent infinite loops
  let iterations = 0;

  while (
    assistantMessage.tool_calls &&
    assistantMessage.tool_calls.length > 0 &&
    iterations < MAX_TOOL_ITERATIONS
  ) {
    iterations++;

    // Add assistant message with tool calls to conversation
    chatMessages.push(assistantMessage);

    // Execute each skill and collect results
    // Filter for function tool calls (type: 'function') and handle them
    const functionToolCalls = assistantMessage.tool_calls.filter(
      (tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & { type: "function" } =>
        tc.type === "function"
    );

    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] =
      await Promise.all(
        functionToolCalls.map(async (toolCall) => {
          const fnCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
            function: { name: string; arguments: string };
          };
          const skillSlug = fnCall.function.name;
          let params: Record<string, unknown> = {};

          try {
            params = JSON.parse(fnCall.function.arguments || "{}");
          } catch {
            console.error(`Failed to parse arguments for skill ${skillSlug}`);
          }

          // Execute the skill
          const result = await executeSkill(
            skillSlug,
            params,
            config.skillContext || {}
          );

          // Track execution
          skillExecutions.push({
            skill: skillSlug,
            params,
            result,
          });

          return {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          };
        })
      );

    // Add tool results to conversation
    chatMessages.push(...toolResults);

    // Make follow-up call to get response with tool results
    response = await openai.chat.completions.create({
      model: config.model,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1000,
      messages: chatMessages,
      tools,
      tool_choice: tools ? "auto" : undefined,
    });

    totalPromptTokens += response.usage?.prompt_tokens || 0;
    totalCompletionTokens += response.usage?.completion_tokens || 0;
    assistantMessage = response.choices[0].message;
  }

  const cost = calculateCost(
    "openai",
    config.model,
    totalPromptTokens,
    totalCompletionTokens
  );

  return {
    content: assistantMessage.content || "",
    model: response.model,
    usage: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    },
    cost,
    skillExecutions: skillExecutions.length > 0 ? skillExecutions : undefined,
  };
}

async function chatAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const anthropic = new Anthropic({ apiKey: await getApiKey("anthropic") });

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
    apiKey: await getApiKey("deepseek"),
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
