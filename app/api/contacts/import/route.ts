import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

interface CsvRow {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  [key: string]: string | undefined;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const emailIdx = headers.findIndex((h) =>
    ["email", "email_address", "e-mail"].includes(h)
  );
  if (emailIdx === -1) return [];

  const firstNameIdx = headers.findIndex((h) =>
    ["first_name", "firstname", "first name", "given_name"].includes(h)
  );
  const lastNameIdx = headers.findIndex((h) =>
    ["last_name", "lastname", "last name", "surname", "family_name"].includes(h)
  );
  const nameIdx = headers.findIndex((h) => h === "name" || h === "full_name");
  const companyIdx = headers.findIndex((h) =>
    ["company", "organization", "organisation", "company_name"].includes(h)
  );
  const phoneIdx = headers.findIndex((h) =>
    ["phone", "phone_number", "mobile", "telephone"].includes(h)
  );

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const email = values[emailIdx]?.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;

    let firstName = firstNameIdx >= 0 ? values[firstNameIdx]?.trim() : undefined;
    let lastName = lastNameIdx >= 0 ? values[lastNameIdx]?.trim() : undefined;

    // If no first/last but has full name, split it
    if (!firstName && !lastName && nameIdx >= 0) {
      const fullName = values[nameIdx]?.trim() || "";
      const parts = fullName.split(" ");
      firstName = parts[0] || undefined;
      lastName = parts.slice(1).join(" ") || undefined;
    }

    rows.push({
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      company: companyIdx >= 0 ? values[companyIdx]?.trim() || undefined : undefined,
      phone: phoneIdx >= 0 ? values[phoneIdx]?.trim() || undefined : undefined,
    });
  }

  return rows;
}

// Handle quoted CSV fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.replace(/^"|"$/g, ""));
}

// POST /api/contacts/import - Import contacts from CSV
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      csv_data,
      source,
      segment_id,
      tags,
    }: {
      csv_data: string;
      source?: string;
      segment_id?: string;
      tags?: string[];
    } = body;

    if (!csv_data) {
      return NextResponse.json(
        { error: "csv_data is required" },
        { status: 400 }
      );
    }

    const rows = parseCsv(csv_data);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found. Ensure CSV has an 'email' column." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch existing contacts, cin7, and woo customers for dedup
    const allEmails = rows.map((r) => r.email);

    const { data: existingContacts } = await supabase
      .from("contacts")
      .select("email")
      .in("email", allEmails);

    const existingSet = new Set(
      (existingContacts || []).map((c) => c.email.toLowerCase())
    );

    // Lookup Cin7 matches
    const { data: cin7Matches } = await supabase
      .from("cin7_customers")
      .select("cin7_id, email")
      .not("email", "is", null);

    const cin7ByEmail = new Map<string, string>();
    (cin7Matches || []).forEach((c) => {
      if (c.email) cin7ByEmail.set(c.email.toLowerCase(), c.cin7_id);
    });

    // Lookup Woo matches
    const { data: wooMatches } = await supabase
      .from("woo_customers")
      .select("woo_id, email")
      .not("email", "is", null);

    const wooByEmail = new Map<string, string>();
    (wooMatches || []).forEach((c) => {
      if (c.email) wooByEmail.set(c.email.toLowerCase(), String(c.woo_id));
    });

    // Process rows
    let imported = 0;
    let skipped = 0;
    let linked = 0;
    const errors: string[] = [];

    const newContacts: Array<Record<string, unknown>> = [];
    const segmentMembers: Array<{ segment_id: string; email: string; name: string; company: string }> = [];

    for (const row of rows) {
      const email = row.email;

      if (existingSet.has(email)) {
        skipped++;
        // Still add to segment if specified
        if (segment_id) {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
          segmentMembers.push({
            segment_id,
            email,
            name: fullName,
            company: row.company || "",
          });
        }
        continue;
      }

      const cin7Id = cin7ByEmail.get(email) || null;
      const wooId = wooByEmail.get(email) || null;
      if (cin7Id || wooId) linked++;

      newContacts.push({
        email,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        company: row.company || null,
        phone: row.phone || null,
        source: source || "klaviyo_import",
        tags: tags || [],
        cin7_customer_id: cin7Id,
        woo_customer_id: wooId,
      });

      if (segment_id) {
        const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
        segmentMembers.push({
          segment_id,
          email,
          name: fullName,
          company: row.company || "",
        });
      }

      existingSet.add(email); // Prevent dupes within this import
    }

    // Batch insert contacts (100 at a time)
    for (let i = 0; i < newContacts.length; i += 100) {
      const batch = newContacts.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from("contacts")
        .insert(batch);

      if (insertError) {
        console.error("Contact insert batch error:", insertError);
        errors.push(`Batch ${Math.floor(i / 100) + 1}: ${insertError.message}`);
      } else {
        imported += batch.length;
      }
    }

    // Batch insert segment members
    if (segmentMembers.length > 0) {
      for (let i = 0; i < segmentMembers.length; i += 100) {
        const batch = segmentMembers.slice(i, i + 100);
        await supabase
          .from("segment_members")
          .upsert(batch, { onConflict: "segment_id,email" });
      }

      // Update segment count
      if (segment_id) {
        await supabase
          .from("segments")
          .update({
            cached_count: segmentMembers.length,
            cached_at: new Date().toISOString(),
          })
          .eq("id", segment_id);
      }
    }

    return NextResponse.json({
      success: true,
      total_rows: rows.length,
      imported,
      skipped,
      linked_to_existing: linked,
      added_to_segment: segmentMembers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Import contacts error:", error);
    return NextResponse.json(
      { error: "Failed to import contacts" },
      { status: 500 }
    );
  }
}
