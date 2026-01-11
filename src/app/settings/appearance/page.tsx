"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  ChevronUp,
  Upload,
  Send,
  Home,
  MessageCircle,
  Bot,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppearanceSettings } from "@/hooks/use-settings";

const backgroundColors = [
  { value: "#1a1a2e", label: "Dark Navy", color: "#1a1a2e" },
  { value: "#0f172a", label: "Slate Dark", color: "#0f172a" },
  { value: "#18181b", label: "Zinc Dark", color: "#18181b" },
  { value: "#1e293b", label: "Slate", color: "#1e293b" },
  { value: "#292524", label: "Stone Dark", color: "#292524" },
  { value: "#ffffff", label: "White", color: "#ffffff" },
  { value: "#f8fafc", label: "Slate Light", color: "#f8fafc" },
];

const actionColors = [
  { value: "#3b82f6", label: "Blue", color: "#3b82f6" },
  { value: "#8b5cf6", label: "Purple", color: "#8b5cf6" },
  { value: "#10b981", label: "Green", color: "#10b981" },
  { value: "#f59e0b", label: "Amber", color: "#f59e0b" },
  { value: "#ef4444", label: "Red", color: "#ef4444" },
  { value: "#ec4899", label: "Pink", color: "#ec4899" },
  { value: "#06b6d4", label: "Cyan", color: "#06b6d4" },
];

export default function AppearancePage() {
  const { value: settings, loading, updateSetting } = useAppearanceSettings();

  const [generalOpen, setGeneralOpen] = useState(true);
  const [contentTab, setContentTab] = useState("home");
  const [saving, setSaving] = useState(false);

  // Local state for form fields
  const [backgroundColor, setBackgroundColor] = useState("#1a1a2e");
  const [actionColor, setActionColor] = useState("#3b82f6");
  const [welcomeTitle, setWelcomeTitle] = useState("Hi there!");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState("How can we help you today?");
  const [chatPlaceholder, setChatPlaceholder] = useState("Type your message...");
  const [agentName, setAgentName] = useState("MACt Assistant");
  const [position, setPosition] = useState("bottom-right");
  const [previewTab, setPreviewTab] = useState<"home" | "chat">("home");

  // Load settings from Supabase
  useEffect(() => {
    if (!loading && settings) {
      setBackgroundColor(settings.backgroundColor || "#1a1a2e");
      setActionColor(settings.actionColor || "#3b82f6");
      setWelcomeTitle(settings.welcomeTitle || "Hi there!");
      setWelcomeSubtitle(settings.welcomeSubtitle || "How can we help you today?");
      setChatPlaceholder(settings.chatPlaceholder || "Type your message...");
      setAgentName(settings.agentName || "MACt Assistant");
      setPosition(settings.position || "bottom-right");
    }
  }, [loading, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting({
        backgroundColor,
        actionColor,
        welcomeTitle,
        welcomeSubtitle,
        chatPlaceholder,
        agentName,
        position,
      });
      toast.success("Settings saved successfully!", {
        description: "Your appearance settings have been updated.",
      });
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
      <div className="flex h-full">
        <SettingsSidebar />
        <div className="flex flex-1 items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <SettingsSidebar />

      {/* CENTER: Appearance Form */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Appearance</h1>
          <p className="text-sm text-slate-500">
            Customize how your chat widget looks on your website
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-2xl space-y-6">
            {/* General Section */}
            <Collapsible open={generalOpen} onOpenChange={setGeneralOpen}>
              <div className="rounded-lg border bg-white">
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4">
                  <h3 className="font-semibold text-slate-900">General</h3>
                  {generalOpen ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 border-t p-4">
                    {/* Background Color */}
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Background color
                      </Label>
                      <Select value={backgroundColor} onValueChange={setBackgroundColor}>
                        <SelectTrigger className="w-full">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded border"
                              style={{ backgroundColor: backgroundColor }}
                            />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {backgroundColors.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded border"
                                  style={{ backgroundColor: color.color }}
                                />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action Color */}
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Action color
                      </Label>
                      <Select value={actionColor} onValueChange={setActionColor}>
                        <SelectTrigger className="w-full">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded"
                              style={{ backgroundColor: actionColor }}
                            />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {actionColors.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded"
                                  style={{ backgroundColor: color.color }}
                                />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Brand Logo */}
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Brand logo
                      </Label>
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                          <Upload className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <Button variant="outline" size="sm">
                            Upload logo
                          </Button>
                          <p className="mt-1 text-xs text-slate-500">
                            PNG, JPG up to 2MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Content Section */}
            <div className="rounded-lg border bg-white">
              <div className="border-b p-4">
                <h3 className="font-semibold text-slate-900">Content</h3>
              </div>
              <Tabs value={contentTab} onValueChange={setContentTab}>
                <div className="border-b px-4">
                  <TabsList className="h-auto bg-transparent p-0">
                    <TabsTrigger
                      value="home"
                      className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Home
                    </TabsTrigger>
                    <TabsTrigger
                      value="chat"
                      className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Chat
                    </TabsTrigger>
                    <TabsTrigger
                      value="prechat"
                      className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Pre-chat survey
                    </TabsTrigger>
                    <TabsTrigger
                      value="minimized"
                      className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Minimized
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="home" className="p-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Welcome title
                      </Label>
                      <Input
                        value={welcomeTitle}
                        onChange={(e) => setWelcomeTitle(e.target.value)}
                        placeholder="Hi there!"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Welcome subtitle
                      </Label>
                      <Textarea
                        value={welcomeSubtitle}
                        onChange={(e) => setWelcomeSubtitle(e.target.value)}
                        placeholder="How can we help you today?"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Welcome image
                      </Label>
                      <RadioGroup defaultValue="default" className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="default" id="default" />
                          <Label htmlFor="default" className="text-sm">
                            Default
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="custom" />
                          <Label htmlFor="custom" className="text-sm">
                            Custom image
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="none" />
                          <Label htmlFor="none" className="text-sm">
                            None
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="chat" className="p-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Placeholder text
                      </Label>
                      <Input
                        value={chatPlaceholder}
                        onChange={(e) => setChatPlaceholder(e.target.value)}
                        placeholder="Type your message..."
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Agent display name
                      </Label>
                      <Input
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="Support Agent"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="prechat" className="p-4">
                  <div className="rounded-lg bg-slate-50 p-4 text-center">
                    <p className="text-sm text-slate-600">
                      Configure pre-chat survey to collect visitor information before starting a conversation.
                    </p>
                    <Button variant="outline" className="mt-3">
                      Configure Survey
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="minimized" className="p-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block text-sm font-medium">
                        Minimized message
                      </Label>
                      <Input
                        defaultValue="Chat with us!"
                        placeholder="Chat with us!"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Position Section */}
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-4 font-semibold text-slate-900">Position</h3>
              <RadioGroup
                value={position}
                onValueChange={setPosition}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bottom-left" id="bottom-left" />
                  <Label htmlFor="bottom-left" className="text-sm">
                    Bottom-left
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bottom-right" id="bottom-right" />
                  <Label htmlFor="bottom-right" className="text-sm">
                    Bottom-right
                  </Label>
                </div>
              </RadioGroup>
            </div>

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
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Live Widget Preview */}
      <div className="w-96 border-l bg-slate-100 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase text-slate-500">
          Preview
        </h3>

        {/* Widget Preview Container */}
        <div
          className={cn(
            "relative mx-auto w-80",
            position === "bottom-left" ? "mr-auto" : "ml-auto"
          )}
        >
          {/* Chat Widget */}
          <div
            className="overflow-hidden rounded-2xl shadow-2xl"
            style={{ backgroundColor: backgroundColor }}
          >
            {/* Widget Header */}
            <div className="relative p-4">
              <button className="absolute right-3 top-3 text-white/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>

              {previewTab === "home" ? (
                <div className="pt-4 text-center">
                  {/* Bot Avatar */}
                  <div
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: actionColor }}
                  >
                    <Bot className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">
                    {welcomeTitle}
                  </h4>
                  <p className="mt-1 text-sm text-white/70">
                    {welcomeSubtitle}
                  </p>

                  {/* Start Chat Button */}
                  <button
                    className="mt-6 w-full rounded-lg py-3 font-medium text-white transition-colors"
                    style={{ backgroundColor: actionColor }}
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                <div>
                  {/* Chat Header */}
                  <div className="flex items-center gap-3 pb-2">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: actionColor }}
                    >
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{agentName}</p>
                      <p className="text-xs text-white/60">Online</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Content */}
            {previewTab === "chat" && (
              <div className="bg-white p-4">
                {/* Messages */}
                <div className="mb-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: actionColor }}
                    >
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-lg rounded-tl-none bg-slate-100 p-3">
                      <p className="text-sm text-slate-700">
                        {welcomeSubtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-2">
                  <input
                    type="text"
                    placeholder={chatPlaceholder}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    disabled
                  />
                  <button
                    className="rounded-lg p-2 text-white"
                    style={{ backgroundColor: actionColor }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Widget Footer / Tabs */}
            <div
              className={cn(
                "flex border-t",
                previewTab === "home" ? "bg-transparent border-white/10" : "bg-white border-slate-200"
              )}
            >
              <button
                onClick={() => setPreviewTab("home")}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                  previewTab === "home"
                    ? previewTab === "home" ? "text-white" : "text-slate-900"
                    : previewTab === "home" ? "text-white/50" : "text-slate-400"
                )}
                style={previewTab === "home" ? { color: actionColor } : {}}
              >
                <Home className="h-5 w-5" />
                Home
              </button>
              <button
                onClick={() => setPreviewTab("chat")}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                  previewTab === "chat"
                    ? "text-slate-900"
                    : previewTab === "home" ? "text-white/50" : "text-slate-400"
                )}
                style={previewTab === "chat" ? { color: actionColor } : {}}
              >
                <MessageCircle className="h-5 w-5" />
                Chat
              </button>
            </div>

            {/* Powered By */}
            <div
              className={cn(
                "py-2 text-center text-xs",
                previewTab === "home" ? "text-white/40" : "bg-white text-slate-400"
              )}
            >
              Powered by <span className="font-medium">MACt</span>
            </div>
          </div>

          {/* Minimized Widget Button */}
          <div
            className={cn(
              "mt-4 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg",
              position === "bottom-left" ? "mr-auto w-fit" : "ml-auto w-fit"
            )}
            style={{ backgroundColor: actionColor }}
          >
            <MessageCircle className="h-6 w-6 text-white" />
            <span className="font-medium text-white">Chat with us!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
