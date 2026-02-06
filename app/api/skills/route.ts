/**
 * AI Skills API
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * GET: Fetch all skills with their enabled status and connection status
 * POST: Enable/disable a skill or update its config
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// Skill category display information
const CATEGORY_INFO: Record<string, { label: string; icon: string; order: number }> = {
  customer_support: { label: "Customer Support", icon: "Headphones", order: 1 },
  ecommerce: { label: "E-commerce", icon: "ShoppingCart", order: 2 },
  marketing: { label: "Marketing", icon: "Megaphone", order: 3 },
  communication: { label: "Communication", icon: "MessageSquare", order: 4 },
  finance: { label: "Finance", icon: "DollarSign", order: 5 },
  productivity: { label: "Productivity", icon: "Briefcase", order: 6 },
};

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_name: string;
  icon_color: string;
  category: string;
  requires_integration: string | null;
  capabilities: string[];
  is_available: boolean;
  sort_order: number;
}

interface AiSkill {
  id: string;
  skill_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  last_used_at: string | null;
  usage_count: number;
}

interface IntegrationSetting {
  integration_type: string;
  is_enabled: boolean;
}

export interface SkillWithStatus extends Skill {
  is_enabled: boolean;
  config: Record<string, unknown>;
  connection_status: "connected" | "disconnected" | "not_required";
  last_used_at: string | null;
  usage_count: number;
  category_info: { label: string; icon: string; order: number };
}

/**
 * GET /api/skills
 * Returns all skills grouped by category with their enabled and connection status
 */
export async function GET() {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    // Fetch all data in parallel
    const [skillsResult, aiSkillsResult, integrationsResult] = await Promise.all([
      supabase.from("skills").select("*").order("sort_order"),
      supabase.from("ai_skills").select("*"),
      supabase.from("integration_settings").select("integration_type, is_enabled"),
    ]);

    if (skillsResult.error) throw skillsResult.error;

    const skills: Skill[] = skillsResult.data || [];
    const aiSkills: AiSkill[] = aiSkillsResult.data || [];
    const integrations: IntegrationSetting[] = integrationsResult.data || [];

    // Create lookup maps
    const aiSkillMap = new Map(aiSkills.map((as) => [as.skill_id, as]));
    const integrationMap = new Map(integrations.map((i) => [i.integration_type, i.is_enabled]));

    // Enrich skills with status
    const enrichedSkills: SkillWithStatus[] = skills.map((skill) => {
      const aiSkill = aiSkillMap.get(skill.id);

      // Determine connection status
      let connectionStatus: "connected" | "disconnected" | "not_required" = "not_required";
      if (skill.requires_integration) {
        const isConnected = integrationMap.get(skill.requires_integration) || false;
        connectionStatus = isConnected ? "connected" : "disconnected";
      }

      return {
        ...skill,
        is_enabled: aiSkill?.is_enabled ?? false,
        config: aiSkill?.config ?? {},
        connection_status: connectionStatus,
        last_used_at: aiSkill?.last_used_at ?? null,
        usage_count: aiSkill?.usage_count ?? 0,
        category_info: CATEGORY_INFO[skill.category] || {
          label: skill.category,
          icon: "Zap",
          order: 99,
        },
      };
    });

    // Group by category
    const grouped = enrichedSkills.reduce(
      (acc, skill) => {
        const category = skill.category;
        if (!acc[category]) {
          acc[category] = {
            ...skill.category_info,
            category,
            skills: [],
          };
        }
        acc[category].skills.push(skill);
        return acc;
      },
      {} as Record<string, { label: string; icon: string; order: number; category: string; skills: SkillWithStatus[] }>
    );

    // Sort categories by order
    const sortedCategories = Object.values(grouped).sort((a, b) => a.order - b.order);

    // Also return flat list for easier consumption
    return NextResponse.json({
      categories: sortedCategories,
      skills: enrichedSkills,
      summary: {
        total: enrichedSkills.length,
        enabled: enrichedSkills.filter((s) => s.is_enabled).length,
        available: enrichedSkills.filter((s) => s.is_available).length,
        connected: enrichedSkills.filter((s) => s.connection_status === "connected").length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch skills:", error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}

/**
 * POST /api/skills
 * Enable/disable a skill or update its configuration
 *
 * Body: { skill_id: string, is_enabled?: boolean, config?: object }
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const body = await request.json();
    const { skill_id, is_enabled, config } = body;

    if (!skill_id) {
      return NextResponse.json({ error: "skill_id is required" }, { status: 400 });
    }

    // Verify skill exists
    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, slug, name, requires_integration, is_available")
      .eq("id", skill_id)
      .single();

    if (skillError || !skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // If trying to enable a skill that requires integration, check connection
    if (is_enabled && skill.requires_integration) {
      const { data: integration } = await supabase
        .from("integration_settings")
        .select("is_enabled")
        .eq("integration_type", skill.requires_integration)
        .single();

      if (!integration?.is_enabled) {
        return NextResponse.json(
          {
            error: "Integration not connected",
            message: `Please connect ${skill.requires_integration} in Settings → Integrations first`,
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
      .eq("skill_id", skill_id)
      .single();

    const updateData: Record<string, unknown> = {
      skill_id,
      updated_at: new Date().toISOString(),
    };

    if (is_enabled !== undefined) {
      updateData.is_enabled = is_enabled;
    }

    if (config !== undefined) {
      // Merge with existing config
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
      message: is_enabled ? `${skill.name} enabled` : `${skill.name} disabled`,
      skill: {
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        is_enabled: is_enabled ?? existing?.is_enabled ?? true,
      },
    });
  } catch (error) {
    console.error("Failed to update skill:", error);
    return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
  }
}
