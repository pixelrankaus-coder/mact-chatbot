import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import * as cheerio from "cheerio";

const MAX_CONTENT_LENGTH = 50000; // 50k characters max

/**
 * Extract clean text content from HTML
 */
function extractTextFromHTML(html: string): string {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $("script").remove();
  $("style").remove();
  $("nav").remove();
  $("footer").remove();
  $("header").remove();
  $("aside").remove();
  $("noscript").remove();
  $("iframe").remove();
  $("svg").remove();
  $("[role='navigation']").remove();
  $("[role='banner']").remove();
  $("[role='contentinfo']").remove();
  $(".nav, .navigation, .menu, .sidebar, .footer, .header").remove();
  $("[class*='cookie']").remove();
  $("[class*='popup']").remove();
  $("[class*='modal']").remove();
  $("[class*='banner']").remove();

  // Try to get main content area first
  let content = "";

  // Priority order for content extraction
  const contentSelectors = [
    "main",
    "article",
    "[role='main']",
    ".content",
    ".main-content",
    "#content",
    "#main",
    ".post-content",
    ".entry-content",
    ".page-content",
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  // Fallback to body if no main content found
  if (!content || content.trim().length < 100) {
    content = $("body").text();
  }

  // Clean up the text
  content = content
    // Replace multiple whitespace with single space
    .replace(/\s+/g, " ")
    // Remove leading/trailing whitespace from lines
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    // Limit length
    .substring(0, MAX_CONTENT_LENGTH)
    .trim();

  return content;
}

/**
 * Generate a filename from URL
 */
function generateFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    const pathname = urlObj.pathname
      .replace(/\/$/, "")
      .replace(/\//g, "-")
      .replace(/^-/, "");

    const filename = pathname ? `${hostname}${pathname}` : hostname;

    // Clean up and limit length
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 100);
  } catch {
    return "scraped-content";
  }
}

/**
 * POST /api/knowledge-base/scrape
 * Scrape a webpage and add it to the knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    let validUrl: URL;
    try {
      validUrl = new URL(url);
      if (!["http:", "https:"].includes(validUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL. Please provide a valid http or https URL." },
        { status: 400 }
      );
    }

    // Fetch the webpage
    let html: string;
    try {
      const response = await fetch(validUrl.toString(), {
        headers: {
          "User-Agent": "MACt-Chatbot-Scraper/1.0 (Knowledge Base Builder)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        // 30 second timeout
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return NextResponse.json(
          { error: "URL does not point to an HTML page" },
          { status: 400 }
        );
      }

      html = await response.text();
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      const message = fetchError instanceof Error ? fetchError.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to fetch URL: ${message}` },
        { status: 400 }
      );
    }

    // Extract text content
    const content = extractTextFromHTML(html);

    if (!content || content.length < 50) {
      return NextResponse.json(
        { error: "Could not extract meaningful content from this page" },
        { status: 400 }
      );
    }

    // Generate filename
    const filename = generateFilenameFromUrl(url);

    // Save to database
    const supabase = createServiceClient();

    // Check if this URL was already scraped
    const { data: existing } = await supabase
      .from("knowledge_base")
      .select("id")
      .eq("source_url", url)
      .single();

    if (existing) {
      // Update existing record
      const { data: document, error } = await supabase
        .from("knowledge_base")
        .update({
          content,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        document,
        message: "Content updated from URL",
        contentLength: content.length,
        preview: content.substring(0, 200) + "...",
      });
    }

    // Create new record
    const { data: document, error } = await supabase
      .from("knowledge_base")
      .insert({
        filename,
        file_type: "url",
        file_size: content.length,
        content,
        status: "ready",
        source_url: url,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      document,
      message: "Successfully scraped and added to knowledge base",
      contentLength: content.length,
      preview: content.substring(0, 200) + "...",
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Failed to scrape URL" },
      { status: 500 }
    );
  }
}
