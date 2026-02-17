"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { BellIcon, ClockIcon, AlertTriangleIcon, CheckCircleIcon, ServerCrashIcon } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ServiceAlert {
  id: string;
  service_name: string;
  previous_status: string | null;
  current_status: string;
  details: string | null;
  created_at: string;
  notified?: boolean;
}

const POLL_INTERVAL = 60_000; // Check for new alerts every 60 seconds
const HEALTH_CHECK_INTERVAL = 15 * 60_000; // Run health check every 15 minutes

const Notifications = () => {
  const isMobile = useIsMobile();
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const consecutiveErrors = useRef(0);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/infrastructure/alerts?limit=20");
      if (res.ok) {
        consecutiveErrors.current = 0;
        const data = await res.json();
        setAlerts(data.alerts || []);
        const unread = (data.alerts || []).some(
          (a: ServiceAlert) => !a.notified && (a.current_status === "down" || a.current_status === "degraded")
        );
        setHasUnread(unread);
      } else {
        consecutiveErrors.current++;
      }
    } catch {
      consecutiveErrors.current++;
    }
  }, []);

  // Run health check and detect changes
  const runHealthCheck = useCallback(async () => {
    // Stop retrying after 3 consecutive failures
    if (consecutiveErrors.current > 3) return;
    try {
      const res = await fetch("/api/infrastructure/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });
      if (!res.ok) consecutiveErrors.current++;
      // Fetch updated alerts after check
      await fetchAlerts();
    } catch {
      consecutiveErrors.current++;
    }
  }, [fetchAlerts]);

  // Mark alerts as read when dropdown is opened
  const handleOpenChange = useCallback(async (open: boolean) => {
    setIsOpen(open);
    if (open && hasUnread) {
      setHasUnread(false);
      try {
        await fetch("/api/infrastructure/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read", before: new Date().toISOString() }),
        });
      } catch {
        // Silently fail
      }
    }
  }, [hasUnread]);

  // Initial load + polling
  useEffect(() => {
    // Run initial health check
    runHealthCheck();

    // Poll for new alerts
    const alertInterval = setInterval(fetchAlerts, POLL_INTERVAL);

    // Periodic health checks
    const healthInterval = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);

    return () => {
      clearInterval(alertInterval);
      clearInterval(healthInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getAlertIcon = (status: string) => {
    if (status === "down") return <ServerCrashIcon className="size-4 text-red-500" />;
    if (status === "degraded") return <AlertTriangleIcon className="size-4 text-amber-500" />;
    return <CheckCircleIcon className="size-4 text-emerald-500" />;
  };

  const getAlertLabel = (alert: ServiceAlert) => {
    if (alert.current_status === "operational") {
      return `${alert.service_name} is back online`;
    }
    if (alert.current_status === "down") {
      return `${alert.service_name} is down`;
    }
    if (alert.current_status === "degraded") {
      return `${alert.service_name} is degraded`;
    }
    return `${alert.service_name} status changed`;
  };

  const getAlertDescription = (alert: ServiceAlert) => {
    if (alert.current_status === "operational" && alert.previous_status) {
      return `Recovered from ${alert.previous_status} state`;
    }
    return alert.details || `Changed from ${alert.previous_status || "unknown"} to ${alert.current_status}`;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" className="relative">
          <BellIcon className={cn(
            hasUnread && "text-red-500"
          )} />
          {hasUnread && (
            <span className="absolute end-0.5 top-0.5 block size-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={isMobile ? "center" : "end"} className="ms-4 w-80 p-0">
        <DropdownMenuLabel className="bg-background dark:bg-muted sticky top-0 z-10 p-0">
          <div className="flex justify-between border-b px-6 py-4">
            <div className="font-medium">Service Alerts</div>
            <Button variant="link" className="h-auto p-0 text-xs" size="icon-sm" asChild>
              <Link href="/settings/infrastructure">View all</Link>
            </Button>
          </div>
        </DropdownMenuLabel>

        <ScrollArea className="h-[350px]">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <CheckCircleIcon className="size-8 text-emerald-500" />
              <p className="text-sm font-medium">All systems operational</p>
              <p className="text-muted-foreground text-xs">No recent service alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                className="group flex cursor-pointer items-start gap-3 rounded-none border-b px-4 py-3"
                asChild>
                <Link href="/settings/infrastructure">
                  <div className="flex-none pt-0.5">
                    {getAlertIcon(alert.current_status)}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className={cn(
                      "text-sm font-medium",
                      alert.current_status === "down" && "text-red-600 dark:text-red-400",
                      alert.current_status === "degraded" && "text-amber-600 dark:text-amber-400",
                      alert.current_status === "operational" && "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {getAlertLabel(alert)}
                    </div>
                    <div className="text-muted-foreground line-clamp-1 text-xs">
                      {getAlertDescription(alert)}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                      <ClockIcon className="size-3!" />
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  {!alert.notified && (alert.current_status === "down" || alert.current_status === "degraded") && (
                    <div className="flex-0">
                      <span className="block size-2 rounded-full border bg-red-500/80" />
                    </div>
                  )}
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
