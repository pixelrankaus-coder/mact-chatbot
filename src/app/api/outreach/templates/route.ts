import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { extractVariables, validateTemplate } from "@/lib/outreach/templates";

// GET /api/outreach/templates - List all templates
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: templates, error } = await supabase
      .from("outreach_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error("Templates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/outreach/templates - Create new template
export async function POST(request: NextRequest) {
  try {
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

    // Extract variables used in template
    const variables = extractVariables(`${subject} ${templateBody}`);

    const { data: template, error } = await supabase
      .from("outreach_templates")
      .insert({
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody.trim(),
        variables,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
