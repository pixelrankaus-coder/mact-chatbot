"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  MessageCircle,
  Loader2,
  HelpCircle,
  Languages,
  Palette,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppearanceSettings } from "@/hooks/use-settings";

const themeColors = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#6366f1", label: "Indigo" },
];

export default function AppearancePage() {
  const { value: settings, loading, updateSetting } = useAppearanceSettings();

  const [visibilityOpen, setVisibilityOpen] = useState(true);
  const [multilanguageOpen, setMultilanguageOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [deviceTab, setDeviceTab] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);

  // Visibility and position settings
  const [desktopDisplay, setDesktopDisplay] = useState(true);
  const [desktopPosition, setDesktopPosition] = useState<"left" | "right">("right");
  const [desktopButtonType, setDesktopButtonType] = useState<"corner" | "sidebar">("corner");
  const [mobileDisplay, setMobileDisplay] = useState(true);
  const [mobilePosition, setMobilePosition] = useState<"left" | "right">("right");
  const [mobileButtonSize, setMobileButtonSize] = useState(50); // 0-100 slider value

  // Color settings
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");

  // Advanced settings
  const [offsetX, setOffsetX] = useState(20);
  const [offsetY, setOffsetY] = useState(20);
  const [showWhenOffline, setShowWhenOffline] = useState(true);
  const [enableSounds, setEnableSounds] = useState(false);

  // Load settings from Supabase
  useEffect(() => {
    if (!loading && settings) {
      setPrimaryColor(settings.primaryColor as string || settings.actionColor as string || "#3b82f6");

      const desktop = settings.desktop as { display?: boolean; position?: "left" | "right"; buttonType?: "corner" | "sidebar" } | undefined;
      const mobile = settings.mobile as { display?: boolean; position?: "left" | "right"; buttonSize?: number } | undefined;

      if (desktop) {
        setDesktopDisplay(desktop.display !== false);
        setDesktopPosition(desktop.position || "right");
        setDesktopButtonType(desktop.buttonType || "corner");
      }
      if (mobile) {
        setMobileDisplay(mobile.display !== false);
        setMobilePosition(mobile.position || "right");
        setMobileButtonSize(typeof mobile.buttonSize === "number" ? mobile.buttonSize : 50);
      }
      setOffsetX(typeof settings.offsetX === "number" ? settings.offsetX : 20);
      setOffsetY(typeof settings.offsetY === "number" ? settings.offsetY : 20);
      setShowWhenOffline(settings.showWhenOffline !== false);
      setEnableSounds(settings.enableSounds === true);
    }
  }, [loading, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting({
        primaryColor,
        actionColor: primaryColor,
        desktop: {
          display: desktopDisplay,
          position: desktopPosition,
          buttonType: desktopButtonType,
        },
        mobile: {
          display: mobileDisplay,
          position: mobilePosition,
          buttonSize: mobileButtonSize,
        },
        offsetX,
        offsetY,
        showWhenOffline,
        enableSounds,
      });
      toast.success("Settings saved!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Get button size label
  const getButtonSizeLabel = (value: number) => {
    if (value <= 33) return "small";
    if (value <= 66) return "medium";
    return "large";
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentPosition = deviceTab === "desktop" ? desktopPosition : mobilePosition;

  // Remove unused variables lint warnings
  void getButtonSizeLabel;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Settings Form */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <div className="mb-6">
            <Link
              href="/settings"
              className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100">
                <Palette className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appearance</h1>
                <p className="text-sm text-slate-500">Customize how your chat widget looks</p>
              </div>
            </div>
          </div>
        </div>

          <div className="p-6">
            <div className="max-w-2xl space-y-4">
              {/* Visibility and Position Section */}
              <Card className="border-0 shadow-sm">
                <Collapsible open={visibilityOpen} onOpenChange={setVisibilityOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-5">
                    <h3 className="text-base font-semibold text-slate-900">
                      Visibility and position
                    </h3>
                    {visibilityOpen ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="border-t px-5 pb-5 pt-4">
                      {/* Desktop/Mobile Tabs */}
                      <Tabs value={deviceTab} onValueChange={(v) => setDeviceTab(v as "desktop" | "mobile")}>
                        <TabsList className="mb-6 grid w-48 grid-cols-2 bg-slate-100">
                          <TabsTrigger value="desktop" className="gap-2 data-[state=active]:bg-white">
                            <Monitor className="h-4 w-4" />
                            Desktop
                          </TabsTrigger>
                          <TabsTrigger value="mobile" className="gap-2 data-[state=active]:bg-white">
                            <Smartphone className="h-4 w-4" />
                            Mobile
                          </TabsTrigger>
                        </TabsList>

                        {/* Desktop Tab Content */}
                        <TabsContent value="desktop" className="space-y-6">
                          {/* Display Toggle */}
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-slate-700">Display</Label>
                            <Switch
                              checked={desktopDisplay}
                              onCheckedChange={setDesktopDisplay}
                            />
                          </div>

                          {/* Links */}
                          <div className="space-y-1">
                            <button className="text-sm text-blue-600 hover:underline">
                              Hide on specific pages
                            </button>
                            <br />
                            <button className="text-sm text-blue-600 hover:underline">
                              Hide or display for specific countries
                            </button>
                          </div>

                          {/* Widget Position - Visual Selector */}
                          <div>
                            <Label className="mb-4 block text-sm font-medium text-slate-700">
                              Widget position
                            </Label>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-slate-600">Left</span>

                              {/* Left Position Button */}
                              <button
                                type="button"
                                onClick={() => setDesktopPosition("left")}
                                className="relative"
                              >
                                <div className={cn(
                                  "flex h-20 w-16 items-end justify-start rounded-lg border-2 bg-white p-2 transition-colors",
                                  desktopPosition === "left"
                                    ? "border-blue-600"
                                    : "border-slate-200 hover:border-slate-300"
                                )}>
                                  <div className={cn(
                                    "h-3 w-3 rounded-full transition-colors",
                                    desktopPosition === "left" ? "bg-blue-600" : "bg-slate-300"
                                  )} />
                                </div>
                                <div className={cn(
                                  "absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full",
                                  desktopPosition === "left" ? "bg-blue-600" : "bg-transparent"
                                )} />
                              </button>

                              {/* Dotted line */}
                              <div className="flex items-center gap-1">
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                              </div>

                              {/* Right Position Button */}
                              <button
                                type="button"
                                onClick={() => setDesktopPosition("right")}
                                className="relative"
                              >
                                <div className={cn(
                                  "flex h-20 w-16 items-end justify-end rounded-lg border-2 bg-white p-2 transition-colors",
                                  desktopPosition === "right"
                                    ? "border-blue-600"
                                    : "border-slate-200 hover:border-slate-300"
                                )}>
                                  <div className={cn(
                                    "h-3 w-3 rounded-full transition-colors",
                                    desktopPosition === "right" ? "bg-blue-600" : "bg-slate-300"
                                  )} />
                                </div>
                                <div className={cn(
                                  "absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full",
                                  desktopPosition === "right" ? "bg-blue-600" : "bg-transparent"
                                )} />
                              </button>

                              {/* Dotted line */}
                              <div className="flex items-center gap-1">
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                              </div>

                              <span className="text-sm text-slate-600">Right</span>
                            </div>
                          </div>

                          {/* Button Type */}
                          <div>
                            <Label className="mb-3 block text-sm font-medium text-slate-700">
                              Button type
                            </Label>
                            <RadioGroup
                              value={desktopButtonType}
                              onValueChange={(v) => setDesktopButtonType(v as "corner" | "sidebar")}
                              className="flex gap-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="corner" id="desktop-corner" className="border-blue-600 text-blue-600" />
                                <Label htmlFor="desktop-corner" className="text-sm text-slate-700">
                                  Corner
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="sidebar" id="desktop-sidebar" />
                                <Label htmlFor="desktop-sidebar" className="text-sm text-slate-700">
                                  Sidebar
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Learn more link */}
                          <button className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                            <HelpCircle className="h-4 w-4" />
                            Learn about visibility and position
                          </button>
                        </TabsContent>

                        {/* Mobile Tab Content */}
                        <TabsContent value="mobile" className="space-y-6">
                          {/* Display Toggle */}
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-slate-700">Display</Label>
                            <Switch
                              checked={mobileDisplay}
                              onCheckedChange={setMobileDisplay}
                            />
                          </div>

                          {/* Links */}
                          <div className="space-y-1">
                            <button className="text-sm text-blue-600 hover:underline">
                              Hide on specific pages
                            </button>
                            <br />
                            <button className="text-sm text-blue-600 hover:underline">
                              Hide or display for specific countries
                            </button>
                          </div>

                          {/* Button Position - Phone outline visual */}
                          <div>
                            <Label className="mb-4 block text-sm font-medium text-slate-700">
                              Button position
                            </Label>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-slate-600">Left</span>

                              {/* Left Position - Phone outline */}
                              <button
                                type="button"
                                onClick={() => setMobilePosition("left")}
                                className="relative"
                              >
                                <div className={cn(
                                  "relative flex h-16 w-10 items-end justify-start rounded-lg border-2 p-1 transition-colors",
                                  mobilePosition === "left"
                                    ? "border-blue-600"
                                    : "border-slate-300 hover:border-slate-400"
                                )}>
                                  {/* Phone notch */}
                                  <div className="absolute left-1/2 top-1 h-1 w-4 -translate-x-1/2 rounded-full bg-slate-300" />
                                  {/* Button indicator */}
                                  <div className={cn(
                                    "h-2 w-2 rounded-full transition-colors",
                                    mobilePosition === "left" ? "bg-blue-600" : "bg-slate-300"
                                  )} />
                                </div>
                                {mobilePosition === "left" && (
                                  <div className="absolute -bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-600" />
                                )}
                              </button>

                              {/* Dotted line */}
                              <div className="flex items-center gap-1">
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                              </div>

                              {/* Right Position - Phone outline */}
                              <button
                                type="button"
                                onClick={() => setMobilePosition("right")}
                                className="relative"
                              >
                                <div className={cn(
                                  "relative flex h-16 w-10 items-end justify-end rounded-lg border-2 p-1 transition-colors",
                                  mobilePosition === "right"
                                    ? "border-blue-600"
                                    : "border-slate-300 hover:border-slate-400"
                                )}>
                                  {/* Phone notch */}
                                  <div className="absolute left-1/2 top-1 h-1 w-4 -translate-x-1/2 rounded-full bg-slate-300" />
                                  {/* Button indicator */}
                                  <div className={cn(
                                    "h-2 w-2 rounded-full transition-colors",
                                    mobilePosition === "right" ? "bg-blue-600" : "bg-slate-300"
                                  )} />
                                </div>
                                {mobilePosition === "right" && (
                                  <div className="absolute -bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-600" />
                                )}
                              </button>

                              {/* Dotted line */}
                              <div className="flex items-center gap-1">
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                                <div className="h-0.5 w-1 rounded-full bg-slate-300" />
                              </div>

                              <span className="text-sm text-slate-600">Right</span>
                            </div>
                          </div>

                          {/* Button Size Slider */}
                          <div>
                            <Label className="mb-4 block text-sm font-medium text-slate-700">
                              Button size
                            </Label>
                            <div className="space-y-3">
                              <Slider
                                value={[mobileButtonSize]}
                                onValueChange={(v) => setMobileButtonSize(v[0])}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                              <div className="flex justify-between text-sm text-slate-500">
                                <span>small</span>
                                <span>medium</span>
                                <span>large</span>
                              </div>
                            </div>
                          </div>

                          {/* Learn more link */}
                          <button className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                            <HelpCircle className="h-4 w-4" />
                            Learn about visibility and position
                          </button>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Multilanguage Section */}
              <Card className="border-0 shadow-sm">
                <Collapsible open={multilanguageOpen} onOpenChange={setMultilanguageOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-5">
                    <div className="flex items-center gap-2">
                      <Languages className="h-5 w-5 text-slate-500" />
                      <h3 className="text-base font-semibold text-slate-900">
                        Multilanguage
                      </h3>
                    </div>
                    {multilanguageOpen ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="border-t px-5 pb-5 pt-4">
                      <div className="rounded-lg bg-slate-50 p-4 text-center">
                        <p className="text-sm text-slate-600">
                          Configure multiple languages for your chat widget.
                        </p>
                        <Button variant="outline" className="mt-3" size="sm">
                          Add Language
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Colors Section */}
              <Card className="border-0 shadow-sm">
                <Collapsible open={colorsOpen} onOpenChange={setColorsOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-5">
                    <div className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-slate-500" />
                      <h3 className="text-base font-semibold text-slate-900">
                        Colors
                      </h3>
                    </div>
                    {colorsOpen ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="border-t px-5 pb-5 pt-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="mb-3 block text-sm font-medium text-slate-700">
                            Primary color
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {themeColors.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setPrimaryColor(color.value)}
                                className={cn(
                                  "h-10 w-10 rounded-full transition-all",
                                  primaryColor === color.value
                                    ? "ring-2 ring-offset-2"
                                    : "hover:scale-110"
                                )}
                                style={{
                                  backgroundColor: color.value,
                                  outlineColor: color.value
                                }}
                                title={color.label}
                              />
                            ))}
                            {/* Custom color input */}
                            <div className="relative">
                              <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="h-10 w-10 cursor-pointer rounded-full border-2 border-dashed border-slate-300"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Advanced Section */}
              <Card className="border-0 shadow-sm">
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-5">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-slate-500" />
                      <h3 className="text-base font-semibold text-slate-900">
                        Advanced
                      </h3>
                    </div>
                    {advancedOpen ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6 border-t px-5 pb-5 pt-4">
                      {/* Offset Controls */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-2 block text-sm font-medium text-slate-700">
                            Horizontal offset
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={offsetX}
                              onChange={(e) => setOffsetX(Number(e.target.value))}
                              className="w-20"
                              min={0}
                            />
                            <span className="text-sm text-slate-500">px</span>
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm font-medium text-slate-700">
                            Vertical offset
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={offsetY}
                              onChange={(e) => setOffsetY(Number(e.target.value))}
                              className="w-20"
                              min={0}
                            />
                            <span className="text-sm text-slate-500">px</span>
                          </div>
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium text-slate-700">
                              Show when offline
                            </Label>
                            <p className="text-xs text-slate-500">
                              Display widget when agents are offline
                            </p>
                          </div>
                          <Switch
                            checked={showWhenOffline}
                            onCheckedChange={setShowWhenOffline}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium text-slate-700">
                              Enable sounds
                            </Label>
                            <p className="text-xs text-slate-500">
                              Play notification sounds
                            </p>
                          </div>
                          <Switch
                            checked={enableSounds}
                            onCheckedChange={setEnableSounds}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Save Button */}
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
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="w-[400px] border-l bg-[#f5f5f5] p-6">
          {/* Preview Area with checkered background */}
          <div
            className="relative h-full rounded-lg"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
            }}
          >
            {/* Widget Preview */}
            <div
              className={cn(
                "absolute bottom-6",
                currentPosition === "right" ? "right-6" : "left-6"
              )}
            >
              {/* Chat bubble with text */}
              <div
                className={cn(
                  "flex items-center gap-3",
                  currentPosition === "right" ? "flex-row" : "flex-row-reverse"
                )}
              >
                <span className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-lg">
                  Chat with us
                  <span className="ml-1">&#128075;</span>
                </span>

                {/* Widget Button */}
                <button
                  className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
