import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSegmentMembers,
  getSegmentMemberCount,
} from "@/lib/outreach/segment-engine";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/segments/[id] - Get segment details + members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const url = new URL(request.url);
    const membersOnly = url.searchParams.get("members") === "true";
    const countOnly = url.searchParams.get("count") === "true";
    const refresh = url.searchParams.get("refresh") === "true";

    // Look up by id or slug
    let query = supabase.from("segments").select("*");
    // UUID pattern check
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      query = query.eq("id", id);
    } else {
      query = query.eq("slug", id);
    }

    const { data: segment, error } = await query.single();
    if (error || !segment) {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
    }

    if (countOnly) {
      const count = await getSegmentMemberCount(
        segment.id,
        refresh ? 0 : 5 * 60 * 1000
      );
      return NextResponse.json({ count });
    }

    if (membersOnly) {
      const members = await getSegmentMembers(segment.id);
      return NextResponse.json({ members, total: members.length });
    }

    // Default: segment info + count
    const count = await getSegmentMemberCount(
      segment.id,
      refresh ? 0 : 5 * 60 * 1000
    );

    return NextResponse.json({
      segment: { ...segment, member_count: count },
    });
  } catch (error) {
    console.error("Segment detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch segment" },
      { status: 500 }
    );
  }
}

// PUT /api/outreach/segments/[id] - Update segment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, rules, source, is_active } = body;

    const supabase = getSupabase();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) {
      updates.name = name;
      updates.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
    if (description !== undefined) updates.description = description;
    if (rules !== undefined) {
      updates.rules = rules;
      // Invalidate cache when rules change
      updates.cached_count = 0;
      updates.cached_at = null;
    }
    if (source !== undefined) updates.source = source;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from("segments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ segment: data });
  } catch (error) {
    console.error("Update segment error:", error);
    return NextResponse.json(
      { error: "Failed to update segment" },
      { status: 500 }
    );
  }
}

// DELETE /api/outreach/segments/[id] - Delete segment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Check if segment is referenced by any campaigns
    const { count } = await supabase
      .from("outreach_campaigns")
      .select("*", { count: "exact", head: true })
      .eq("segment", id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: segment is used by ${count} campaign(s)`,
        },
        { status: 409 }
      );
    }

    // Delete members first (cascade should handle this, but be explicit)
    await supabase.from("segment_members").delete().eq("segment_id", id);

    const { error } = await supabase.from("segments").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete segment error:", error);
    return NextResponse.json(
      { error: "Failed to delete segment" },
      { status: 500 }
    );
  }
}
