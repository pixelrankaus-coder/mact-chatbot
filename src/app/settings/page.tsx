"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSidebar } from "@/components/settings";
import { toast } from "sonner";
import {
  MessageSquare,
  Bot,
  Clock,
  Users,
  Zap,
  Shield,
  Globe,
} from "lucide-react";

export default function LiveChatSettings() {
  const [chatEnabled, setChatEnabled] = useState(true);
  const [aiHandoff, setAiHandoff] = useState(true);
  const [autoAssign, setAutoAssign] = useState(true);
  const [responseTime, setResponseTime] = useState("immediate");
  const [maxConcurrent, setMaxConcurrent] = useState("5");

  const handleSave = () => {
    toast.success("Live chat settings saved!");
  };

  return (
    <div className="flex h-full">
      <SettingsSidebar />

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Live Chat</h1>
          <p className="text-sm text-slate-500">
            Configure your live chat settings and behavior
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* Enable Live Chat */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <MessageSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Enable Live Chat
                      </h3>
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
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                      <Bot className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        AI to Human Handoff
                      </h3>
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
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <Users className="mr-2 inline h-4 w-4" />
                  Chat Assignment
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
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
                    <Label className="text-sm text-slate-600">
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
                </div>
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <Clock className="mr-2 inline h-4 w-4" />
                  Response Time
                </h3>
                <div>
                  <Label className="text-sm text-slate-600">
                    Expected response time shown to visitors
                  </Label>
                  <Select value={responseTime} onValueChange={setResponseTime}>
                    <SelectTrigger className="mt-1 w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-green-500" />
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
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <Shield className="mr-2 inline h-4 w-4" />
                  Security & Privacy
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        Require email before chat
                      </p>
                      <p className="text-sm text-slate-500">
                        Visitors must provide email to start chatting
                      </p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        Save chat transcripts
                      </p>
                      <p className="text-sm text-slate-500">
                        Store conversation history for future reference
                      </p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        GDPR compliance mode
                      </p>
                      <p className="text-sm text-slate-500">
                        Show consent notice and data processing information
                      </p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Allowed Domains */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <Globe className="mr-2 inline h-4 w-4" />
                  Allowed Domains
                </h3>
                <p className="mb-3 text-sm text-slate-500">
                  Specify which domains can display your chat widget
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="example.com"
                    defaultValue="mact.au"
                  />
                  <Input placeholder="Add another domain..." />
                </div>
                <Button variant="outline" size="sm" className="mt-3">
                  + Add Domain
                </Button>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
