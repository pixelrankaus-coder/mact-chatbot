"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Headphones,
  Bell,
  Clock,
  Save,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { HelpdeskSettings, TicketPriority } from "@/types/helpdesk";

export default function HelpdeskSettingsPage() {
  const [settings, setSettings] = useState<HelpdeskSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/helpdesk/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch("/api/helpdesk/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<HelpdeskSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const updateNotifications = (key: string, value: unknown) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            notifications: {
              ...prev.notifications,
              [key]: value,
            },
          }
        : null
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6" />
            Helpdesk Settings
          </h1>
          <p className="text-slate-500">
            Configure the helpdesk module for handling support tickets
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Enable/Disable */}
        <Card>
          <CardHeader>
            <CardTitle>Module Status</CardTitle>
            <CardDescription>
              Enable or disable the helpdesk module
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Helpdesk</p>
                <p className="text-sm text-slate-500">
                  When enabled, conversations that need human attention will
                  create support tickets
                </p>
              </div>
              <Switch
                checked={settings?.enabled || false}
                onCheckedChange={(checked) =>
                  updateSettings({ enabled: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Ticket Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Ticket Settings</CardTitle>
            <CardDescription>
              Configure how tickets are created and managed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-create tickets on handoff</p>
                <p className="text-sm text-slate-500">
                  Automatically create a ticket when the AI hands off to a human
                </p>
              </div>
              <Switch
                checked={settings?.auto_create_tickets || false}
                onCheckedChange={(checked) =>
                  updateSettings({ auto_create_tickets: checked })
                }
              />
            </div>

            <div className="pt-4 border-t">
              <Label>Default Priority</Label>
              <Select
                value={settings?.default_priority || "normal"}
                onValueChange={(value) =>
                  updateSettings({ default_priority: value as TicketPriority })
                }
              >
                <SelectTrigger className="w-48 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Configure email notifications for tickets
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email on new ticket</p>
                <p className="text-sm text-slate-500">
                  Send email when a new ticket is created
                </p>
              </div>
              <Switch
                checked={settings?.notifications?.email_on_new_ticket || false}
                onCheckedChange={(checked) =>
                  updateNotifications("email_on_new_ticket", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email on customer reply</p>
                <p className="text-sm text-slate-500">
                  Send email when a customer replies to a ticket
                </p>
              </div>
              <Switch
                checked={settings?.notifications?.email_on_reply || false}
                onCheckedChange={(checked) =>
                  updateNotifications("email_on_reply", checked)
                }
              />
            </div>

            <div className="pt-4 border-t">
              <Label>Notification Email</Label>
              <Input
                type="email"
                placeholder="support@example.com"
                value={settings?.notifications?.notification_email || ""}
                onChange={(e) =>
                  updateNotifications("notification_email", e.target.value)
                }
                className="mt-2 max-w-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Email address to receive notifications
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Snooze Options */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <div>
                <CardTitle>Snooze Options</CardTitle>
                <CardDescription>
                  Configure available snooze durations (in hours)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {(settings?.snooze_options || [1, 4, 24, 48]).map(
                (hours, index) => (
                  <div
                    key={index}
                    className="px-3 py-1 bg-slate-100 rounded-full text-sm"
                  >
                    {hours}h
                  </div>
                )
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Snooze options: 1 hour, 4 hours, 24 hours, 48 hours
            </p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
