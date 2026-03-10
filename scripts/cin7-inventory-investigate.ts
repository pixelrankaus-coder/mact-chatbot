/**
 * Cin7 Inventory API Investigation Script
 * Run: npx tsx scripts/cin7-inventory-investigate.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const CIN7_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-auth-accountid": process.env.CIN7_ACCOUNT_ID!,
    "api-auth-applicationkey": process.env.CIN7_API_KEY!,
  };
}

interface EndpointResult {
  name: string;
  url: string;
  status: number;
  total?: number;
  sampleFields: string[];
  firstRecord?: Record<string, unknown>;
  errors?: string[];
  notes: string[];
}

async function testEndpoint(name: string, urlPath: string, listKey?: string): Promise<EndpointResult> {
  const url = `${CIN7_BASE_URL}${urlPath}`;
  console.log(`\n--- Testing: ${name} ---`);
  console.log(`  URL: ${url}`);

  try {
    const res = await fetch(url, { headers: getHeaders() });
    const status = res.status;
    const data = await res.json();

    // Check for Cin7 errors in body
    if (data.Errors && data.Errors.length > 0) {
      console.log(`  ERROR: ${data.Errors.join(", ")}`);
      return { name, url, status, sampleFields: [], errors: data.Errors, notes: ["API returned errors"] };
    }

    // Figure out the list key
    let records: unknown[] = [];
    let total = 0;
    const foundKey = listKey || Object.keys(data).find(k => Array.isArray(data[k]));

    if (foundKey && Array.isArray(data[foundKey])) {
      records = data[foundKey];
      total = data.Total ?? records.length;
    } else if (Array.isArray(data)) {
      records = data;
      total = records.length;
    } else {
      // Might be a single object or different structure
      records = [data];
      total = 1;
    }

    const firstRecord = records[0] as Record<string, unknown> | undefined;
    const sampleFields = firstRecord ? Object.keys(firstRecord) : [];

    console.log(`  Status: ${status}`);
    console.log(`  Total records: ${total}`);
    console.log(`  Fields: ${sampleFields.join(", ")}`);

    return {
      name,
      url,
      status,
      total,
      sampleFields,
      firstRecord: firstRecord || undefined,
      notes: [`List key: ${foundKey || "root"}`, `Record count on page: ${records.length}`],
    };
  } catch (err) {
    console.log(`  FETCH ERROR: ${err}`);
    return { name, url, status: 0, sampleFields: [], errors: [String(err)], notes: ["Fetch failed"] };
  }
}

async function main() {
  console.log("=== Cin7 Inventory API Investigation ===");
  console.log(`Account ID: ${process.env.CIN7_ACCOUNT_ID?.slice(0, 8)}...`);
  console.log(`API Key: ${process.env.CIN7_API_KEY?.slice(0, 8)}...`);

  const results: EndpointResult[] = [];

  // 1. Products
  results.push(await testEndpoint("Products", "/product?Page=1&Limit=5", "Products"));

  // Small delay between requests
  await new Promise(r => setTimeout(r, 300));

  // 2. ProductAvailability
  results.push(await testEndpoint("ProductAvailability", "/ref/productavailability?Page=1&Limit=5", "ProductAvailabilityList"));

  await new Promise(r => setTimeout(r, 300));

  // 3. ProductCategories
  results.push(await testEndpoint("ProductCategories", "/ref/productCategory"));

  await new Promise(r => setTimeout(r, 300));

  // 4. ProductBrands
  results.push(await testEndpoint("ProductBrand", "/ref/productBrand"));

  await new Promise(r => setTimeout(r, 300));

  // 5. ProductFamilies
  results.push(await testEndpoint("ProductFamily", "/ref/productFamily"));

  await new Promise(r => setTimeout(r, 300));

  // 6. Locations
  results.push(await testEndpoint("Locations", "/ref/location"));

  await new Promise(r => setTimeout(r, 300));

  // 7. PurchaseList
  results.push(await testEndpoint("PurchaseList", "/purchaseList?Page=1&Limit=5", "PurchaseList"));

  await new Promise(r => setTimeout(r, 300));

  // 8. StockAdjustment
  results.push(await testEndpoint("StockAdjustment", "/stockAdjustment?Page=1&Limit=5"));

  await new Promise(r => setTimeout(r, 300));

  // 9. StockTransfer
  results.push(await testEndpoint("StockTransfer", "/stockTransfer?Page=1&Limit=5"));

  await new Promise(r => setTimeout(r, 300));

  // 10. Product detail (get first product ID from result #1 and fetch full details)
  const firstProductId = results[0]?.firstRecord?.ID as string | undefined;
  if (firstProductId) {
    results.push(await testEndpoint("Product Detail (single)", `/product?ID=${firstProductId}`));
  }

  // Generate markdown report
  let md = "# Cin7 Inventory API Investigation\n\n";
  md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n\n`;
  md += "---\n\n";

  for (const r of results) {
    md += `## ${r.name}\n\n`;
    md += `**URL:** \`${r.url.replace(CIN7_BASE_URL, "")}\`\n\n`;
    md += `**Status:** ${r.status}\n`;
    if (r.total !== undefined) md += `**Total Records:** ${r.total}\n`;
    if (r.errors) md += `**Errors:** ${r.errors.join(", ")}\n`;
    md += `**Notes:** ${r.notes.join(" | ")}\n\n`;

    if (r.sampleFields.length > 0) {
      md += "### Fields\n\n";
      md += "| Field | Type | Sample Value |\n";
      md += "|-------|------|-------------|\n";
      for (const field of r.sampleFields) {
        const val = r.firstRecord?.[field];
        const type = val === null ? "null" : typeof val === "object" ? (Array.isArray(val) ? `array[${(val as unknown[]).length}]` : "object") : typeof val;
        let sample = val === null ? "null" : typeof val === "object" ? JSON.stringify(val).slice(0, 100) : String(val).slice(0, 100);
        // Escape pipes for markdown
        sample = sample.replace(/\|/g, "\\|");
        md += `| ${field} | ${type} | ${sample} |\n`;
      }
      md += "\n";
    }

    if (r.firstRecord) {
      md += "<details><summary>Full sample record JSON</summary>\n\n```json\n";
      md += JSON.stringify(r.firstRecord, null, 2).slice(0, 5000);
      md += "\n```\n</details>\n\n";
    }

    md += "---\n\n";
  }

  // Write report
  const outPath = path.resolve(__dirname, "../docs/cin7-inventory-api-investigation.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, "utf-8");
  console.log(`\n\n=== Report written to: ${outPath} ===`);
}

main().catch(console.error);
