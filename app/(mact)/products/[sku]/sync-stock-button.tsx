"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncStockButton({ sku }: { sku: string }) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(sku)}/sync-stock`, {
        method: "POST",
      });
      if (res.ok) {
        // Refresh server component data
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing..." : "Sync Stock"}
    </Button>
  );
}
