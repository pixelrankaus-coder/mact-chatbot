"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageSquare,
  Bot,
  Clock,
  Users,
  Zap,
  Shield,
  ArrowLeft,
} from "lucide-react";

export default function LiveChatSettings() {
  const [chatEnabled, setChatEnabled] = useState(true);
  const [aiHandoff, setAiHandoff] = useState(true);
  const [autoAssign, setAutoAssign] = useState(true);
  const [responseTime, setResponseTime] = useState("immediate");
  const [maxConcurrent, setMaxConcurrent] = useState("5");
  const [requireEmail, setRequireEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // Load current prechat form setting
  useEffect(() => {
    fetch("/api/settings/prechat")
      .then((r) => r.json())
      .then((data) => {
        setRequireEmail(data.enabled === true);
      })
      .catch(() => {});
  }, []);

  // Toggle require email before chat (updates prechat_form setting)
  const handleRequireEmailToggle = async (checked: boolean) => {
    setRequireEmail(checked);
    setSavingEmail(true);
    try {
      const res = await fetch("/api/settings/prechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: checked,
          title: "Start a conversation",
          subtitle: "Please fill in your details to begin",
          fields: [
            { id: "name", type: "text", label: "Name", placeholder: "Your name", required: true },
            { id: "email", type: "email", label: "Email", placeholder: "your@email.com", required: true },
          ],
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(checked ? "Email required before chat" : "Email no longer required");
    } catch {
      setRequireEmail(!checked); // revert on error
      toast.error("Failed to update setting");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSave = () => {
    toast.success("Live chat settings saved!");
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        {/* Header with back link */}
        <div className="mb-6">
          <Link
            href="/settings"
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Chat</h1>
              <p className="text-sm text-slate-500">
                Configure your live chat settings and behavior
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-3xl space-y-4">
          {/* Enable Live Chat */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-slate-50">
                    <MessageSquare className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Enable Live Chat</h3>
                    <p className="text-sm text-slate-500">
                      Allow visitors to start conversations on your website
                    </p>
                  </div>
                </div>
                <Switch
                  checked={chatEnabled}
                  onCheckedChange={setChatEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Handoff */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-slate-50">
                    <Bot className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">AI to Human Handoff</h3>
                    <p className="text-sm text-slate-500">
                      Let AI handle initial conversations and hand off to agents when needed
                    </p>
                  </div>
                </div>
                <Switch
                  checked={aiHandoff}
                  onCheckedChange={setAiHandoff}
                />
              </div>
            </CardContent>
          </Card>

          {/* Chat Assignment */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Users className="h-5 w-5" />
                Chat Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-900">Auto-assign chats</p>
                  <p className="text-sm text-slate-500">
                    Automatically assign new chats to available agents
                  </p>
                </div>
                <Switch
                  checked={autoAssign}
                  onCheckedChange={setAutoAssign}
                />
              </div>

              <div>
                <Label className="text-sm text-slate-500">
                  Max concurrent chats per agent
                </Label>
                <Select value={maxConcurrent} onValueChange={setMaxConcurrent}>
                  <SelectTrigger className="mt-1 w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 chats</SelectItem>
                    <SelectItem value="5">5 chats</SelectItem>
                    <SelectItem value="10">10 chats</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Response Time */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Clock className="h-5 w-5" />
                Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm text-slate-500">
                  Expected response time shown to visitors
                </Label>
                <Select value={responseTime} onValueChange={setResponseTime}>
                  <SelectTrigger className="mt-1 w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        Typically replies instantly
                      </div>
                    </SelectItem>
                    <SelectItem value="few-minutes">
                      Within a few minutes
                    </SelectItem>
                    <SelectItem value="hour">Within an hour</SelectItem>
                    <SelectItem value="day">Within a day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Shield className="h-5 w-5" />
                Security & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-900">Require email before chat</p>
                  <p className="text-sm text-slate-500">
                    Visitors must provide email to start chatting
                  </p>
                </div>
                <Switch
                  checked={requireEmail}
                  onCheckedChange={handleRequireEmailToggle}
                  disabled={savingEmail}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-900">Save chat transcripts</p>
                  <p className="text-sm text-slate-500">
                    Store conversation history for future reference
                  </p>
                </div>
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-900">GDPR compliance mode</p>
                  <p className="text-sm text-slate-500">
                    Show consent notice and data processing information
                  </p>
                </div>
                <Switch defaultChecked={true} />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
