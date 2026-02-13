import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase";

// Initialize Resend client (only if API key is available)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Get notification emails from environment variable (fallback)
function getNotificationEmails(): string[] {
  const emails = process.env.NOTIFICATION_EMAIL;
  if (!emails) return [];
  return emails.split(",").map((e) => e.trim()).filter(Boolean);
}

// Cache for DB-based alert recipients
type AlertType = "service_alerts" | "new_conversations" | "handoff_requests";
interface AlertPreferences {
  service_alerts: boolean;
  new_conversations: boolean;
  handoff_requests: boolean;
}
let recipientCache: { emails: Record<AlertType, string[]>; timestamp: number } | null = null;
const RECIPIENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get email recipients for a specific alert type.
 * Reads from DB preferences first, falls back to NOTIFICATION_EMAIL env var.
 */
export async function getAlertRecipients(alertType: AlertType): Promise<string[]> {
  // Check cache
  if (recipientCache && Date.now() - recipientCache.timestamp < RECIPIENT_CACHE_TTL) {
    return recipientCache.emails[alertType] || [];
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    // Fetch preferences from settings table
    const { data: prefData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "email_alert_preferences")
      .single();

    const preferences = prefData?.value as Record<string, AlertPreferences> | null;

    if (!preferences || Object.keys(preferences).length === 0) {
      // No DB preferences — fall back to env var for all alert types
      const fallback = getNotificationEmails();
      recipientCache = {
        emails: {
          service_alerts: fallback,
          new_conversations: fallback,
          handoff_requests: fallback,
        },
        timestamp: Date.now(),
      };
      return fallback;
    }

    // Fetch agent emails for enabled agent IDs
    const { data: agents } = await supabase
      .from("agents")
      .select("id, email");

    const agentEmailMap: Record<string, string> = {};
    for (const agent of agents || []) {
      agentEmailMap[agent.id] = agent.email;
    }

    // Build recipient lists per alert type
    const alertTypes: AlertType[] = ["service_alerts", "new_conversations", "handoff_requests"];
    const emails: Record<AlertType, string[]> = {
      service_alerts: [],
      new_conversations: [],
      handoff_requests: [],
    };

    for (const type of alertTypes) {
      for (const [agentId, prefs] of Object.entries(preferences)) {
        if (prefs[type] && agentEmailMap[agentId]) {
          emails[type].push(agentEmailMap[agentId]);
        }
      }
    }

    recipientCache = { emails, timestamp: Date.now() };
    return emails[alertType] || [];
  } catch (error) {
    console.error("Failed to fetch alert recipients from DB:", error);
    // Fall back to env var
    return getNotificationEmails();
  }
}

// Get the app URL for inbox links
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// Get the "from" email address
function getFromEmail(): string {
  return process.env.EMAIL_FROM || "MACt Chatbot <onboarding@resend.dev>";
}

interface NewConversationEmailData {
  visitorName?: string;
  visitorEmail?: string;
  visitorLocation?: string;
  firstMessage: string;
  conversationId: string;
}

export async function sendNewConversationEmail(
  data: NewConversationEmailData
): Promise<boolean> {
  const emails = await getAlertRecipients("new_conversations");
  if (!resend || emails.length === 0) {
    console.log("Email notifications not configured, skipping new conversation email");
    return false;
  }

  const { visitorName, visitorEmail, visitorLocation, firstMessage, conversationId } = data;
  const inboxUrl = `${getAppUrl()}/inbox?id=${conversationId}`;
  const displayName = visitorName || visitorEmail || "Website Visitor";

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: emails,
      subject: `New chat from ${displayName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background: #3b82f6; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">💬 New Chat Message</h1>
              </div>

              <!-- Content -->
              <div style="padding: 24px;">
                <!-- Visitor Info -->
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #64748b;">From:</strong>
                    <span style="color: #1e293b;">${visitorName || "Unknown"}</span>
                  </p>
                  ${visitorEmail ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px;">
                      <strong style="color: #64748b;">Email:</strong>
                      <a href="mailto:${visitorEmail}" style="color: #3b82f6; text-decoration: none;">${visitorEmail}</a>
                    </p>
                  ` : ""}
                  ${visitorLocation ? `
                    <p style="margin: 0; font-size: 14px;">
                      <strong style="color: #64748b;">Location:</strong>
                      <span style="color: #1e293b;">${visitorLocation}</span>
                    </p>
                  ` : ""}
                </div>

                <!-- Message -->
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                  <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">"${firstMessage}"</p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center;">
                  <a href="${inboxUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 15px;">
                    Reply in Inbox →
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                  Conversation ID: ${conversationId}
                </p>
              </div>
            </div>

            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
              Sent by MACt Chatbot
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`New conversation email sent to ${emails.join(", ")}`);
    return true;
  } catch (error) {
    console.error("Failed to send new conversation email:", error);
    return false;
  }
}

// ============ SERVICE ALERTS ============

interface ServiceAlertEmailData {
  serviceName: string;
  status: string;
  details?: string;
  timestamp: string;
}

export async function sendServiceAlertEmail(
  data: ServiceAlertEmailData
): Promise<boolean> {
  const emails = await getAlertRecipients("service_alerts");
  if (!resend || emails.length === 0) {
    console.log("Email notifications not configured, skipping service alert email");
    return false;
  }

  const { serviceName, status, details, timestamp } = data;
  const dashboardUrl = `${getAppUrl()}/settings/infrastructure`;
  const time = new Date(timestamp).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const statusColor = status === "down" ? "#dc2626" : "#f59e0b";
  const statusLabel = status === "down" ? "Down" : "Degraded";
  const emoji = status === "down" ? "🔴" : "🟡";

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: emails,
      subject: `🚨 MACt Service Alert - ${serviceName} ${statusLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="background: ${statusColor}; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${emoji} Service Alert</h1>
              </div>
              <div style="padding: 24px;">
                <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  A critical service in the MACt platform has gone ${statusLabel.toLowerCase()}.
                </p>
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #991b1b;">Service:</strong>
                    <span style="color: #1e293b;">${serviceName}</span>
                  </p>
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #991b1b;">Status:</strong>
                    <span style="color: ${statusColor}; font-weight: 600;">${statusLabel}</span>
                  </p>
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #991b1b;">Time:</strong>
                    <span style="color: #1e293b;">${time}</span>
                  </p>
                  ${details ? `
                    <p style="margin: 0; font-size: 14px;">
                      <strong style="color: #991b1b;">Details:</strong>
                      <span style="color: #1e293b;">${details}</span>
                    </p>
                  ` : ""}
                </div>
                <div style="text-align: center;">
                  <a href="${dashboardUrl}" style="display: inline-block; background: ${statusColor}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 15px;">
                    View Infrastructure Dashboard →
                  </a>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                  Automated alert from MACt monitoring system
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`Service alert email sent for ${serviceName} (${statusLabel})`);
    return true;
  } catch (error) {
    console.error("Failed to send service alert email:", error);
    return false;
  }
}

interface ServiceRecoveryEmailData {
  serviceName: string;
  previousStatus: string;
  timestamp: string;
  downSince?: string;
}

export async function sendServiceRecoveryEmail(
  data: ServiceRecoveryEmailData
): Promise<boolean> {
  const emails = await getAlertRecipients("service_alerts");
  if (!resend || emails.length === 0) {
    console.log("Email notifications not configured, skipping recovery email");
    return false;
  }

  const { serviceName, previousStatus, timestamp, downSince } = data;
  const dashboardUrl = `${getAppUrl()}/settings/infrastructure`;
  const time = new Date(timestamp).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });

  let downtimeDuration = "";
  if (downSince) {
    const ms = new Date(timestamp).getTime() - new Date(downSince).getTime();
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) {
      downtimeDuration = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      downtimeDuration = `${hours}h ${mins}m`;
    }
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: emails,
      subject: `✅ MACt Service Restored - ${serviceName} Back Online`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="background: #16a34a; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">✅ Service Restored</h1>
              </div>
              <div style="padding: 24px;">
                <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  Great news! A previously ${previousStatus} service has been restored.
                </p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #166534;">Service:</strong>
                    <span style="color: #1e293b;">${serviceName}</span>
                  </p>
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #166534;">Status:</strong>
                    <span style="color: #16a34a; font-weight: 600;">Operational</span>
                  </p>
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #166534;">Recovered At:</strong>
                    <span style="color: #1e293b;">${time}</span>
                  </p>
                  ${downtimeDuration ? `
                    <p style="margin: 0; font-size: 14px;">
                      <strong style="color: #166534;">Downtime:</strong>
                      <span style="color: #1e293b;">${downtimeDuration}</span>
                    </p>
                  ` : ""}
                </div>
                <div style="text-align: center;">
                  <a href="${dashboardUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 15px;">
                    View Infrastructure Dashboard →
                  </a>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                  Automated alert from MACt monitoring system
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`Service recovery email sent for ${serviceName}`);
    return true;
  } catch (error) {
    console.error("Failed to send service recovery email:", error);
    return false;
  }
}

interface HandoffRequestEmailData {
  visitorName?: string;
  visitorEmail?: string;
  reason?: string;
  conversationId: string;
  conversationSummary?: string;
}

export async function sendHandoffRequestEmail(
  data: HandoffRequestEmailData
): Promise<boolean> {
  const emails = await getAlertRecipients("handoff_requests");
  if (!resend || emails.length === 0) {
    console.log("Email notifications not configured, skipping handoff email");
    return false;
  }

  const { visitorName, visitorEmail, reason, conversationId, conversationSummary } = data;
  const inboxUrl = `${getAppUrl()}/inbox?id=${conversationId}`;
  const displayName = visitorName || visitorEmail || "Visitor";

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: emails,
      subject: `🚨 Handoff requested from ${displayName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background: #dc2626; color: white; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">⚠️ Human Handoff Requested</h1>
              </div>

              <!-- Content -->
              <div style="padding: 24px;">
                <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  A visitor has requested to speak with a human agent. Please respond as soon as possible.
                </p>

                <!-- Visitor Info -->
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px 0; font-size: 14px;">
                    <strong style="color: #991b1b;">Visitor:</strong>
                    <span style="color: #1e293b;">${visitorName || "Unknown"}</span>
                  </p>
                  ${visitorEmail ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px;">
                      <strong style="color: #991b1b;">Email:</strong>
                      <a href="mailto:${visitorEmail}" style="color: #dc2626; text-decoration: none;">${visitorEmail}</a>
                    </p>
                  ` : ""}
                  ${reason ? `
                    <p style="margin: 0; font-size: 14px;">
                      <strong style="color: #991b1b;">Reason:</strong>
                      <span style="color: #1e293b;">${reason}</span>
                    </p>
                  ` : ""}
                </div>

                ${conversationSummary ? `
                  <!-- Conversation Summary -->
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">
                      Recent Messages
                    </p>
                    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${conversationSummary}</p>
                  </div>
                ` : ""}

                <!-- CTA Button -->
                <div style="text-align: center;">
                  <a href="${inboxUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 15px;">
                    Take Over Conversation →
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: #fef2f2; padding: 16px; text-align: center; border-top: 1px solid #fecaca;">
                <p style="margin: 0; color: #991b1b; font-size: 12px;">
                  Conversation ID: ${conversationId}
                </p>
              </div>
            </div>

            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
              Sent by MACt Chatbot
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`Handoff request email sent to ${emails.join(", ")}`);
    return true;
  } catch (error) {
    console.error("Failed to send handoff request email:", error);
    return false;
  }
}
