"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Cpu, Sparkles, Zap, DollarSign } from "lucide-react";
import { PROVIDERS, PRICING, type LLMProvider } from "@/lib/llm";

interface LLMSettings {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export default function AIProviderPage() {
  const [settings, setSettings] = useState<LLMSettings>({
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("llm_settings")
        .select("*")
        .eq("store_id", "default")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading settings:", error);
      }

      if (data) {
        setSettings({
          provider: data.provider as LLMProvider,
          model: data.model,
          temperature: parseFloat(data.temperature) || 0.7,
          maxTokens: data.max_tokens || 1000,
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    const providerKey = provider as LLMProvider;
    const defaultModel = PROVIDERS[providerKey].models[0].id;
    setSettings({ ...settings, provider: providerKey, model: defaultModel });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("llm_settings").upsert({
        store_id: "default",
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("AI Provider settings saved!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = PROVIDERS[settings.provider];
  const currentModel = currentProvider.models.find((m) => m.id === settings.model);
  const currentPricing = PRICING[settings.provider]?.[settings.model];

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "openai":
        return <Sparkles className="h-5 w-5 text-green-600" />;
      case "anthropic":
        return <Cpu className="h-5 w-5 text-orange-600" />;
      case "deepseek":
        return <Zap className="h-5 w-5 text-blue-600" />;
      default:
        return <Cpu className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Cpu className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Provider</h1>
              <p className="text-sm text-slate-500">Choose which AI model powers your chatbot</p>
            </div>
          </div>
        </div>
      </div>

        <div className="p-6">
          <div className="max-w-2xl space-y-6">
            {/* Provider Selection */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-blue-600" />
                  Provider
                </CardTitle>
                <CardDescription>
                  Select your preferred AI provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={settings.provider}
                  onValueChange={handleProviderChange}
                  className="space-y-3"
                >
                  {(Object.entries(PROVIDERS) as [LLMProvider, typeof PROVIDERS.openai][]).map(
                    ([key, provider]) => (
                      <div
                        key={key}
                        className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-slate-50 ${
                          settings.provider === key
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200"
                        }`}
                      >
                        <RadioGroupItem value={key} id={key} />
                        <Label
                          htmlFor={key}
                          className="flex flex-1 cursor-pointer items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {getProviderIcon(key)}
                            <div>
                              <div className="font-medium">{provider.name}</div>
                              <div className="text-sm text-slate-500">
                                {provider.description}
                              </div>
                            </div>
                          </div>
                          {key === "deepseek" && (
                            <Badge className="bg-green-100 text-green-700">
                              Best Value
                            </Badge>
                          )}
                          {key === "anthropic" && (
                            <Badge className="bg-purple-100 text-purple-700">
                              Most Capable
                            </Badge>
                          )}
                        </Label>
                      </div>
                    )
                  )}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Model Selection */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Model
                </CardTitle>
                <CardDescription>
                  Select the specific model to use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={settings.model}
                  onValueChange={(model) => setSettings({ ...settings, model })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentProvider.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-slate-500">
                            - {model.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {currentPricing && (
                  <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-4">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-blue-900">
                        Estimated Cost
                      </div>
                      <div className="text-xs text-blue-700">
                        ${currentPricing.input.toFixed(2)} input / $
                        {currentPricing.output.toFixed(2)} output per 1M tokens
                      </div>
                    </div>
                  </div>
                )}

                {currentModel && (
                  <div className="text-sm text-slate-500">
                    <strong>{currentModel.name}:</strong> {currentModel.description}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parameters */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Parameters</CardTitle>
                <CardDescription>
                  Fine-tune how the AI responds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="text-sm font-medium text-slate-700">
                      {settings.temperature.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[settings.temperature]}
                    onValueChange={([val]) =>
                      setSettings({ ...settings, temperature: val })
                    }
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Focused (0)</span>
                    <span>Balanced (0.5)</span>
                    <span>Creative (1)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Max Response Length</Label>
                    <span className="text-sm font-medium text-slate-700">
                      {settings.maxTokens} tokens
                    </span>
                  </div>
                  <Slider
                    value={[settings.maxTokens]}
                    onValueChange={([val]) =>
                      setSettings({ ...settings, maxTokens: val })
                    }
                    min={100}
                    max={4000}
                    step={100}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Short (100)</span>
                    <span>Medium (1000)</span>
                    <span>Long (4000)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </div>
  );
}
