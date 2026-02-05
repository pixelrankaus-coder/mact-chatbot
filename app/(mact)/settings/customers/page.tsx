"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Crown, Clock, Sparkles, TrendingUp, UserPlus } from "lucide-react";

interface CustomerSegmentSettings {
  // VIP: minimum orders OR minimum spend
  vip_min_orders: number;
  vip_min_spend: number;
  // Dormant: no orders in X months
  dormant_months: number;
  // Active: X+ orders in last Y months
  active_min_orders: number;
  active_months: number;
  // New: first order within X days
  new_days: number;
}

const defaultSettings: CustomerSegmentSettings = {
  vip_min_orders: 5,
  vip_min_spend: 5000,
  dormant_months: 12,
  active_min_orders: 2,
  active_months: 6,
  new_days: 30,
};

export default function CustomerSegmentSettingsPage() {
  const [settings, setSettings] = useState<CustomerSegmentSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/customer-segments");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...defaultSettings, ...data });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/customer-segments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success("Customer segment settings saved!");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof CustomerSegmentSettings>(
    key: K,
    value: CustomerSegmentSettings[K]
  ) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Customer Segments</h1>
              <p className="text-sm text-slate-500">
                Configure how customers are classified into segments
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* VIP Settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <Crown className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">VIP Customers</CardTitle>
                    <p className="text-sm text-slate-500">
                      Customers meeting EITHER threshold are marked as VIP
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vip_min_orders">Minimum Orders</Label>
                    <Input
                      id="vip_min_orders"
                      type="number"
                      min="1"
                      value={settings.vip_min_orders}
                      onChange={(e) =>
                        updateSetting("vip_min_orders", parseInt(e.target.value) || 1)
                      }
                    />
                    <p className="text-xs text-slate-500">
                      Customers with this many orders qualify as VIP
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vip_min_spend">Minimum Total Spend ($)</Label>
                    <Input
                      id="vip_min_spend"
                      type="number"
                      min="0"
                      value={settings.vip_min_spend}
                      onChange={(e) =>
                        updateSetting("vip_min_spend", parseInt(e.target.value) || 0)
                      }
                    />
                    <p className="text-xs text-slate-500">
                      Customers spending this much qualify as VIP
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Current: {settings.vip_min_orders}+ orders OR ${settings.vip_min_spend.toLocaleString()}+ total spend
                </div>
              </CardContent>
            </Card>

            {/* Active Settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Active Customers</CardTitle>
                    <p className="text-sm text-slate-500">
                      Recently engaged customers with multiple orders
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="active_min_orders">Minimum Orders</Label>
                    <Input
                      id="active_min_orders"
                      type="number"
                      min="1"
                      value={settings.active_min_orders}
                      onChange={(e) =>
                        updateSetting("active_min_orders", parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="active_months">Within Last (Months)</Label>
                    <Input
                      id="active_months"
                      type="number"
                      min="1"
                      value={settings.active_months}
                      onChange={(e) =>
                        updateSetting("active_months", parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                  Current: {settings.active_min_orders}+ orders in the last {settings.active_months} months
                </div>
              </CardContent>
            </Card>

            {/* Dormant Settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <Clock className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Dormant Customers</CardTitle>
                    <p className="text-sm text-slate-500">
                      Previous customers who haven&apos;t ordered recently
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dormant_months">Inactive Period (Months)</Label>
                  <Input
                    id="dormant_months"
                    type="number"
                    min="1"
                    max="36"
                    value={settings.dormant_months}
                    onChange={(e) =>
                      updateSetting("dormant_months", parseInt(e.target.value) || 12)
                    }
                    className="max-w-xs"
                  />
                  <p className="text-xs text-slate-500">
                    Customers who have ordered before but nothing in this period
                  </p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  Current: No orders in the last {settings.dormant_months} months
                </div>
              </CardContent>
            </Card>

            {/* New Customer Settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">New Customers</CardTitle>
                    <p className="text-sm text-slate-500">
                      First-time buyers who recently made their first purchase
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_days">New Customer Window (Days)</Label>
                  <Input
                    id="new_days"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.new_days}
                    onChange={(e) =>
                      updateSetting("new_days", parseInt(e.target.value) || 30)
                    }
                    className="max-w-xs"
                  />
                  <p className="text-xs text-slate-500">
                    Customers whose first (and only) order was within this period
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  Current: First order within the last {settings.new_days} days
                </div>
              </CardContent>
            </Card>

            {/* Marketable Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Marketable Customers</CardTitle>
                    <p className="text-sm text-slate-500">
                      Customers who can be reached via email campaigns
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-purple-50 p-3 text-sm text-purple-800">
                  Any customer with a valid email address is considered marketable
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
