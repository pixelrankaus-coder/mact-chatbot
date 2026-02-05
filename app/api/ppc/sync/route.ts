import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// POST: Trigger manual sync
export async function POST() {
  try {
    const supabase = await createClient();

    // Get active connection
    const { data: connection, error: connError } = await supabase
      .from("ppc_connections")
      .select("*")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "No active PPC connection found" },
        { status: 400 }
      );
    }

    // Check if already syncing
    if (connection.sync_status === "syncing") {
      return NextResponse.json(
        { error: "Sync already in progress" },
        { status: 409 }
      );
    }

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from("ppc_sync_log")
      .insert({
        connection_id: connection.id,
        sync_type: "manual",
        status: "running",
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating sync log:", logError);
    }

    // Update connection status
    await supabase
      .from("ppc_connections")
      .update({
        sync_status: "syncing",
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    // TODO: Implement actual Google Ads API sync
    // For now, we'll simulate the sync process
    // In production, this would:
    // 1. Refresh the access token if needed
    // 2. Query Google Ads API for campaign data
    // 3. Query for keyword data
    // 4. Query for geographic data
    // 5. Upsert the data into our tables

    // Simulate sync completion (in production, this would be async)
    const recordsSynced = 0; // Placeholder

    // Update sync log
    if (syncLog) {
      await supabase
        .from("ppc_sync_log")
        .update({
          completed_at: new Date().toISOString(),
          status: "success",
          records_synced: recordsSynced,
        })
        .eq("id", syncLog.id);
    }

    // Update connection
    await supabase
      .from("ppc_connections")
      .update({
        sync_status: "success",
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      records_synced: recordsSynced,
      sync_id: syncLog?.id,
    });
  } catch (error) {
    console.error("PPC sync error:", error);

    // Try to update status to error
    try {
      const supabase = await createClient();
      await supabase
        .from("ppc_connections")
        .update({
          sync_status: "error",
          sync_error: error instanceof Error ? error.message : "Unknown error",
          updated_at: new Date().toISOString(),
        })
        .eq("is_active", true);
    } catch (e) {
      console.error("Failed to update sync status:", e);
    }

    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET: Get sync status and history
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get active connection
    const { data: connection } = await supabase
      .from("ppc_connections")
      .select("id, sync_status, last_sync_at, sync_error")
      .eq("is_active", true)
      .single();

    if (!connection) {
      return NextResponse.json({
        status: null,
        history: [],
      });
    }

    // Get sync history
    const { data: history, error } = await supabase
      .from("ppc_sync_log")
      .select("*")
      .eq("connection_id", connection.id)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching sync history:", error);
    }

    return NextResponse.json({
      status: {
        current: connection.sync_status,
        last_sync: connection.last_sync_at,
        error: connection.sync_error,
      },
      history: history || [],
    });
  } catch (error) {
    console.error("PPC sync status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
