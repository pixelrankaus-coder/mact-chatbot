import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { extractVariables, validateTemplate } from "@/lib/outreach/templates";

// GET /api/outreach/templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: template, error } = await supabase
      .from("outreach_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Get template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/outreach/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { name, subject, body: templateBody } = body;

    // Validate
    const validation = validateTemplate({ name, subject, body: templateBody });
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // Extract variables
    const variables = extractVariables(`${subject} ${templateBody}`);

    const { data: template, error } = await supabase
      .from("outreach_templates")
      .update({
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody.trim(),
        variables,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating template:", error);
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/outreach/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if template is used by any campaigns
    const { count } = await supabase
      .from("outreach_campaigns")
      .select("*", { count: "exact", head: true })
      .eq("template_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Cannot delete template that is used by campaigns" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("outreach_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting template:", error);
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
