"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SettingsSidebar } from "@/components/settings";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Plug,
  ShoppingCart,
  Mail,
  MessageSquare,
  BarChart3,
  Webhook,
  ExternalLink,
  Check,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Package,
  Users,
} from "lucide-react";

interface SyncStatus {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

interface SyncData {
  lastSync: SyncStatus | null;
  cachedCount: number;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "ecommerce" | "communication" | "analytics" | "other";
  connected: boolean;
  comingSoon?: boolean;
}

export default function IntegrationsSettings() {
  const [ordersSync, setOrdersSync] = useState<SyncData | null>(null);
  const [customersSync, setCustomersSync] = useState<SyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingType, setSyncingType] = useState<string | null>(null);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch("/api/sync/cin7");
      if (res.ok) {
        const data = await res.json();
        setOrdersSync(data.orders);
        setCustomersSync(data.customers);
      }
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  };

  const triggerSync = async (type: "orders" | "customers" | "all") => {
    setSyncing(true);
    setSyncingType(type);
    try {
      const res = await fetch("/api/sync/cin7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        toast.success(`Cin7 ${type} sync completed!`);
      } else {
        const error = await res.json();
        toast.error(error.error || "Sync failed");
      }

      await fetchSyncStatus();
    } catch (error) {
      toast.error("Sync failed");
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
      setSyncingType(null);
    }
  };

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "woocommerce",
      name: "WooCommerce",
      description: "Sync orders, customers, and products from your store",
      icon: <ShoppingCart className="h-6 w-6" />,
      category: "ecommerce",
      connected: true,
    },
    {
      id: "shopify",
      name: "Shopify",
      description: "Connect your Shopify store for order and customer data",
      icon: <ShoppingCart className="h-6 w-6" />,
      category: "ecommerce",
      connected: false,
      comingSoon: true,
    },
    {
      id: "mailchimp",
      name: "Mailchimp",
      description: "Sync contacts and trigger email campaigns",
      icon: <Mail className="h-6 w-6" />,
      category: "communication",
      connected: false,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Get notifications and respond to chats from Slack",
      icon: <MessageSquare className="h-6 w-6" />,
      category: "communication",
      connected: false,
    },
    {
      id: "google-analytics",
      name: "Google Analytics",
      description: "Track chat events and conversions",
      icon: <BarChart3 className="h-6 w-6" />,
      category: "analytics",
      connected: true,
    },
    {
      id: "webhook",
      name: "Webhooks",
      description: "Send real-time events to your custom endpoints",
      icon: <Webhook className="h-6 w-6" />,
      category: "other",
      connected: false,
    },
  ]);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? { ...integration, connected: !integration.connected }
          : integration
      )
    );
    const integration = integrations.find((i) => i.id === id);
    if (integration) {
      if (integration.connected) {
        toast.success(`${integration.name} disconnected`);
      } else {
        toast.success(`${integration.name} connected!`);
      }
    }
  };

  const renderIntegrationCard = (integration: Integration) => (
    <Card
      key={integration.id}
      className={`border-0 shadow-sm ${integration.comingSoon ? "opacity-60" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                integration.connected
                  ? "bg-green-100 text-green-600"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {integration.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900">
                  {integration.name}
                </h4>
                {integration.connected && (
                  <Badge className="bg-green-100 text-green-700">
                    <Check className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {integration.comingSoon && (
                  <Badge className="bg-purple-100 text-purple-700">
                    Coming Soon
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {integration.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {integration.connected && !integration.comingSoon && (
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {!integration.comingSoon && (
              <Switch
                checked={integration.connected}
                onCheckedChange={() => toggleConnection(integration.id)}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ecommerceIntegrations = integrations.filter(
    (i) => i.category === "ecommerce"
  );
  const communicationIntegrations = integrations.filter(
    (i) => i.category === "communication"
  );
  const analyticsIntegrations = integrations.filter(
    (i) => i.category === "analytics"
  );
  const otherIntegrations = integrations.filter((i) => i.category === "other");

  return (
    <div className="flex h-full">
      <SettingsSidebar />

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500">
            Connect your favorite tools and services
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-4xl space-y-6">
            {/* Cin7 Data Sync */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <Database className="h-4 w-4" />
                Cin7 Data Sync
              </h3>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Data Synchronization</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync("all")}
                      disabled={syncing}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${syncing && syncingType === "all" ? "animate-spin" : ""}`}
                      />
                      Sync All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Orders Sync */}
                    <div className="rounded-lg border bg-slate-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Orders</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerSync("orders")}
                          disabled={syncing}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${syncing && syncingType === "orders" ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                      {ordersSync?.lastSync ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {ordersSync.lastSync.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : ordersSync.lastSync.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            <span className="capitalize">{ordersSync.lastSync.status}</span>
                          </div>
                          <div className="text-slate-500">
                            {ordersSync.cachedCount.toLocaleString()} records cached
                          </div>
                          {ordersSync.lastSync.completed_at && (
                            <div className="text-slate-400 text-xs">
                              Last sync:{" "}
                              {formatDistanceToNow(new Date(ordersSync.lastSync.completed_at), {
                                addSuffix: true,
                              })}
                            </div>
                          )}
                          {ordersSync.lastSync.duration_ms && (
                            <div className="text-slate-400 text-xs">
                              Duration: {(ordersSync.lastSync.duration_ms / 1000).toFixed(1)}s
                            </div>
                          )}
                          {ordersSync.lastSync.error_message && (
                            <div className="text-red-500 text-xs">
                              {ordersSync.lastSync.error_message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm">Never synced</div>
                      )}
                    </div>

                    {/* Customers Sync */}
                    <div className="rounded-lg border bg-slate-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Customers</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerSync("customers")}
                          disabled={syncing}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${syncing && syncingType === "customers" ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                      {customersSync?.lastSync ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {customersSync.lastSync.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : customersSync.lastSync.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            <span className="capitalize">{customersSync.lastSync.status}</span>
                          </div>
                          <div className="text-slate-500">
                            {customersSync.cachedCount.toLocaleString()} records cached
                          </div>
                          {customersSync.lastSync.completed_at && (
                            <div className="text-slate-400 text-xs">
                              Last sync:{" "}
                              {formatDistanceToNow(new Date(customersSync.lastSync.completed_at), {
                                addSuffix: true,
                              })}
                            </div>
                          )}
                          {customersSync.lastSync.duration_ms && (
                            <div className="text-slate-400 text-xs">
                              Duration: {(customersSync.lastSync.duration_ms / 1000).toFixed(1)}s
                            </div>
                          )}
                          {customersSync.lastSync.error_message && (
                            <div className="text-red-500 text-xs">
                              {customersSync.lastSync.error_message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm">Never synced</div>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Data syncs automatically every 15 minutes. Use manual sync for immediate updates.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* E-commerce */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <ShoppingCart className="h-4 w-4" />
                E-commerce
              </h3>
              <div className="space-y-3">
                {ecommerceIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* Communication */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <MessageSquare className="h-4 w-4" />
                Communication
              </h3>
              <div className="space-y-3">
                {communicationIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* Analytics */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </h3>
              <div className="space-y-3">
                {analyticsIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* Other */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <Plug className="h-4 w-4" />
                Developer Tools
              </h3>
              <div className="space-y-3">
                {otherIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* API Access */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Plug className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">API Access</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Build custom integrations with our REST API
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
