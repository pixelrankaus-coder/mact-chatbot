/**
 * Convert template body to email-ready HTML.
 *
 * Handles two formats:
 * 1. Legacy plain text — newlines become <p> tags, inline <a> tags styled
 * 2. Rich HTML (from WYSIWYG editor) — contains block-level tags, used as-is with link styling
 *
 * This is used by both send.ts and the campaign preview route.
 */

const BLOCK_TAG_RE = /<(?:p|div|br|ul|ol|li|h[1-6]|blockquote)[\s>/]/i;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Add inline styles to <a> tags for email client compatibility.
 * Optionally adds UTM parameters.
 */
export function styleLinks(
  html: string,
  options?: { campaignName?: string; isFollowUp?: boolean }
): string {
  return html.replace(
    /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
    (_match, href, text) => {
      let finalHref = href;
      if (options?.campaignName) {
        finalHref = addUtmParams(href, options.campaignName, !!options.isFollowUp);
      }
      return `<a href="${finalHref}" style="color: #2563eb; text-decoration: underline;">${text}</a>`;
    }
  );
}

function addUtmParams(url: string, campaignName: string, isFollowUp: boolean): string {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) return url;
    if (parsed.searchParams.has("utm_source")) return url;
    parsed.searchParams.set("utm_source", "email");
    parsed.searchParams.set("utm_medium", "outreach");
    parsed.searchParams.set(
      "utm_campaign",
      campaignName.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
    );
    if (isFollowUp) {
      parsed.searchParams.set("utm_content", "followup");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Detect whether body content is rich HTML (from WYSIWYG) or legacy plain text.
 */
export function isHtmlBody(body: string): boolean {
  return BLOCK_TAG_RE.test(body);
}

/**
 * Convert body text to email-ready HTML.
 * - If already HTML (contains block tags): decode entities, style links
 * - If plain text (legacy): split on newlines, wrap in <p> tags, style links
 */
export function bodyToEmailHtml(
  body: string,
  options?: { campaignName?: string; isFollowUp?: boolean }
): string {
  if (!body) return "";

  const decoded = decodeHtmlEntities(body);

  if (isHtmlBody(decoded)) {
    // Rich HTML body — style links but keep structure
    return styleLinks(decoded, options);
  }

  // Legacy plain text — convert lines to paragraphs
  return decoded
    .split("\n")
    .map((line) => {
      const styledLine = styleLinks(line, options);
      return `<p style="margin: 0 0 10px 0;">${styledLine || "&nbsp;"}</p>`;
    })
    .join("");
}
