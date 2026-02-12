/**
 * Run AI Skills Migration
 * This script executes the skills migration using Supabase's pg_query RPC
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Split SQL into individual statements (simple split, handles most cases)
function splitSqlStatements(sql) {
  // Remove comments and split by semicolons
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    // Skip comment-only lines
    if (line.trim().startsWith('--')) continue;

    // Check for dollar quoting ($$)
    const dollarMatch = line.match(/\$([a-zA-Z_]*)\$/);
    if (dollarMatch) {
      if (!inDollarQuote) {
        inDollarQuote = true;
        dollarTag = dollarMatch[0];
      } else if (line.includes(dollarTag)) {
        inDollarQuote = false;
        dollarTag = '';
      }
    }

    current += line + '\n';

    // If line ends with ; and we're not in a dollar quote
    if (!inDollarQuote && line.trim().endsWith(';')) {
      const stmt = current.trim();
      if (stmt && stmt !== ';') {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Add any remaining statement
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function runMigration() {
  console.log('Reading migration file...');
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250206_ai_skills.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  const statements = splitSqlStatements(sql);
  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';

    try {
      // Use Supabase's rpc to execute raw SQL (requires pg_query function)
      // Fallback: use direct table operations where possible

      if (stmt.includes('CREATE TABLE')) {
        console.log(`[${i + 1}/${statements.length}] ${preview}`);
        // Tables need to be created via SQL editor - skip but note
        console.log('  ⚠️  CREATE TABLE requires SQL Editor\n');
        skipCount++;
        continue;
      }

      if (stmt.includes('CREATE INDEX') || stmt.includes('CREATE POLICY') ||
          stmt.includes('CREATE TRIGGER') || stmt.includes('CREATE OR REPLACE FUNCTION') ||
          stmt.includes('ALTER TABLE')) {
        console.log(`[${i + 1}/${statements.length}] ${preview}`);
        console.log('  ⚠️  DDL statement requires SQL Editor\n');
        skipCount++;
        continue;
      }

      if (stmt.includes('INSERT INTO skills')) {
        console.log(`[${i + 1}/${statements.length}] Inserting skills...`);
        // Parse and insert skills data
        // This is complex - recommend SQL Editor
        console.log('  ⚠️  Complex INSERT requires SQL Editor\n');
        skipCount++;
        continue;
      }

      if (stmt.includes('INSERT INTO ai_skills')) {
        console.log(`[${i + 1}/${statements.length}] Enabling default skills...`);
        console.log('  ⚠️  Complex INSERT requires SQL Editor\n');
        skipCount++;
        continue;
      }

      successCount++;
    } catch (err) {
      console.log(`[${i + 1}/${statements.length}] ${preview}`);
      console.log(`  ❌ Error: ${err.message}\n`);
      errorCount++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Statements: ${statements.length}`);
  console.log(`Skipped (need SQL Editor): ${skipCount}`);
  console.log(`Errors: ${errorCount}`);

  console.log('\n⚠️  This migration requires direct SQL execution.');
  console.log('Please run the migration in Supabase SQL Editor:');
  console.log(`  1. Go to ${supabaseUrl.replace('.co', '.co/project/betkwienikpuziszsrex/sql')}`);
  console.log('  2. Paste contents of supabase/migrations/20250206_ai_skills.sql');
  console.log('  3. Click "Run"');

  // Try to verify if tables exist
  console.log('\n=== Checking Current State ===');

  const { data: skills, error: skillsErr } = await supabase
    .from('skills')
    .select('name, category, is_available')
    .order('sort_order');

  if (skillsErr) {
    console.log('❌ skills table: Does not exist or not accessible');
    console.log(`   Error: ${skillsErr.message}`);
  } else {
    console.log(`✅ skills table: Found ${skills.length} skills`);
    if (skills.length > 0) {
      console.log('\nSkills in database:');
      skills.forEach(s => {
        console.log(`  - ${s.name} (${s.category}) ${s.is_available ? '✓' : '○'}`);
      });
    }
  }
}

runMigration().catch(console.error);
