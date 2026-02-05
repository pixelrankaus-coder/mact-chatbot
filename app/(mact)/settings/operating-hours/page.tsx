"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, Globe, Bot, Mail, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useOperatingHoursSettings } from "@/hooks/use-settings";

interface DaySchedule {
  day: string;
  shortDay: string;
  enabled: boolean;
  start: string;
  end: string;
}

const timezones = [
  { value: "Australia/Perth", label: "Australia/Perth (AWST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEDT)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEDT)" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane (AEST)" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide (ACDT)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZDT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "Europe/London", label: "London (GMT)" },
];

const timeOptions = [
  "12:00 AM", "12:30 AM", "1:00 AM", "1:30 AM", "2:00 AM", "2:30 AM",
  "3:00 AM", "3:30 AM", "4:00 AM", "4:30 AM", "5:00 AM", "5:30 AM",
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM",
  "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
];

const defaultSchedule: DaySchedule[] = [
  { day: "Monday", shortDay: "Mon", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Tuesday", shortDay: "Tue", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Wednesday", shortDay: "Wed", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Thursday", shortDay: "Thu", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Friday", shortDay: "Fri", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Saturday", shortDay: "Sat", enabled: false, start: "10:00 AM", end: "2:00 PM" },
  { day: "Sunday", shortDay: "Sun", enabled: false, start: "10:00 AM", end: "2:00 PM" },
];

export default function OperatingHoursPage() {
  const { value: settings, loading, updateSetting } = useOperatingHoursSettings();
  const [saving, setSaving] = useState(false);

  // Local state for form fields
  const [timezone, setTimezone] = useState("Australia/Perth");
  const [operatingHoursEnabled, setOperatingHoursEnabled] = useState(true);
  const [outsideHoursBehavior, setOutsideHoursBehavior] = useState("ai-agent");
  const [offlineMessage, setOfflineMessage] = useState(
    "We're currently offline. Please leave your email and message, and we'll get back to you as soon as possible."
  );
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);

  // Load settings from Supabase
  useEffect(() => {
    if (!loading && settings) {
      setTimezone(settings.timezone || "Australia/Perth");
      setOperatingHoursEnabled(settings.enabled !== false);
      setOutsideHoursBehavior(settings.outsideHoursBehavior || "ai-agent");
      setOfflineMessage(settings.offlineMessage || "We're currently offline. Please leave your email and message, and we'll get back to you as soon as possible.");
      if (settings.schedule && Array.isArray(settings.schedule)) {
        setSchedule(settings.schedule as DaySchedule[]);
      }
    }
  }, [loading, settings]);

  const updateSchedule = (
    index: number,
    field: keyof DaySchedule,
    value: string | boolean
  ) => {
    setSchedule((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const applyToWeekdays = () => {
    const mondaySchedule = schedule[0];
    setSchedule((prev) =>
      prev.map((item, i) => {
        if (i < 5) {
          return {
            ...item,
            enabled: mondaySchedule.enabled,
            start: mondaySchedule.start,
            end: mondaySchedule.end,
          };
        }
        return item;
      })
    );
    toast.success("Schedule applied to all weekdays");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting({
        enabled: operatingHoursEnabled,
        timezone,
        schedule,
        outsideHoursBehavior,
        offlineMessage,
      });
      toast.success("Operating hours saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading settings...</p>
        </div>
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
        <h1 className="text-xl font-semibold text-slate-900">
          Operating Hours
        </h1>
          <p className="text-sm text-slate-500">
            Set when your team is available for live chat
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* Timezone */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <Label className="font-semibold text-slate-900">
                      Timezone
                    </Label>
                    <p className="text-sm text-slate-500">
                      All times are displayed in this timezone
                    </p>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="mt-2 w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enable Operating Hours */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                      <Clock className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Enable Operating Hours
                      </h3>
                      <p className="text-sm text-slate-500">
                        {operatingHoursEnabled
                          ? "Chat availability follows the schedule below"
                          : "Chat is always available (24/7)"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={operatingHoursEnabled}
                    onCheckedChange={setOperatingHoursEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Weekly Schedule */}
            {operatingHoursEnabled && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      Weekly Schedule
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyToWeekdays}
                    >
                      Apply to all weekdays
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {schedule.map((day, index) => (
                      <div
                        key={day.day}
                        className="flex items-center gap-4 rounded-lg border bg-white p-3"
                      >
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(v) =>
                            updateSchedule(index, "enabled", v)
                          }
                        />
                        <span className="w-28 font-medium text-slate-900">
                          {day.day}
                        </span>

                        {day.enabled ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Select
                              value={day.start}
                              onValueChange={(v) =>
                                updateSchedule(index, "start", v)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeOptions.map((time) => (
                                  <SelectItem key={`start-${time}`} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-slate-500">to</span>
                            <Select
                              value={day.end}
                              onValueChange={(v) =>
                                updateSchedule(index, "end", v)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeOptions.map((time) => (
                                  <SelectItem key={`end-${time}`} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className="flex-1 text-sm text-slate-400">
                            Closed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outside Hours Behavior */}
            {operatingHoursEnabled && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-slate-900">
                    Outside Operating Hours
                  </h3>
                  <p className="mb-4 text-sm text-slate-500">
                    Choose what happens when visitors try to chat outside your operating hours
                  </p>

                  <RadioGroup
                    value={outsideHoursBehavior}
                    onValueChange={setOutsideHoursBehavior}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3 rounded-lg border bg-white p-4">
                      <RadioGroupItem value="ai-agent" id="ai-agent" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="ai-agent" className="font-medium text-slate-900 cursor-pointer">
                            Show AI agent only
                          </Label>
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Recommended
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          AI agent handles all conversations. Visitors can request human support.
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                          <Bot className="h-4 w-4" />
                          AI will be available 24/7
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border bg-white p-4">
                      <RadioGroupItem value="offline-message" id="offline-message" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="offline-message" className="font-medium text-slate-900 cursor-pointer">
                          Show offline message and collect email
                        </Label>
                        <p className="mt-1 text-sm text-slate-500">
                          Display a message and ask visitors to leave their contact info
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                          <Mail className="h-4 w-4" />
                          Collects visitor emails for follow-up
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border bg-white p-4">
                      <RadioGroupItem value="hide-widget" id="hide-widget" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="hide-widget" className="font-medium text-slate-900 cursor-pointer">
                          Hide chat widget completely
                        </Label>
                        <p className="mt-1 text-sm text-slate-500">
                          The chat widget will not appear on your website outside hours
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                          <EyeOff className="h-4 w-4" />
                          Widget hidden from visitors
                        </div>
                      </div>
                    </div>
                  </RadioGroup>

                  {/* Offline Message Textarea */}
                  {outsideHoursBehavior === "offline-message" && (
                    <div className="mt-4">
                      <Label htmlFor="offline-msg" className="text-sm text-slate-600">
                        Offline message
                      </Label>
                      <Textarea
                        id="offline-msg"
                        value={offlineMessage}
                        onChange={(e) => setOfflineMessage(e.target.value)}
                        placeholder="Enter your offline message..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Current Status Preview */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Current Status
                </h3>
                {!operatingHoursEnabled ? (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <Clock className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700">Always Available</p>
                      <p className="text-sm text-green-600">
                        Your chat is available 24/7
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <Clock className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700">Online</p>
                      <p className="text-sm text-green-600">
                        Your chat is currently within operating hours
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Operating Hours"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
