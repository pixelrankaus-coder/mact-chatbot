import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Lazy-load Resend client to avoid build-time errors
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// Extract plain text from HTML (basic strip)
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, " ") // Remove all HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

// POST /api/outreach/webhooks/inbound - Handle inbound email replies
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Debug: Log the full payload structure
    console.log("[Inbound Webhook] Full payload:", JSON.stringify(payload, null, 2));

    // Resend inbound webhook includes body content directly in payload
    const emailData = payload.data || payload;
    const {
      email_id,
      from,
      to,
      subject,
      text: webhookText,
      html: webhookHtml
    } = emailData;

    console.log("[Inbound Webhook] Webhook data:", {
      email_id,
      from,
      to,
      subject,
      hasWebhookText: !!webhookText,
      webhookTextLength: webhookText?.length,
      hasWebhookHtml: !!webhookHtml,
      webhookHtmlLength: webhookHtml?.length,
    });

    // Use body content from webhook payload directly
    let text: string | undefined = webhookText;
    let html: string | undefined = webhookHtml;

    // Fallback: If body not in webhook, try fetching from API
    if (!text && !html && email_id) {
      try {
        console.log("[Inbound Webhook] Body not in webhook, fetching from API...");
        const emailResponse = await fetch(`https://api.resend.com/emails/receiving/${email_id}`, {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
        });

        if (emailResponse.ok) {
          const fullEmail = await emailResponse.json();
          text = fullEmail.text;
          html = fullEmail.html;
          console.log("[Inbound Webhook] Fetched email body from API:", {
            hasText: !!text,
            textLength: text?.length,
            hasHtml: !!html,
            htmlLength: html?.length,
          });
        } else {
          const errorText = await emailResponse.text();
          console.error("[Inbound Webhook] Failed to fetch email:", emailResponse.status, errorText);
        }
      } catch (fetchErr) {
        console.error("[Inbound Webhook] Error fetching email body:", fetchErr);
      }
    }

    console.log("[Inbound Webhook] Extracted fields:", {
      from,
      to,
      subject,
      hasText: !!text,
      textLength: text?.length,
      hasHtml: !!html,
      htmlLength: html?.length,
      htmlPreview: html?.substring(0, 500),
    });

    const supabase = getSupabase();

    // Extract email address from "Name <email>" format
    const fromEmailMatch = from?.match(/<(.+)>/);
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from;
    const fromNameMatch = from?.match(/^([^<]+)/);
    const fromName = fromNameMatch ? fromNameMatch[1].trim() : null;

    if (!fromEmail) {
      console.error("No from email in inbound webhook");
      return NextResponse.json({ received: true, error: "No from email" });
    }

    // Find original email we sent to this person (most recent)
    const { data: originalEmail, error: fetchError } = await supabase
      .from("outreach_emails")
      .select("id, campaign_id, recipient_email, recipient_name")
      .eq("recipient_email", fromEmail.toLowerCase())
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();

    // Store reply regardless of whether we find original email
    const { data: reply, error: insertError } = await supabase
      .from("outreach_replies")
      .insert({
        email_id: originalEmail?.id || null,
        campaign_id: originalEmail?.campaign_id || null,
        from_email: fromEmail,
        from_name: fromName,
        subject: subject,
        body_text: text,
        body_html: html,
        status: "new",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store reply:", insertError);
    }

    // If matched to original email
    if (originalEmail && !fetchError) {
      // Update email status to replied
      await supabase
        .from("outreach_emails")
        .update({
          status: "replied",
          replied_at: new Date().toISOString(),
        })
        .eq("id", originalEmail.id);

      // Increment campaign counter
      await supabase.rpc("increment_campaign_replied", {
        p_campaign_id: originalEmail.campaign_id,
      });

      // Log event - get body preview from text or extracted HTML
      const bodyPreview = text || (html ? htmlToText(html) : "");
      await supabase.from("outreach_events").insert({
        email_id: originalEmail.id,
        campaign_id: originalEmail.campaign_id,
        event_type: "replied",
        metadata: {
          subject,
          body_preview: bodyPreview.substring(0, 200),
          from_email: fromEmail,
          from_name: fromName,
        },
      });
    }

    // Get settings for forwarding
    const { data: settings, error: settingsError } = await supabase
      .from("outreach_settings")
      .select("forward_replies, forward_replies_to")
      .single();

    console.log("[Inbound Webhook] Forwarding settings:", {
      forward_replies: settings?.forward_replies,
      forward_replies_to: settings?.forward_replies_to,
      error: settingsError?.message,
    });

    // Forward reply to configured email
    if (settings?.forward_replies && settings?.forward_replies_to) {
      try {
        const campaignInfo = originalEmail
          ? `Original campaign email to: ${originalEmail.recipient_name} (${originalEmail.recipient_email})`
          : "Could not match to any campaign";

        // Get body content - prefer text, fall back to extracting from HTML
        const bodyContent = text || (html ? htmlToText(html) : "(No content)");

        await getResend().emails.send({
          from: "MACt Outreach <noreply@mact.au>",
          to: settings.forward_replies_to,
          subject: `[Customer Reply] ${subject || "No Subject"}`,
          text: `
Reply from: ${from}
${campaignInfo}

---

${bodyContent}
          `.trim(),
          // Also include HTML if available for full formatting
          ...(html && {
            html: `
<p><strong>Reply from:</strong> ${from}</p>
<p><em>${campaignInfo}</em></p>
<hr/>
${html}
            `.trim(),
          }),
        });

        // Mark as forwarded
        if (reply) {
          await supabase
            .from("outreach_replies")
            .update({
              forwarded_to: settings.forward_replies_to,
              forwarded_at: new Date().toISOString(),
              status: "forwarded",
            })
            .eq("id", reply.id);
        }
      } catch (err) {
        console.error("Failed to forward reply:", err);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Inbound webhook error:", error);
    // Return 200 to prevent retry
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}

// GET for webhook verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Inbound webhook endpoint active",
  });
}
