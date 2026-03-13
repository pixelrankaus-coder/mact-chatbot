import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { listAllSuppliers } from "@/lib/cin7";

/**
 * POST /api/production-intelligence/suppliers/import
 * Import suppliers from Cin7 into pi_suppliers table
 */
export async function POST() {
  try {
    const { SupplierList, Total } = await listAllSuppliers();

    if (!SupplierList || SupplierList.length === 0) {
      return NextResponse.json({ imported: 0, total: 0, message: "No suppliers found in Cin7" });
    }

    const supabase = createServiceClient();

    // Try to add cin7_supplier_id column if it doesn't exist (idempotent)
    // PostgREST won't let us run DDL, so just try to select with it
    let hasCin7IdCol = false;
    const { error: colCheck } = await supabase
      .from("pi_suppliers")
      .select("cin7_supplier_id")
      .limit(1);
    hasCin7IdCol = !colCheck;

    // Get existing suppliers to avoid duplicates
    const selectCols = hasCin7IdCol ? "name, cin7_supplier_id" : "name";
    const { data: existing } = await supabase
      .from("pi_suppliers")
      .select(selectCols);

    const existingNames = new Set((existing || []).map((s: Record<string, unknown>) => (s.name as string)?.toLowerCase()));
    const existingCin7Ids = new Set(
      hasCin7IdCol
        ? (existing || []).map((s: Record<string, unknown>) => s.cin7_supplier_id).filter(Boolean)
        : []
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const supplier of SupplierList) {
      // Skip if already imported (by Cin7 ID or name match)
      if (existingCin7Ids.has(supplier.ID) || existingNames.has(supplier.Name?.toLowerCase())) {
        skipped++;
        continue;
      }

      // Extract primary contact
      const primaryContact = supplier.Contacts?.find((c) => c.Default) || supplier.Contacts?.[0];

      const record: Record<string, unknown> = {
        name: supplier.Name,
        contact_name: primaryContact?.Name || null,
        email: primaryContact?.Email || null,
        phone: primaryContact?.Phone || null,
        notes: supplier.Comments || null,
        is_active: supplier.Status === "Active",
      };
      if (hasCin7IdCol) {
        record.cin7_supplier_id = supplier.ID;
      }

      const { error } = await supabase.from("pi_suppliers").insert(record);

      if (error) {
        errors.push(`${supplier.Name}: ${error.message}`);
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      total: Total,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Suppliers] Import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import suppliers from Cin7" },
      { status: 500 }
    );
  }
}
