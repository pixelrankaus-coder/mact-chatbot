import { NextRequest, NextResponse } from "next/server";
import { scanForNewAutomations, processDueAutomations } from "@/lib/order-automations";

/**
 * GET/POST /api/cron/order-followups
 * TASK #095/#096: Order follow-up automation cron
 *
 * Runs on schedule to:
 * 1. Scan for new orders that qualify for follow-up automations
 * 2. Process due reminders and send follow-up emails
 *
 * Handles both:
 * - Quote follow-ups (ESTIMATED/DRAFT orders)
 * - COD invoice payment follow-ups (unpaid COD invoices)
 */

const MAX_REMINDERS_PER_RUN = 10;

async function handleRequest(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "development" && cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();

  try {
    // Step 1: Scan for new qualifying orders and update automation statuses
    console.log("[Order Followups] Scanning for new automations...");
    const scanResult = await scanForNewAutomations();
    console.log(
      `[Order Followups] Scan complete: ${scanResult.quotesCreated} quote automations created, ` +
      `${scanResult.codCreated} COD automations created, ` +
      `${scanResult.quotesCompleted + scanResult.codCompleted} completed`
    );

    // Step 2: Process due reminders
    console.log("[Order Followups] Processing due reminders...");
    const processResult = await processDueAutomations(MAX_REMINDERS_PER_RUN);
    console.log(
      `[Order Followups] Processing complete: ${processResult.sent} sent, ` +
      `${processResult.failed} failed, ${processResult.completed} completed`
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      scan: scanResult,
      process: {
        processed: processResult.processed,
        sent: processResult.sent,
        failed: processResult.failed,
        completed: processResult.completed,
        results: processResult.results,
      },
      duration,
    });
  } catch (error) {
    console.error("[Order Followups] Cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
