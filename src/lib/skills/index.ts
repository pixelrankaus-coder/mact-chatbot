/**
 * AI Skills Execution Engine
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * This module provides the core skill execution system for the AI agent.
 * Skills are registered handlers that the AI can invoke via function calling.
 */

import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

/**
 * Skill execution context - passed to each skill handler
 */
export interface SkillContext {
  conversationId?: string;
  visitorId?: string;
  visitorEmail?: string;
  visitorName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Skill execution result
 */
export interface SkillResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

/**
 * Skill handler function signature
 */
export type SkillHandler = (
  params: Record<string, unknown>,
  context: SkillContext
) => Promise<SkillResult>;

/**
 * Skill definition for AI function calling
 */
export interface SkillDefinition {
  slug: string;
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler: SkillHandler;
}

// Registry of skill handlers
const skillHandlers = new Map<string, SkillHandler>();
const skillDefinitions = new Map<string, SkillDefinition>();

/**
 * Register a skill handler
 */
export function registerSkill(definition: SkillDefinition): void {
  skillHandlers.set(definition.slug, definition.handler);
  skillDefinitions.set(definition.slug, definition);
}

/**
 * Get all registered skill definitions (for AI function calling)
 */
export async function getEnabledSkillDefinitions(): Promise<SkillDefinition[]> {
  const supabase = createServiceClient() as SupabaseAny;

  // Get enabled skills from database
  const { data: enabledSkills } = await supabase
    .from("ai_skills")
    .select(`
      skill_id,
      is_enabled,
      skills (
        slug,
        is_available
      )
    `)
    .eq("is_enabled", true);

  if (!enabledSkills) return [];

  // Filter to only registered and available skills
  const enabledSlugs = new Set(
    enabledSkills
      .filter((s: { skills?: { slug: string; is_available: boolean } }) => s.skills?.is_available)
      .map((s: { skills?: { slug: string } }) => s.skills?.slug)
  );

  return Array.from(skillDefinitions.values()).filter((def) => enabledSlugs.has(def.slug));
}

/**
 * Convert skill definitions to OpenAI function format
 */
export async function getSkillsAsFunctions(): Promise<Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: SkillDefinition["parameters"];
  };
}>> {
  const definitions = await getEnabledSkillDefinitions();

  return definitions.map((def) => ({
    type: "function" as const,
    function: {
      name: def.slug,
      description: def.description,
      parameters: def.parameters,
    },
  }));
}

/**
 * Execute a skill by slug
 */
export async function executeSkill(
  slug: string,
  params: Record<string, unknown>,
  context: SkillContext
): Promise<SkillResult> {
  const supabase = createServiceClient() as SupabaseAny;
  const startTime = Date.now();

  // Get skill from database
  const { data: skill } = await supabase
    .from("skills")
    .select(`
      id,
      slug,
      name,
      is_available,
      requires_integration,
      ai_skills (
        is_enabled
      )
    `)
    .eq("slug", slug)
    .single();

  if (!skill) {
    return {
      success: false,
      error: `Skill "${slug}" not found`,
    };
  }

  // Check if skill is available and enabled
  const aiSkill = (skill.ai_skills as Array<{ is_enabled: boolean }> | null)?.[0];
  if (!skill.is_available || !aiSkill?.is_enabled) {
    return {
      success: false,
      error: `Skill "${skill.name}" is not available or not enabled`,
    };
  }

  // Check integration connection if required
  if (skill.requires_integration) {
    const { data: integration } = await supabase
      .from("integration_settings")
      .select("is_enabled")
      .eq("integration_type", skill.requires_integration)
      .single();

    if (!integration?.is_enabled) {
      return {
        success: false,
        error: `${skill.name} requires ${skill.requires_integration} to be connected`,
      };
    }
  }

  // Get the handler
  const handler = skillHandlers.get(slug);
  if (!handler) {
    return {
      success: false,
      error: `No handler registered for skill "${slug}"`,
    };
  }

  // Execute the skill
  let result: SkillResult;
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;

  try {
    result = await handler(params, context);
    if (!result.success) {
      status = "error";
      errorMessage = result.error;
    }
  } catch (error) {
    status = "error";
    errorMessage = error instanceof Error ? error.message : "Unknown error";
    result = {
      success: false,
      error: errorMessage,
    };
  }

  const executionTime = Date.now() - startTime;

  // Log the execution
  await supabase.from("skill_executions").insert({
    skill_id: skill.id,
    conversation_id: context.conversationId || null,
    input_params: params,
    output_result: result.data ? { data: result.data, message: result.message } : null,
    status,
    error_message: errorMessage,
    execution_time_ms: executionTime,
  });

  // Update usage count
  await supabase.rpc("increment_skill_usage", { skill_id_param: skill.id });

  return result;
}

/**
 * Check if a skill is enabled
 */
export async function isSkillEnabled(slug: string): Promise<boolean> {
  const supabase = createServiceClient() as SupabaseAny;

  const { data: skill } = await supabase
    .from("skills")
    .select(`
      is_available,
      ai_skills (
        is_enabled
      )
    `)
    .eq("slug", slug)
    .single();

  if (!skill) return false;

  const aiSkill = (skill.ai_skills as Array<{ is_enabled: boolean }> | null)?.[0];
  return skill.is_available && (aiSkill?.is_enabled ?? false);
}
