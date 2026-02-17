import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import * as cheerio from "cheerio";

const MAX_CONTENT_LENGTH = 50000;
const CRAWL_DELAY_MS = 1000; // 1 second between requests to be polite

/**
 * Extract clean text content from HTML
 */
function extractTextFromHTML(html: string): string {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, aside, noscript, iframe, svg").remove();
  $("[role='navigation'], [role='banner'], [role='contentinfo']").remove();
  $(".nav, .navigation, .menu, .sidebar, .footer, .header").remove();
  $("[class*='cookie'], [class*='popup'], [class*='modal'], [class*='banner']").remove();

  let content = "";
  const contentSelectors = [
    "main", "article", "[role='main']", ".content", ".main-content",
    "#content", "#main", ".post-content", ".entry-content", ".page-content",
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  if (!content || content.trim().length < 100) {
    content = $("body").text();
  }

  return content
    .replace(/\s+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .substring(0, MAX_CONTENT_LENGTH)
    .trim();
}

function generateFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    const pathname = urlObj.pathname
      .replace(/\/$/, "")
      .replace(/\//g, "-")
      .replace(/^-/, "");
    const filename = pathname ? `${hostname}${pathname}` : hostname;
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 100);
  } catch {
    return "scraped-content";
  }
}

/**
 * Parse a sitemap XML and extract URLs
 * Handles both regular sitemaps and sitemap index files
 */
async function parseSitemap(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl, {
    headers: {
      "User-Agent": "MACt-Chatbot-Crawler/1.0 (Knowledge Base Builder)",
      "Accept": "application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xml: true });

  const urls: string[] = [];

  // Check if this is a sitemap index (contains other sitemaps)
  const sitemapLocs = $("sitemapindex sitemap loc");
  if (sitemapLocs.length > 0) {
    // Recursively fetch nested sitemaps
    for (let i = 0; i < sitemapLocs.length; i++) {
      const nestedUrl = $(sitemapLocs[i]).text().trim();
      if (nestedUrl) {
        try {
          const nestedUrls = await parseSitemap(nestedUrl);
          urls.push(...nestedUrls);
        } catch (err) {
          console.error(`Failed to parse nested sitemap ${nestedUrl}:`, err);
        }
      }
    }
  }

  // Extract URLs from regular sitemap
  $("urlset url loc").each((_, el) => {
    const loc = $(el).text().trim();
    if (loc) urls.push(loc);
  });

  return urls;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/knowledge-base/crawl-sitemap
 * Discover URLs from sitemap - just returns the list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sitemapUrl, action, urls } = body;

    // Action: "discover" - fetch sitemap and return URLs
    if (action === "discover") {
      if (!sitemapUrl) {
        return NextResponse.json(
          { error: "Sitemap URL is required" },
          { status: 400 }
        );
      }

      let validUrl: URL;
      try {
        validUrl = new URL(sitemapUrl);
        if (!["http:", "https:"].includes(validUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid sitemap URL" },
          { status: 400 }
        );
      }

      const discoveredUrls = await parseSitemap(validUrl.toString());

      // Filter to only HTML-like URLs (exclude images, PDFs, etc.)
      const filteredUrls = discoveredUrls.filter((url) => {
        const path = new URL(url).pathname.toLowerCase();
        const excludeExtensions = [
          ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
          ".pdf", ".zip", ".mp4", ".mp3", ".css", ".js",
        ];
        return !excludeExtensions.some((ext) => path.endsWith(ext));
      });

      return NextResponse.json({
        success: true,
        urls: filteredUrls,
        total: filteredUrls.length,
        filteredOut: discoveredUrls.length - filteredUrls.length,
      });
    }

    // Action: "crawl" - scrape selected URLs
    if (action === "crawl") {
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json(
          { error: "URLs array is required" },
          { status: 400 }
        );
      }

      // Limit to 50 URLs per batch
      const urlsToCrawl = urls.slice(0, 50);
      const supabase = createServiceClient();

      const results: { url: string; status: "success" | "skipped" | "error"; chars?: number; error?: string }[] = [];

      for (const url of urlsToCrawl) {
        try {
          // Check if already scraped
          const { data: existing } = await supabase
            .from("knowledge_base")
            .select("id")
            .eq("source_url", url)
            .single();

          if (existing) {
            results.push({ url, status: "skipped" });
            continue;
          }

          // Fetch the page
          const response = await fetch(url, {
            headers: {
              "User-Agent": "MACt-Chatbot-Crawler/1.0 (Knowledge Base Builder)",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
            },
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            results.push({ url, status: "error", error: `HTTP ${response.status}` });
            await delay(CRAWL_DELAY_MS);
            continue;
          }

          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
            results.push({ url, status: "skipped", error: "Not HTML" });
            continue;
          }

          const html = await response.text();
          const content = extractTextFromHTML(html);

          if (!content || content.length < 50) {
            results.push({ url, status: "skipped", error: "No meaningful content" });
            await delay(CRAWL_DELAY_MS);
            continue;
          }

          const filename = generateFilenameFromUrl(url);

          const { error: insertError } = await supabase
            .from("knowledge_base")
            .insert({
              filename,
              file_type: "url",
              file_size: content.length,
              content,
              status: "ready",
              source_url: url,
            });

          if (insertError) {
            results.push({ url, status: "error", error: insertError.message });
          } else {
            results.push({ url, status: "success", chars: content.length });
          }

          // Polite delay between requests
          await delay(CRAWL_DELAY_MS);
        } catch (err) {
          results.push({
            url,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
          await delay(CRAWL_DELAY_MS);
        }
      }

      const succeeded = results.filter((r) => r.status === "success").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const failed = results.filter((r) => r.status === "error").length;

      return NextResponse.json({
        success: true,
        results,
        summary: { total: urlsToCrawl.length, succeeded, skipped, failed },
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'discover' or 'crawl'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Sitemap crawl error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to crawl sitemap" },
      { status: 500 }
    );
  }
}
