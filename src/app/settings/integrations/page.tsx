"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Eye,
  EyeOff,
  Loader2,
  Play,
  Terminal,
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

interface WooConfig {
  url: string;
  consumer_key: string;
  consumer_secret: string;
  is_enabled: boolean;
  has_credentials: boolean;
}

interface SyncLogEntry {
  level: "info" | "warn" | "error" | "success";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export default function IntegrationsSettings() {
  // Cin7 sync state
  const [cin7OrdersSync, setCin7OrdersSync] = useState<SyncData | null>(null);
  const [cin7CustomersSync, setCin7CustomersSync] = useState<SyncData | null>(null);
  const [cin7Syncing, setCin7Syncing] = useState(false);
  const [cin7SyncingType, setCin7SyncingType] = useState<string | null>(null);

  // WooCommerce sync state
  const [wooOrdersSync, setWooOrdersSync] = useState<SyncData | null>(null);
  const [wooCustomersSync, setWooCustomersSync] = useState<SyncData | null>(null);
  const [wooSyncing, setWooSyncing] = useState(false);
  const [wooSyncingType, setWooSyncingType] = useState<string | null>(null);

  // WooCommerce configuration state
  const [wooConfig, setWooConfig] = useState<WooConfig>({
    url: "",
    consumer_key: "",
    consumer_secret: "",
    is_enabled: false,
    has_credentials: false,
  });
  const [wooConfigLoading, setWooConfigLoading] = useState(true);
  const [wooSaving, setWooSaving] = useState(false);
  const [wooTesting, setWooTesting] = useState(false);
  const [showWooSecret, setShowWooSecret] = useState(false);
  const [showWooKey, setShowWooKey] = useState(false);

  // Real-time sync log state
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch WooCommerce config
  const fetchWooConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/integrations/woocommerce");
      if (res.ok) {
        const data = await res.json();
        setWooConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch WooCommerce config:", error);
    } finally {
      setWooConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    fetchWooConfig();
  }, [fetchWooConfig]);

  const fetchSyncStatus = async () => {
    try {
      // Fetch both Cin7 and WooCommerce sync status in parallel
      const [cin7Res, wooRes] = await Promise.all([
        fetch("/api/sync/cin7"),
        fetch("/api/sync/woocommerce"),
      ]);

      if (cin7Res.ok) {
        const data = await cin7Res.json();
        setCin7OrdersSync(data.orders);
        setCin7CustomersSync(data.customers);
      }

      if (wooRes.ok) {
        const data = await wooRes.json();
        setWooOrdersSync(data.orders);
        setWooCustomersSync(data.customers);
      }
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  };

  const triggerCin7Sync = async (type: "orders" | "customers" | "all") => {
    setCin7Syncing(true);
    setCin7SyncingType(type);
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
        toast.error(error.error || "Cin7 sync failed");
      }

      await fetchSyncStatus();
    } catch (error) {
      toast.error("Cin7 sync failed");
      console.error("Cin7 sync error:", error);
    } finally {
      setCin7Syncing(false);
      setCin7SyncingType(null);
    }
  };

  const triggerWooSync = async (type: "orders" | "customers" | "all") => {
    setWooSyncing(true);
    setWooSyncingType(type);
    try {
      const res = await fetch("/api/sync/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        toast.success(`WooCommerce ${type} sync completed!`);
      } else {
        const error = await res.json();
        toast.error(error.error || "WooCommerce sync failed");
      }

      await fetchSyncStatus();
    } catch (error) {
      toast.error("WooCommerce sync failed");
      console.error("WooCommerce sync error:", error);
    } finally {
      setWooSyncing(false);
      setWooSyncingType(null);
    }
  };

  // Save WooCommerce configuration
  const saveWooConfig = async (overrideEnabled?: boolean) => {
    setWooSaving(true);
    try {
      const res = await fetch("/api/settings/integrations/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: wooConfig.url,
          consumer_key: wooConfig.consumer_key,
          consumer_secret: wooConfig.consumer_secret,
          is_enabled: overrideEnabled !== undefined ? overrideEnabled : wooConfig.is_enabled,
        }),
      });

      if (res.ok) {
        toast.success("WooCommerce settings saved");
        await fetchWooConfig();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Save WooCommerce config error:", error);
    } finally {
      setWooSaving(false);
    }
  };

  // Test WooCommerce connection
  const testWooConnection = async () => {
    setWooTesting(true);
    try {
      const res = await fetch("/api/settings/integrations/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          url: wooConfig.url,
          consumer_key: wooConfig.consumer_key,
          consumer_secret: wooConfig.consumer_secret,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Connection successful!");
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch (error) {
      toast.error("Connection test failed");
      console.error("Test WooCommerce connection error:", error);
    } finally {
      setWooTesting(false);
    }
  };

  // Stream WooCommerce sync with real-time logs
  const streamWooSync = async (type: "orders" | "customers" | "all") => {
    setIsStreaming(true);
    setWooSyncing(true);
    setWooSyncingType(type);
    setSyncLogs([]);

    try {
      const res = await fetch("/api/sync/woocommerce/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventMatch = line.match(/event: (\w+)\ndata: (.+)/s);
            if (eventMatch) {
              const [, eventType, data] = eventMatch;
              try {
                const parsed = JSON.parse(data);
                if (eventType === "log") {
                  setSyncLogs((prev) => [...prev, parsed]);
                  // Auto-scroll to bottom
                  setTimeout(() => {
                    logContainerRef.current?.scrollTo({
                      top: logContainerRef.current.scrollHeight,
                      behavior: "smooth",
                    });
                  }, 50);
                } else if (eventType === "complete") {
                  toast.success("Sync completed!");
                } else if (eventType === "error") {
                  toast.error(parsed.message || "Sync error");
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      await fetchSyncStatus();
    } catch (error) {
      toast.error("Sync stream failed");
      console.error("Stream WooCommerce sync error:", error);
    } finally {
      setIsStreaming(false);
      setWooSyncing(false);
      setWooSyncingType(null);
    }
  };

  const [integrations, setIntegrations] = useState<Integration[]>([
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
                    <CardTitle className="text-base">Cin7 Synchronization</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerCin7Sync("all")}
                      disabled={cin7Syncing}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${cin7Syncing && cin7SyncingType === "all" ? "animate-spin" : ""}`}
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
                          onClick={() => triggerCin7Sync("orders")}
                          disabled={cin7Syncing}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${cin7Syncing && cin7SyncingType === "orders" ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                      {cin7OrdersSync?.lastSync ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {cin7OrdersSync.lastSync.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : cin7OrdersSync.lastSync.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            <span className="capitalize">{cin7OrdersSync.lastSync.status}</span>
                          </div>
                          <div className="text-slate-500">
                            {cin7OrdersSync.cachedCount.toLocaleString()} records cached
                          </div>
                          {cin7OrdersSync.lastSync.completed_at && (
                            <div className="text-slate-400 text-xs">
                              Last sync:{" "}
                              {formatDistanceToNow(new Date(cin7OrdersSync.lastSync.completed_at), {
                                addSuffix: true,
                              })}
                            </div>
                          )}
                          {cin7OrdersSync.lastSync.duration_ms && (
                            <div className="text-slate-400 text-xs">
                              Duration: {(cin7OrdersSync.lastSync.duration_ms / 1000).toFixed(1)}s
                            </div>
                          )}
                          {cin7OrdersSync.lastSync.error_message && (
                            <div className="text-red-500 text-xs">
                              {cin7OrdersSync.lastSync.error_message}
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
                          onClick={() => triggerCin7Sync("customers")}
                          disabled={cin7Syncing}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${cin7Syncing && cin7SyncingType === "customers" ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                      {cin7CustomersSync?.lastSync ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {cin7CustomersSync.lastSync.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : cin7CustomersSync.lastSync.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            <span className="capitalize">{cin7CustomersSync.lastSync.status}</span>
                          </div>
                          <div className="text-slate-500">
                            {cin7CustomersSync.cachedCount.toLocaleString()} records cached
                          </div>
                          {cin7CustomersSync.lastSync.completed_at && (
                            <div className="text-slate-400 text-xs">
                              Last sync:{" "}
                              {formatDistanceToNow(new Date(cin7CustomersSync.lastSync.completed_at), {
                                addSuffix: true,
                              })}
                            </div>
                          )}
                          {cin7CustomersSync.lastSync.duration_ms && (
                            <div className="text-slate-400 text-xs">
                              Duration: {(cin7CustomersSync.lastSync.duration_ms / 1000).toFixed(1)}s
                            </div>
                          )}
                          {cin7CustomersSync.lastSync.error_message && (
                            <div className="text-red-500 text-xs">
                              {cin7CustomersSync.lastSync.error_message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm">Never synced</div>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Cin7 data syncs automatically every 15 minutes. Use manual sync for immediate updates.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* WooCommerce Integration */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <ShoppingCart className="h-4 w-4" />
                WooCommerce Integration
              </h3>

              {/* WooCommerce Configuration */}
              <Card className="border-0 shadow-sm mb-4">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">WooCommerce Settings</CardTitle>
                      <CardDescription>Configure your WooCommerce store connection</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Enabled</span>
                      <Switch
                        checked={wooConfig.is_enabled}
                        onCheckedChange={(checked) => {
                          setWooConfig((prev) => ({ ...prev, is_enabled: checked }));
                          // Auto-save when toggle changes (if credentials exist)
                          if (wooConfig.has_credentials) {
                            saveWooConfig(checked);
                          }
                        }}
                        disabled={wooConfigLoading || wooSaving}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {wooConfigLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="woo-url">Store URL</Label>
                        <Input
                          id="woo-url"
                          placeholder="https://your-store.com"
                          value={wooConfig.url}
                          onChange={(e) =>
                            setWooConfig((prev) => ({ ...prev, url: e.target.value }))
                          }
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="woo-key">Consumer Key</Label>
                          <div className="relative">
                            <Input
                              id="woo-key"
                              type={showWooKey ? "text" : "password"}
                              placeholder="ck_xxxxxxxxxxxxxxxx"
                              value={wooConfig.consumer_key}
                              onChange={(e) =>
                                setWooConfig((prev) => ({ ...prev, consumer_key: e.target.value }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowWooKey(!showWooKey)}
                            >
                              {showWooKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="woo-secret">Consumer Secret</Label>
                          <div className="relative">
                            <Input
                              id="woo-secret"
                              type={showWooSecret ? "text" : "password"}
                              placeholder="cs_xxxxxxxxxxxxxxxx"
                              value={wooConfig.consumer_secret}
                              onChange={(e) =>
                                setWooConfig((prev) => ({ ...prev, consumer_secret: e.target.value }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowWooSecret(!showWooSecret)}
                            >
                              {showWooSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button onClick={() => saveWooConfig()} disabled={wooSaving}>
                          {wooSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          Save Settings
                        </Button>
                        <Button
                          variant="outline"
                          onClick={testWooConnection}
                          disabled={wooTesting || !wooConfig.url}
                        >
                          {wooTesting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Test Connection
                        </Button>
                      </div>

                      <p className="text-xs text-slate-400">
                        Generate API keys in WooCommerce → Settings → Advanced → REST API
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* WooCommerce Sync Status */}
              <Card className="border-0 shadow-sm mb-4">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Data Synchronization</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => streamWooSync("all")}
                        disabled={wooSyncing || !wooConfig.is_enabled}
                      >
                        {wooSyncing && wooSyncingType === "all" ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!wooConfig.is_enabled && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
                      <p className="text-sm text-amber-700">
                        WooCommerce integration is disabled. Enable it above to start syncing.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* WooCommerce Orders Sync */}
                    <div className="rounded-lg border bg-slate-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-purple-600" />
                          <span className="font-medium">Orders</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => streamWooSync("orders")}
                          disabled={wooSyncing || !wooConfig.is_enabled}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${wooSyncing && wooSyncingType === "orders" ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                      {wooOrdersSync?.lastSync ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {wooOrdersSync.lastSync.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : wooOrdersSync.lastSync.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            <span className="capitalize">{wooOrdersSync.lastSync.status}</span>
                          </div>
                          <div className="text-slate-500">
                            {wooOrdersSync.cachedCount.toLocaleString()} records cached
                          </div>
                          {wooOrdersSync.lastSync.completed_at && (
                            <div className="text-slate-400 text-xs">
                              Last sync:{" "}
                              {formatDistanceToNow(new Date(wooOrdersSync.lastSync.completed_at), {
                                addSuffix: true,
                              })}
                            </div>
                          )}
                          {wooOrdersSync.lastSync.duration_ms && (
                            <div className="text-slate-400 text-xs">
                              Duration: {(wooOrdersSync.lastSync.duration_ms / 1000).toFixed(1)}s
                            </div>
                          )}
                          {wooOrdersSync.lastSync.error_message && (
                            <div className="text-red-500 text-xs">
                              {wooOrdersSync.lastSync.error_message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm">Never synced</div>
                      )}
                    </div>

                    {/* WooCommerce Customers Sync */}
                    <div className="rounded-lg border bg-slate-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-indigo-600" />
                          <span className="font-medium">Customers</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => streamWooSync("customers")}
                          disabled={wooSyncing || !wooConfig.is_enabled}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${wooSyncing && wooSyncingType === "customers" ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </div>
                      {wooCustomersSync?.lastSync ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {wooCustomersSync.lastSync.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : wooCustomersSync.lastSync.status === "failed" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            <span className="capitalize">{wooCustomersSync.lastSync.status}</span>
                          </div>
                          <div className="text-slate-500">
                            {wooCustomersSync.cachedCount.toLocaleString()} records cached
                          </div>
                          {wooCustomersSync.lastSync.completed_at && (
                            <div className="text-slate-400 text-xs">
                              Last sync:{" "}
                              {formatDistanceToNow(new Date(wooCustomersSync.lastSync.completed_at), {
                                addSuffix: true,
                              })}
                            </div>
                          )}
                          {wooCustomersSync.lastSync.duration_ms && (
                            <div className="text-slate-400 text-xs">
                              Duration: {(wooCustomersSync.lastSync.duration_ms / 1000).toFixed(1)}s
                            </div>
                          )}
                          {wooCustomersSync.lastSync.error_message && (
                            <div className="text-red-500 text-xs">
                              {wooCustomersSync.lastSync.error_message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm">Never synced</div>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    WooCommerce data syncs automatically every 15 minutes when enabled.
                  </p>
                </CardContent>
              </Card>

              {/* Real-time Sync Log */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-slate-500" />
                      <CardTitle className="text-base">Sync Log</CardTitle>
                    </div>
                    {isStreaming && (
                      <Badge className="bg-green-100 text-green-700">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Live
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    ref={logContainerRef}
                    className="rounded-lg bg-slate-900 p-4 h-48 overflow-auto font-mono text-xs"
                  >
                    {syncLogs.length === 0 ? (
                      <p className="text-slate-500">Run a sync to see real-time progress...</p>
                    ) : (
                      syncLogs.map((log, i) => (
                        <div
                          key={i}
                          className={`py-0.5 ${
                            log.level === "error"
                              ? "text-red-400"
                              : log.level === "warn"
                              ? "text-amber-400"
                              : log.level === "success"
                              ? "text-green-400"
                              : "text-slate-300"
                          }`}
                        >
                          <span className="text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>{" "}
                          <span
                            className={`uppercase ${
                              log.level === "error"
                                ? "text-red-500"
                                : log.level === "warn"
                                ? "text-amber-500"
                                : log.level === "success"
                                ? "text-green-500"
                                : "text-blue-500"
                            }`}
                          >
                            [{log.level}]
                          </span>{" "}
                          {log.message}
                        </div>
                      ))
                    )}
                  </div>
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
