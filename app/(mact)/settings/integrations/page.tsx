"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
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
  TrendingUp,
  Unplug,
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

interface Cin7Config {
  account_id: string;
  api_key: string;
  is_enabled: boolean;
  has_credentials: boolean;
  // Sync settings (TASK #039)
  sync_frequency: string;
  last_sync_at: string | null;
  orders_cached: number;
  customers_cached: number;
}

interface KlaviyoConfig {
  api_key: string;
  list_id: string;
  is_enabled: boolean;
  has_credentials: boolean;
}

interface KlaviyoList {
  id: string;
  name: string;
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
  const [activeSyncSource, setActiveSyncSource] = useState<"cin7" | "woo" | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Cin7 configuration state
  const [cin7Config, setCin7Config] = useState<Cin7Config>({
    account_id: "",
    api_key: "",
    is_enabled: false,
    has_credentials: false,
    sync_frequency: "1hour",
    last_sync_at: null,
    orders_cached: 0,
    customers_cached: 0,
  });
  const [cin7SyncMode, setCin7SyncMode] = useState<"full" | "incremental">("full");
  const [cin7ConfigLoading, setCin7ConfigLoading] = useState(true);
  const [cin7Saving, setCin7Saving] = useState(false);
  const [cin7Testing, setCin7Testing] = useState(false);
  const [showCin7AccountId, setShowCin7AccountId] = useState(false);
  const [showCin7ApiKey, setShowCin7ApiKey] = useState(false);

  // Klaviyo configuration state
  const [klaviyoConfig, setKlaviyoConfig] = useState<KlaviyoConfig>({
    api_key: "",
    list_id: "",
    is_enabled: false,
    has_credentials: false,
  });
  const [klaviyoConfigLoading, setKlaviyoConfigLoading] = useState(true);
  const [klaviyoSaving, setKlaviyoSaving] = useState(false);
  const [klaviyoTesting, setKlaviyoTesting] = useState(false);
  const [showKlaviyoKey, setShowKlaviyoKey] = useState(false);
  const [klaviyoLists, setKlaviyoLists] = useState<KlaviyoList[]>([]);
  const [klaviyoLoadingLists, setKlaviyoLoadingLists] = useState(false);

  // Google Ads PPC connection state
  interface PPCConnection {
    id: string;
    customer_id: string;
    account_name: string | null;
    last_sync_at: string | null;
    sync_status: string;
    sync_error: string | null;
    is_active: boolean;
  }
  const [ppcConnection, setPpcConnection] = useState<PPCConnection | null>(null);
  const [ppcLoading, setPpcLoading] = useState(true);
  const [ppcDisconnecting, setPpcDisconnecting] = useState(false);
  const [ppcConnecting, setPpcConnecting] = useState(false);

  // Google Ads account discovery state
  interface PPCAccount {
    id: string;
    name: string;
    currencyCode: string | null;
    timeZone: string | null;
    isManager: boolean;
  }
  const [ppcAccounts, setPpcAccounts] = useState<PPCAccount[]>([]);
  const [ppcLoadingAccounts, setPpcLoadingAccounts] = useState(false);
  const [ppcSelectingAccount, setPpcSelectingAccount] = useState(false);

  // Google Ads credentials state
  interface GoogleAdsConfig {
    client_id: string;
    client_secret: string;
    developer_token: string;
    is_enabled: boolean;
    has_credentials: boolean;
  }
  const [googleAdsConfig, setGoogleAdsConfig] = useState<GoogleAdsConfig>({
    client_id: "",
    client_secret: "",
    developer_token: "",
    is_enabled: false,
    has_credentials: false,
  });
  const [googleAdsConfigLoading, setGoogleAdsConfigLoading] = useState(true);
  const [googleAdsSaving, setGoogleAdsSaving] = useState(false);
  const [showGoogleClientId, setShowGoogleClientId] = useState(false);
  const [showGoogleClientSecret, setShowGoogleClientSecret] = useState(false);
  const [showGoogleDevToken, setShowGoogleDevToken] = useState(false);

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

  // Fetch Cin7 config
  const fetchCin7Config = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/integrations/cin7");
      if (res.ok) {
        const data = await res.json();
        setCin7Config(data);
      }
    } catch (error) {
      console.error("Failed to fetch Cin7 config:", error);
    } finally {
      setCin7ConfigLoading(false);
    }
  }, []);

  // Fetch Klaviyo config
  const fetchKlaviyoConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/integrations/klaviyo");
      if (res.ok) {
        const data = await res.json();
        setKlaviyoConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch Klaviyo config:", error);
    } finally {
      setKlaviyoConfigLoading(false);
    }
  }, []);

  // Fetch Google Ads config
  const fetchGoogleAdsConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/integrations/google-ads");
      if (res.ok) {
        const data = await res.json();
        setGoogleAdsConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch Google Ads config:", error);
    } finally {
      setGoogleAdsConfigLoading(false);
    }
  }, []);

  // Save Google Ads config
  const saveGoogleAdsConfig = async () => {
    setGoogleAdsSaving(true);
    try {
      const res = await fetch("/api/settings/integrations/google-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: googleAdsConfig.client_id,
          client_secret: googleAdsConfig.client_secret,
          developer_token: googleAdsConfig.developer_token,
          is_enabled: true,
        }),
      });

      if (res.ok) {
        toast.success("Google Ads credentials saved");
        fetchGoogleAdsConfig();
      } else {
        toast.error("Failed to save credentials");
      }
    } catch (error) {
      toast.error("Failed to save credentials");
      console.error("Save Google Ads config error:", error);
    } finally {
      setGoogleAdsSaving(false);
    }
  };

  // Fetch PPC connection
  const fetchPpcConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/ppc/connection");
      if (res.ok) {
        const data = await res.json();
        setPpcConnection(data.connection);
      }
    } catch (error) {
      console.error("Failed to fetch PPC connection:", error);
    } finally {
      setPpcLoading(false);
    }
  }, []);

  // Disconnect PPC
  const disconnectPpc = async () => {
    setPpcDisconnecting(true);
    try {
      const res = await fetch("/api/ppc/connection", { method: "DELETE" });
      if (res.ok) {
        toast.success("Google Ads disconnected");
        setPpcConnection(null);
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      toast.error("Failed to disconnect");
      console.error("Disconnect PPC error:", error);
    } finally {
      setPpcDisconnecting(false);
    }
  };

  // Connect PPC (initiate OAuth flow)
  const connectPpc = async () => {
    setPpcConnecting(true);
    try {
      const res = await fetch("/api/ppc/oauth/authorize");
      if (res.ok) {
        const data = await res.json();
        if (!data.authUrl) {
          toast.error("Google OAuth not configured. Set GOOGLE_CLIENT_ID in environment.");
          setPpcConnecting(false);
          return;
        }
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to start authorization");
        setPpcConnecting(false);
      }
    } catch (error) {
      toast.error("Failed to start authorization");
      console.error("Connect PPC error:", error);
      setPpcConnecting(false);
    }
    // Note: Don't reset ppcConnecting on success since we're redirecting
  };

  // Fetch PPC accounts for selection
  const fetchPpcAccounts = useCallback(async () => {
    setPpcLoadingAccounts(true);
    try {
      const res = await fetch("/api/ppc/oauth/accounts");
      if (res.ok) {
        const data = await res.json();
        setPpcAccounts(data.accounts || []);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to fetch accounts");
      }
    } catch (error) {
      toast.error("Failed to fetch accounts");
      console.error("Fetch PPC accounts error:", error);
    } finally {
      setPpcLoadingAccounts(false);
    }
  }, []);

  // Select a PPC account
  const selectPpcAccount = async (accountId: string, accountName: string) => {
    setPpcSelectingAccount(true);
    try {
      const res = await fetch("/api/ppc/oauth/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: accountId, accountName }),
      });

      if (res.ok) {
        toast.success("Google Ads account selected!");
        fetchPpcConnection();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to select account");
      }
    } catch (error) {
      toast.error("Failed to select account");
      console.error("Select PPC account error:", error);
    } finally {
      setPpcSelectingAccount(false);
    }
  };

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ppcSuccess = params.get("ppc_success");
    const ppcError = params.get("ppc_error");

    if (ppcSuccess) {
      toast.success("Google Ads connected! Please select an account.");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh connection status and fetch accounts
      fetchPpcConnection();
      fetchPpcAccounts();
    } else if (ppcError) {
      toast.error(`Google Ads connection failed: ${ppcError}`);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchPpcConnection, fetchPpcAccounts]);

  // Fetch accounts when connection exists but needs account selection
  useEffect(() => {
    if (ppcConnection && ppcConnection.customer_id === "pending" && ppcAccounts.length === 0 && !ppcLoadingAccounts) {
      fetchPpcAccounts();
    }
  }, [ppcConnection, ppcAccounts.length, ppcLoadingAccounts, fetchPpcAccounts]);

  useEffect(() => {
    fetchSyncStatus();
    fetchWooConfig();
    fetchCin7Config();
    fetchKlaviyoConfig();
    fetchPpcConnection();
    fetchGoogleAdsConfig();
  }, [fetchWooConfig, fetchCin7Config, fetchKlaviyoConfig, fetchPpcConnection, fetchGoogleAdsConfig]);

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

  // Save Cin7 configuration
  const saveCin7Config = async (overrideEnabled?: boolean) => {
    setCin7Saving(true);
    try {
      const res = await fetch("/api/settings/integrations/cin7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: cin7Config.account_id,
          api_key: cin7Config.api_key,
          is_enabled: overrideEnabled !== undefined ? overrideEnabled : cin7Config.is_enabled,
        }),
      });

      if (res.ok) {
        toast.success("Cin7 settings saved");
        await fetchCin7Config();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Save Cin7 config error:", error);
    } finally {
      setCin7Saving(false);
    }
  };

  // Test Cin7 connection
  const testCin7Connection = async () => {
    setCin7Testing(true);
    try {
      const res = await fetch("/api/settings/integrations/cin7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          account_id: cin7Config.account_id,
          api_key: cin7Config.api_key,
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
      console.error("Test Cin7 connection error:", error);
    } finally {
      setCin7Testing(false);
    }
  };

  // Stream Cin7 sync with real-time logs
  const streamCin7Sync = async (type: "orders" | "customers" | "all", mode: "full" | "incremental" = "full") => {
    setIsStreaming(true);
    setActiveSyncSource("cin7");
    setCin7Syncing(true);
    setCin7SyncingType(type);
    setSyncLogs([]);

    try {
      const res = await fetch("/api/sync/cin7/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, mode }),
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
                  setTimeout(() => {
                    logContainerRef.current?.scrollTo({
                      top: logContainerRef.current.scrollHeight,
                      behavior: "smooth",
                    });
                  }, 50);
                } else if (eventType === "complete") {
                  toast.success("Cin7 sync completed!");
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
      // Refresh Cin7 config to get updated sync stats
      await fetchCin7Config();
    } catch (error) {
      toast.error("Cin7 sync stream failed");
      console.error("Stream Cin7 sync error:", error);
    } finally {
      setIsStreaming(false);
      setActiveSyncSource(null);
      setCin7Syncing(false);
      setCin7SyncingType(null);
    }
  };

  // Save Klaviyo configuration
  const saveKlaviyoConfig = async (overrideEnabled?: boolean) => {
    setKlaviyoSaving(true);
    try {
      const res = await fetch("/api/settings/integrations/klaviyo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: klaviyoConfig.api_key,
          list_id: klaviyoConfig.list_id,
          is_enabled: overrideEnabled !== undefined ? overrideEnabled : klaviyoConfig.is_enabled,
        }),
      });

      if (res.ok) {
        toast.success("Klaviyo settings saved");
        await fetchKlaviyoConfig();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Save Klaviyo config error:", error);
    } finally {
      setKlaviyoSaving(false);
    }
  };

  // Test Klaviyo connection
  const testKlaviyoConnection = async () => {
    setKlaviyoTesting(true);
    try {
      const res = await fetch("/api/settings/integrations/klaviyo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          api_key: klaviyoConfig.api_key,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Connection successful!");
        // Fetch lists after successful connection test
        fetchKlaviyoLists();
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch (error) {
      toast.error("Connection test failed");
      console.error("Test Klaviyo connection error:", error);
    } finally {
      setKlaviyoTesting(false);
    }
  };

  // Fetch Klaviyo lists
  const fetchKlaviyoLists = async () => {
    setKlaviyoLoadingLists(true);
    try {
      const res = await fetch("/api/settings/integrations/klaviyo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lists",
          api_key: klaviyoConfig.api_key,
        }),
      });

      const data = await res.json();
      if (data.success && data.lists) {
        setKlaviyoLists(data.lists);
      }
    } catch (error) {
      console.error("Fetch Klaviyo lists error:", error);
    } finally {
      setKlaviyoLoadingLists(false);
    }
  };

  // Stream WooCommerce sync with real-time logs
  const streamWooSync = async (type: "orders" | "customers" | "all") => {
    setIsStreaming(true);
    setActiveSyncSource("woo");
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
      setActiveSyncSource(null);
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
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500">
          Connect your favorite tools and services
        </p>
      </div>

        <div className="p-6">
          <div className="max-w-4xl space-y-6">
            {/* Cin7 Integration */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <Database className="h-4 w-4" />
                Cin7 Integration
              </h3>

              {/* Cin7 Configuration */}
              <Card className="border-0 shadow-sm mb-4">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Cin7 Settings</CardTitle>
                      <CardDescription>Configure your Cin7 API connection</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Enabled</span>
                      <Switch
                        checked={cin7Config.is_enabled}
                        onCheckedChange={(checked) => {
                          setCin7Config((prev) => ({ ...prev, is_enabled: checked }));
                          if (cin7Config.has_credentials) {
                            saveCin7Config(checked);
                          }
                        }}
                        disabled={cin7ConfigLoading || cin7Saving}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cin7ConfigLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="cin7-account-id">Account ID</Label>
                          <div className="relative">
                            <Input
                              id="cin7-account-id"
                              type={showCin7AccountId ? "text" : "password"}
                              placeholder="Your Cin7 Account ID"
                              value={cin7Config.account_id}
                              onChange={(e) =>
                                setCin7Config((prev) => ({ ...prev, account_id: e.target.value }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowCin7AccountId(!showCin7AccountId)}
                            >
                              {showCin7AccountId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cin7-api-key">API Key</Label>
                          <div className="relative">
                            <Input
                              id="cin7-api-key"
                              type={showCin7ApiKey ? "text" : "password"}
                              placeholder="Your Cin7 API Key"
                              value={cin7Config.api_key}
                              onChange={(e) =>
                                setCin7Config((prev) => ({ ...prev, api_key: e.target.value }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowCin7ApiKey(!showCin7ApiKey)}
                            >
                              {showCin7ApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button onClick={() => saveCin7Config()} disabled={cin7Saving}>
                          {cin7Saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          Save Settings
                        </Button>
                        <Button
                          variant="outline"
                          onClick={testCin7Connection}
                          disabled={cin7Testing || (!cin7Config.account_id && !cin7Config.has_credentials)}
                        >
                          {cin7Testing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Test Connection
                        </Button>
                      </div>

                      <p className="text-xs text-slate-400">
                        Get API credentials from Cin7 → Integrations → API
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Cin7 Data Sync */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Data Synchronization</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => streamCin7Sync("all", "incremental")}
                        disabled={cin7Syncing || !cin7Config.is_enabled}
                        title="Incremental: Last 30 days only"
                      >
                        {cin7Syncing && cin7SyncingType === "all" && cin7SyncMode === "incremental" ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Quick Sync
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => streamCin7Sync("all", "full")}
                        disabled={cin7Syncing || !cin7Config.is_enabled}
                        title="Full: Fetch ALL data (slower)"
                      >
                        {cin7Syncing && cin7SyncingType === "all" && cin7SyncMode === "full" ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Database className="h-4 w-4 mr-2" />
                        )}
                        Full Sync
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!cin7Config.is_enabled && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
                      <p className="text-sm text-amber-700">
                        Cin7 integration is disabled. Enable it above to start syncing.
                      </p>
                    </div>
                  )}

                  {/* Sync Frequency Dropdown */}
                  <div className="mb-4">
                    <Label className="text-sm text-slate-600">Auto-sync Frequency</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={cin7Config.sync_frequency}
                        onChange={(e) => {
                          setCin7Config((prev) => ({ ...prev, sync_frequency: e.target.value }));
                          // Auto-save frequency change
                          fetch("/api/settings/integrations/cin7", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              account_id: cin7Config.account_id,
                              api_key: cin7Config.api_key,
                              is_enabled: cin7Config.is_enabled,
                              sync_frequency: e.target.value,
                            }),
                          }).then(() => toast.success("Sync frequency updated"));
                        }}
                        disabled={!cin7Config.is_enabled}
                      >
                        <option value="15min">Every 15 minutes</option>
                        <option value="1hour">Every hour</option>
                        <option value="6hours">Every 6 hours</option>
                        <option value="daily">Daily</option>
                        <option value="manual">Manual only</option>
                      </select>
                      {cin7Config.last_sync_at && (
                        <span className="text-xs text-slate-400">
                          Last: {formatDistanceToNow(new Date(cin7Config.last_sync_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>

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
                          onClick={() => streamCin7Sync("orders")}
                          disabled={cin7Syncing || !cin7Config.is_enabled}
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
                          onClick={() => streamCin7Sync("customers")}
                          disabled={cin7Syncing || !cin7Config.is_enabled}
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
                    Quick Sync fetches last 30 days only. Full Sync fetches all data (may take several minutes for large datasets).
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

            </div>

            {/* Real-time Sync Log (shared for Cin7 and WooCommerce) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-slate-500" />
                    <CardTitle className="text-base">Sync Log</CardTitle>
                    {activeSyncSource && (
                      <Badge variant="outline" className="text-xs">
                        {activeSyncSource === "cin7" ? "Cin7" : "WooCommerce"}
                      </Badge>
                    )}
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

            {/* Klaviyo Integration */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <Mail className="h-4 w-4" />
                Klaviyo Integration
              </h3>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Klaviyo Settings</CardTitle>
                      <CardDescription>Connect Klaviyo for email marketing and event tracking</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Enabled</span>
                      <Switch
                        checked={klaviyoConfig.is_enabled}
                        onCheckedChange={(checked) => {
                          setKlaviyoConfig((prev) => ({ ...prev, is_enabled: checked }));
                          if (klaviyoConfig.has_credentials) {
                            saveKlaviyoConfig(checked);
                          }
                        }}
                        disabled={klaviyoConfigLoading || klaviyoSaving}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {klaviyoConfigLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="klaviyo-api-key">Private API Key</Label>
                        <div className="relative">
                          <Input
                            id="klaviyo-api-key"
                            type={showKlaviyoKey ? "text" : "password"}
                            placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
                            value={klaviyoConfig.api_key}
                            onChange={(e) =>
                              setKlaviyoConfig((prev) => ({ ...prev, api_key: e.target.value }))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowKlaviyoKey(!showKlaviyoKey)}
                          >
                            {showKlaviyoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="klaviyo-list">Default List (Optional)</Label>
                        <div className="flex gap-2">
                          <select
                            id="klaviyo-list"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={klaviyoConfig.list_id}
                            onChange={(e) =>
                              setKlaviyoConfig((prev) => ({ ...prev, list_id: e.target.value }))
                            }
                          >
                            <option value="">No list selected</option>
                            {klaviyoLists.map((list) => (
                              <option key={list.id} value={list.id}>
                                {list.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchKlaviyoLists}
                            disabled={klaviyoLoadingLists || !klaviyoConfig.api_key || klaviyoConfig.api_key.includes("••••")}
                          >
                            {klaviyoLoadingLists ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400">
                          Subscribers from chat will be added to this list
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button onClick={() => saveKlaviyoConfig()} disabled={klaviyoSaving}>
                          {klaviyoSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          Save Settings
                        </Button>
                        <Button
                          variant="outline"
                          onClick={testKlaviyoConnection}
                          disabled={klaviyoTesting || (!klaviyoConfig.api_key && !klaviyoConfig.has_credentials)}
                        >
                          {klaviyoTesting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Test Connection
                        </Button>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3 mt-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Tracked Events</h4>
                        <ul className="text-xs text-slate-500 space-y-1">
                          <li>• Chat Started - When a visitor starts a chat</li>
                          <li>• Pre-Chat Form Submitted - When visitor submits their info</li>
                          <li>• Handoff Requested - When visitor requests human agent</li>
                          <li>• Chat Rated - When visitor rates the chat experience</li>
                        </ul>
                      </div>

                      <p className="text-xs text-slate-400">
                        Get your Private API Key from Klaviyo → Account → Settings → API Keys
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Google Ads PPC Integration */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <TrendingUp className="h-4 w-4" />
                Google Ads (PPC)
              </h3>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Google Ads Connection</CardTitle>
                      <CardDescription>Connect your Google Ads account for PPC performance tracking</CardDescription>
                    </div>
                    {ppcConnection && ppcConnection.customer_id !== "pending" && (
                      <Badge className="bg-green-100 text-green-700">
                        <Check className="mr-1 h-3 w-3" />
                        Connected
                      </Badge>
                    )}
                    {ppcConnection && ppcConnection.customer_id === "pending" && (
                      <Badge className="bg-amber-100 text-amber-700">
                        <Clock className="mr-1 h-3 w-3" />
                        Setup Required
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ppcLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : ppcConnection && ppcConnection.customer_id === "pending" ? (
                    <>
                      {/* Account Selection UI */}
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
                        <p className="text-sm text-amber-700 mb-2">
                          <strong>Account Selection Required</strong>
                        </p>
                        <p className="text-xs text-amber-600">
                          Google Ads is connected. Please select the account you want to use for tracking.
                        </p>
                      </div>

                      {ppcLoadingAccounts ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                          <span className="ml-2 text-sm text-slate-500">Loading accounts...</span>
                        </div>
                      ) : ppcAccounts.length > 0 ? (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Select an Account</Label>
                          <div className="grid gap-2">
                            {ppcAccounts.map((account) => (
                              <button
                                key={account.id}
                                onClick={() => selectPpcAccount(account.id, account.name)}
                                disabled={ppcSelectingAccount}
                                className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 hover:border-blue-300 transition-colors text-left disabled:opacity-50"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {account.name}
                                    {account.isManager && (
                                      <Badge variant="outline" className="ml-2 text-xs">Manager</Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    ID: {account.id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                                    {account.currencyCode && ` • ${account.currencyCode}`}
                                  </p>
                                </div>
                                {ppcSelectingAccount ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                ) : (
                                  <Check className="h-4 w-4 text-slate-400" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 p-4 text-center">
                          <p className="text-sm text-slate-600 mb-2">No accessible accounts found.</p>
                          <p className="text-xs text-slate-500">
                            Make sure your Google account has access to at least one Google Ads account.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={fetchPpcAccounts}
                            disabled={ppcLoadingAccounts}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={disconnectPpc}
                          disabled={ppcDisconnecting}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {ppcDisconnecting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Unplug className="h-4 w-4 mr-2" />
                          )}
                          Disconnect
                        </Button>
                      </div>
                    </>
                  ) : ppcConnection ? (
                    <>
                      {/* Connected state with account selected */}
                      <div className="rounded-lg bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {ppcConnection.account_name || "Google Ads Account"}
                            </p>
                            <p className="text-xs text-slate-500">
                              Customer ID: {ppcConnection.customer_id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {ppcConnection.sync_status === "success" && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {ppcConnection.sync_status === "error" && (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            {ppcConnection.sync_status === "syncing" && (
                              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                            )}
                          </div>
                        </div>
                        {ppcConnection.last_sync_at && (
                          <p className="text-xs text-slate-400">
                            Last synced: {formatDistanceToNow(new Date(ppcConnection.last_sync_at), { addSuffix: true })}
                          </p>
                        )}
                        {ppcConnection.sync_error && (
                          <p className="text-xs text-red-500">{ppcConnection.sync_error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={disconnectPpc}
                          disabled={ppcDisconnecting}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {ppcDisconnecting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Unplug className="h-4 w-4 mr-2" />
                          )}
                          Disconnect
                        </Button>
                        <Button variant="outline" asChild>
                          <a href="/ppc">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            View Dashboard
                          </a>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Step 1: API Credentials */}
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">API Credentials</p>
                        <p className="text-xs text-slate-500">
                          Enter your Google OAuth credentials. Get these from the{" "}
                          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Google Cloud Console
                          </a>.
                        </p>
                        {googleAdsConfigLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="googleClientId" className="text-xs">OAuth Client ID</Label>
                              <div className="relative">
                                <Input
                                  id="googleClientId"
                                  type={showGoogleClientId ? "text" : "password"}
                                  value={googleAdsConfig.client_id}
                                  onChange={(e) => setGoogleAdsConfig({ ...googleAdsConfig, client_id: e.target.value })}
                                  placeholder="123456789.apps.googleusercontent.com"
                                  className="pr-10 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowGoogleClientId(!showGoogleClientId)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  {showGoogleClientId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="googleClientSecret" className="text-xs">OAuth Client Secret</Label>
                              <div className="relative">
                                <Input
                                  id="googleClientSecret"
                                  type={showGoogleClientSecret ? "text" : "password"}
                                  value={googleAdsConfig.client_secret}
                                  onChange={(e) => setGoogleAdsConfig({ ...googleAdsConfig, client_secret: e.target.value })}
                                  placeholder="GOCSPX-..."
                                  className="pr-10 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowGoogleClientSecret(!showGoogleClientSecret)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  {showGoogleClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="googleDevToken" className="text-xs">Developer Token</Label>
                              <div className="relative">
                                <Input
                                  id="googleDevToken"
                                  type={showGoogleDevToken ? "text" : "password"}
                                  value={googleAdsConfig.developer_token}
                                  onChange={(e) => setGoogleAdsConfig({ ...googleAdsConfig, developer_token: e.target.value })}
                                  placeholder="Google Ads API Developer Token"
                                  className="pr-10 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowGoogleDevToken(!showGoogleDevToken)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  {showGoogleDevToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <Button
                              onClick={saveGoogleAdsConfig}
                              disabled={googleAdsSaving}
                              variant="outline"
                              size="sm"
                            >
                              {googleAdsSaving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-2" />
                              )}
                              Save Credentials
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Connect */}
                      <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-medium text-slate-700">Connect Account</p>
                        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                          <p className="text-sm text-blue-700 mb-3">
                            {googleAdsConfig.has_credentials
                              ? "Credentials saved. Click below to connect your Google Ads account."
                              : "Save your API credentials above first, then connect your account."}
                          </p>
                          <ul className="text-xs text-blue-600 space-y-1">
                            <li>• Campaign performance metrics (CTR, CPC, CPA, ROAS)</li>
                            <li>• Keyword-level analysis with quality scores</li>
                            <li>• Geographic performance breakdown</li>
                            <li>• AI recommendations for optimization</li>
                          </ul>
                        </div>
                        <Button
                          onClick={connectPpc}
                          disabled={ppcConnecting || !googleAdsConfig.has_credentials}
                          className="w-full sm:w-auto"
                        >
                          {ppcConnecting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <TrendingUp className="h-4 w-4 mr-2" />
                          )}
                          Connect Google Ads
                        </Button>
                        {!googleAdsConfig.has_credentials && (
                          <p className="text-xs text-amber-600">
                            Save your API credentials above before connecting.
                          </p>
                        )}
                      </div>
                    </>
                  )}
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
  );
}
