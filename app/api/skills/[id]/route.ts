/**
 * Individual Skill API
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * GET: Fetch single skill with full details
 * PATCH: Update skill enabled status or config
 * DELETE: Disable skill (soft delete from ai_skills)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/skills/[id]
 * Returns single skill with full details and execution stats
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createServiceClient() as SupabaseAny;

  try {
    // Fetch skill with ai_skills data
    const { data: skill, error } = await supabase
      .from("skills")
      .select(
        `
        *,
        ai_skills (
          id,
          is_enabled,
          config,
          last_used_at,
          usage_count,
          created_at,
          updated_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !skill) {
      // Try by slug if not found by id
      const { data: bySlug, error: slugError } = await supabase
        .from("skills")
        .select(
          `
          *,
          ai_skills (
            id,
            is_enabled,
            config,
            last_used_at,
            usage_count,
            created_at,
            updated_at
          )
        `
        )
        .eq("slug", id)
        .single();

      if (slugError || !bySlug) {
        return NextResponse.json({ error: "Skill not found" }, { status: 404 });
      }

      return formatSkillResponse(bySlug, supabase);
    }

    return formatSkillResponse(skill, supabase);
  } catch (error) {
    console.error("Failed to fetch skill:", error);
    return NextResponse.json({ error: "Failed to fetch skill" }, { status: 500 });
  }
}

/**
 * PATCH /api/skills/[id]
 * Update skill enabled status or configuration
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const body = await request.json();
    const { is_enabled, config } = body;

    // Find skill by id or slug
    let skill;
    const { data: byId } = await supabase.from("skills").select("*").eq("id", id).single();

    if (byId) {
      skill = byId;
    } else {
      const { data: bySlug } = await supabase.from("skills").select("*").eq("slug", id).single();
      skill = bySlug;
    }

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // If enabling and requires integration, check connection
    if (is_enabled === true && skill.requires_integration) {
      const { data: integration } = await supabase
        .from("integration_settings")
        .select("is_enabled")
        .eq("integration_type", skill.requires_integration)
        .single();

      if (!integration?.is_enabled) {
        return NextResponse.json(
          {
            error: "Integration not connected",
            message: `Connect ${skill.requires_integration} in Settings → Integrations first`,
            requires_integration: skill.requires_integration,
          },
          { status: 400 }
        );
      }
    }

    // Check if ai_skill record exists
    const { data: existing } = await supabase
      .from("ai_skills")
      .select("id, config")
      .eq("skill_id", skill.id)
      .single();

    const updateData: Record<string, unknown> = {
      skill_id: skill.id,
      updated_at: new Date().toISOString(),
    };

    if (is_enabled !== undefined) {
      updateData.is_enabled = is_enabled;
    }

    if (config !== undefined) {
      updateData.config = { ...(existing?.config || {}), ...config };
    }

    // Upsert ai_skills record
    const { error: upsertError } = await supabase.from("ai_skills").upsert(
      existing
        ? { id: existing.id, ...updateData }
        : { ...updateData, is_enabled: is_enabled ?? true },
      { onConflict: "skill_id" }
    );

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      message: `${skill.name} ${is_enabled ? "enabled" : "disabled"}`,
      skill: {
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        is_enabled: is_enabled ?? true,
      },
    });
  } catch (error) {
    console.error("Failed to update skill:", error);
    return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
  }
}

/**
 * Format skill response with connection status
 */
async function formatSkillResponse(skill: Record<string, unknown>, supabase: SupabaseAny) {
  // Get connection status if skill requires integration
  let connectionStatus: "connected" | "disconnected" | "not_required" = "not_required";

  if (skill.requires_integration) {
    const { data: integration } = await supabase
      .from("integration_settings")
      .select("is_enabled")
      .eq("integration_type", skill.requires_integration)
      .single();

    connectionStatus = integration?.is_enabled ? "connected" : "disconnected";
  }

  // Get recent executions for stats
  const { data: recentExecutions } = await supabase
    .from("skill_executions")
    .select("status, created_at, execution_time_ms")
    .eq("skill_id", skill.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const aiSkills = skill.ai_skills as Array<Record<string, unknown>> | null;
  const aiSkill = aiSkills?.[0];

  return NextResponse.json({
    ...skill,
    ai_skills: undefined, // Remove nested array
    is_enabled: aiSkill?.is_enabled ?? false,
    config: aiSkill?.config ?? {},
    last_used_at: aiSkill?.last_used_at ?? null,
    usage_count: aiSkill?.usage_count ?? 0,
    connection_status: connectionStatus,
    recent_executions: recentExecutions || [],
    stats: {
      total_executions: aiSkill?.usage_count ?? 0,
      recent_success_rate: calculateSuccessRate(recentExecutions || []),
      avg_execution_time: calculateAvgExecutionTime(recentExecutions || []),
    },
  });
}

function calculateSuccessRate(executions: Array<{ status: string }>): number {
  if (executions.length === 0) return 0;
  const successful = executions.filter((e) => e.status === "success").length;
  return Math.round((successful / executions.length) * 100);
}

function calculateAvgExecutionTime(executions: Array<{ execution_time_ms?: number }>): number {
  const withTime = executions.filter((e) => e.execution_time_ms != null);
  if (withTime.length === 0) return 0;
  const total = withTime.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0);
  return Math.round(total / withTime.length);
}
