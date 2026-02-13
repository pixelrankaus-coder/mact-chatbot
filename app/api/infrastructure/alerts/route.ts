/**
 * Infrastructure Alerts API
 * TASK MACT #072
 *
 * GET: Fetch recent service alerts (for bell icon)
 * POST: Run health checks, detect status changes, send alerts
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { sendServiceAlertEmail, sendServiceRecoveryEmail } from "@/lib/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface ServiceHealth {
  name: string;
  type: string;
  status: "operational" | "degraded" | "down" | "unconfigured";
  responseTime: number | null;
  details?: string;
}

interface StatusCacheEntry {
  status: string;
  last_checked_at: string;
  last_changed_at: string;
}

interface ServiceAlert {
  id: string;
  service_name: string;
  previous_status: string | null;
  current_status: string;
  details: string | null;
  created_at: string;
}

// Debounce: don't send email for same service more than once per 10 minutes
const EMAIL_DEBOUNCE_MS = 10 * 60 * 1000;
const lastEmailSent: Record<string, number> = {};

/**
 * GET /api/infrastructure/alerts
 * Returns recent alerts for the notification bell
 */
export async function GET(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    // Try service_alerts table first
    const { data: alerts, error } = await supabase
      .from("service_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Table might not exist yet - fall back to settings-based cache
      const { data: settingsData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "service_alerts_log")
        .single();

      const alertLog = (settingsData?.value as ServiceAlert[]) || [];
      return NextResponse.json({
        alerts: unreadOnly
          ? alertLog.filter((a: ServiceAlert) => !a.details?.includes("[read]"))
          : alertLog,
        total: alertLog.length,
        source: "settings",
      });
    }

    return NextResponse.json({
      alerts: alerts || [],
      total: alerts?.length || 0,
      source: "table",
    });
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json({ alerts: [], total: 0, error: "Failed to fetch" });
  }
}

/**
 * POST /api/infrastructure/alerts
 * Run health checks, detect changes, create alerts
 *
 * Body: { action: "check" | "mark_read" | "clear", alertIds?: string[] }
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;
  const body = await request.json();
  const { action } = body;

  if (action === "mark_read") {
    return markAlertsRead(supabase, body.alertIds || body.before);
  }

  if (action === "clear") {
    return clearAlerts(supabase);
  }

  // Default: run health check and detect changes
  return runHealthCheckAndAlert(supabase);
}

async function runHealthCheckAndAlert(supabase: SupabaseAny) {
  try {
    // 1. Fetch current health status from our own endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const healthRes = await fetch(`${baseUrl}/api/infrastructure/health`, {
      signal: AbortSignal.timeout(30000),
    });

    if (!healthRes.ok) {
      return NextResponse.json({ error: "Health check failed" }, { status: 500 });
    }

    const healthData = await healthRes.json();
    const services: ServiceHealth[] = healthData.services;

    // 2. Get previous status cache from settings table
    const { data: cacheRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "service_status_cache")
      .single();

    const statusCache: Record<string, StatusCacheEntry> = (cacheRow?.value as Record<string, StatusCacheEntry>) || {};
    const now = new Date().toISOString();

    // 3. Detect changes and create alerts
    const newAlerts: Array<{
      service_name: string;
      previous_status: string | null;
      current_status: string;
      details: string | null;
      response_time: number | null;
    }> = [];

    const updatedCache: Record<string, StatusCacheEntry> = {};

    for (const service of services) {
      const prev = statusCache[service.name];
      const prevStatus = prev?.status || null;

      updatedCache[service.name] = {
        status: service.status,
        last_checked_at: now,
        last_changed_at: prevStatus !== service.status ? now : (prev?.last_changed_at || now),
      };

      // Only alert on meaningful status changes (skip unconfigured)
      if (prevStatus && prevStatus !== service.status && service.status !== "unconfigured" && prevStatus !== "unconfigured") {
        newAlerts.push({
          service_name: service.name,
          previous_status: prevStatus,
          current_status: service.status,
          details: service.details || null,
          response_time: service.responseTime,
        });
      }
    }

    // 4. Save updated cache to settings
    await supabase
      .from("settings")
      .upsert({
        key: "service_status_cache",
        value: updatedCache,
        updated_at: now,
      }, { onConflict: "key" });

    // 5. Store alerts and send emails
    let storedAlerts: ServiceAlert[] = [];

    if (newAlerts.length > 0) {
      // Try to insert into service_alerts table
      const { data: inserted, error: insertError } = await supabase
        .from("service_alerts")
        .insert(newAlerts.map(a => ({ ...a, created_at: now })))
        .select();

      if (insertError) {
        // Table doesn't exist - store in settings as fallback
        const { data: existingLog } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "service_alerts_log")
          .single();

        const alertLog = ((existingLog?.value as ServiceAlert[]) || []).slice(0, 100); // Keep last 100
        const newLogEntries = newAlerts.map((a, i) => ({
          id: `alert-${Date.now()}-${i}`,
          ...a,
          created_at: now,
        }));
        const updatedLog = [...newLogEntries, ...alertLog];

        await supabase
          .from("settings")
          .upsert({
            key: "service_alerts_log",
            value: updatedLog,
            updated_at: now,
          }, { onConflict: "key" });

        storedAlerts = newLogEntries as ServiceAlert[];
      } else {
        storedAlerts = inserted || [];
      }

      // 6. Send email alerts (with debouncing)
      for (const alert of newAlerts) {
        const debounceKey = `${alert.service_name}-${alert.current_status}`;
        const lastSent = lastEmailSent[debounceKey] || 0;

        if (Date.now() - lastSent > EMAIL_DEBOUNCE_MS) {
          const isDown = alert.current_status === "down" || alert.current_status === "degraded";
          const isRecovery = alert.previous_status === "down" || alert.previous_status === "degraded";

          if (isDown) {
            await sendServiceAlertEmail({
              serviceName: alert.service_name,
              status: alert.current_status,
              details: alert.details || undefined,
              timestamp: now,
            });
          } else if (isRecovery && alert.current_status === "operational") {
            await sendServiceRecoveryEmail({
              serviceName: alert.service_name,
              previousStatus: alert.previous_status!,
              timestamp: now,
              downSince: statusCache[alert.service_name]?.last_changed_at,
            });
          }

          lastEmailSent[debounceKey] = Date.now();
        }
      }
    }

    return NextResponse.json({
      checked: services.length,
      alerts: storedAlerts,
      changes: newAlerts.length,
      summary: healthData.summary,
    });
  } catch (error) {
    console.error("Infrastructure alert check failed:", error);
    return NextResponse.json(
      { error: "Alert check failed" },
      { status: 500 }
    );
  }
}

async function markAlertsRead(supabase: SupabaseAny, alertIdsOrBefore: string[] | string) {
  try {
    if (typeof alertIdsOrBefore === "string") {
      // Mark all alerts before a timestamp as read
      const { error } = await supabase
        .from("service_alerts")
        .update({ notified: true })
        .lte("created_at", alertIdsOrBefore);

      if (error) {
        // Fallback: clear from settings
        await supabase
          .from("settings")
          .upsert({
            key: "service_alerts_log",
            value: [],
            updated_at: new Date().toISOString(),
          }, { onConflict: "key" });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark alerts read:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

async function clearAlerts(supabase: SupabaseAny) {
  try {
    // Clear from service_alerts table
    await supabase.from("service_alerts").delete().neq("id", "");

    // Also clear settings fallback
    await supabase
      .from("settings")
      .upsert({
        key: "service_alerts_log",
        value: [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear alerts:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
