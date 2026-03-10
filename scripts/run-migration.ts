/**
 * Run SQL migration against Supabase
 * Usage: npx tsx scripts/run-migration.ts
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const sql = fs.readFileSync(
    path.resolve(__dirname, "../supabase/migrations/20260310_cin7_inventory.sql"),
    "utf-8"
  );

  console.log("Running migration against:", SUPABASE_URL);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });

  // Use the Supabase management API or direct postgres
  // Actually, let's use the SQL endpoint via the pg_net extension or supabase-js
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Split SQL into individual statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    console.log(`\nExecuting: ${stmt.slice(0, 80)}...`);
    const { error } = await supabase.rpc("exec_sql", { sql_string: stmt + ";" });
    if (error) {
      // Try direct query via PostgREST — won't work for DDL
      // Fall back to logging the error
      console.error(`  Error: ${error.message}`);
      console.log("  (This may need to be run directly in the Supabase SQL Editor)");
    } else {
      console.log("  OK");
    }
  }
}

main().catch(console.error);
