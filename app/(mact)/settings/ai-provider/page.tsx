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
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Cpu, Sparkles, Zap, DollarSign, Key, Eye, EyeOff, Play, CheckCircle, XCircle } from "lucide-react";
import { PROVIDERS, PRICING, type LLMProvider } from "@/lib/llm";

interface LLMSettings {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export default function AIProviderPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<LLMSettings>({
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // API Keys state
  const [keys, setKeys] = useState({
    openai_api_key: "",
    anthropic_api_key: "",
    deepseek_api_key: "",
  });
  const [keyStatus, setKeyStatus] = useState({
    has_openai: false, has_anthropic: false, has_deepseek: false,
    env_openai: false, env_anthropic: false, env_deepseek: false,
  });
  const [showKey, setShowKey] = useState({ openai: false, anthropic: false, deepseek: false });
  const [keySaving, setKeySaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});

  useEffect(() => {
    loadSettings();
    loadApiKeys();
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

  const loadApiKeys = async () => {
    try {
      const res = await fetch("/api/settings/ai-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys({
          openai_api_key: data.openai_api_key,
          anthropic_api_key: data.anthropic_api_key,
          deepseek_api_key: data.deepseek_api_key,
        });
        setKeyStatus({
          has_openai: data.has_openai,
          has_anthropic: data.has_anthropic,
          has_deepseek: data.has_deepseek,
          env_openai: data.env_openai,
          env_anthropic: data.env_anthropic,
          env_deepseek: data.env_deepseek,
        });
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  };

  const saveApiKeys = async () => {
    setKeySaving(true);
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", ...keys }),
      });
      const data = await res.json();
      if (data.success) {
        setKeys({
          openai_api_key: data.openai_api_key,
          anthropic_api_key: data.anthropic_api_key,
          deepseek_api_key: data.deepseek_api_key,
        });
        setKeyStatus((prev) => ({
          ...prev,
          has_openai: data.has_openai,
          has_anthropic: data.has_anthropic,
          has_deepseek: data.has_deepseek,
        }));
        toast.success("API keys saved!");
      } else {
        toast.error(data.error || "Failed to save keys");
      }
    } catch {
      toast.error("Failed to save API keys");
    } finally {
      setKeySaving(false);
    }
  };

  const testConnection = async (provider: string) => {
    setTestingProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: null }));
    try {
      const res = await fetch("/api/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", provider }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [provider]: data }));
      if (data.success) {
        toast.success(`${provider} connection successful!`);
      } else {
        toast.error(data.message || `${provider} connection failed`);
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [provider]: { success: false, message: "Request failed" } }));
      toast.error("Connection test failed");
    } finally {
      setTestingProvider(null);
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

            {/* API Keys */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-red-600" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Manage your AI provider API keys. Keys stored here override environment variables.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(
                  [
                    { key: "openai", label: "OpenAI API Key", field: "openai_api_key", placeholder: "sk-...", has: keyStatus.has_openai, env: keyStatus.env_openai },
                    { key: "anthropic", label: "Anthropic API Key", field: "anthropic_api_key", placeholder: "sk-ant-...", has: keyStatus.has_anthropic, env: keyStatus.env_anthropic },
                    { key: "deepseek", label: "DeepSeek API Key", field: "deepseek_api_key", placeholder: "sk-...", has: keyStatus.has_deepseek, env: keyStatus.env_deepseek },
                  ] as const
                ).map((provider) => (
                  <div key={provider.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${provider.key}-key`}>{provider.label}</Label>
                      <div className="flex items-center gap-1.5">
                        {testResults[provider.key]?.success === true && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        )}
                        {testResults[provider.key]?.success === false && (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {provider.has && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-200">DB</Badge>
                        )}
                        {provider.env && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500 border-slate-200">ENV</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`${provider.key}-key`}
                          type={showKey[provider.key as keyof typeof showKey] ? "text" : "password"}
                          placeholder={provider.placeholder}
                          value={keys[provider.field]}
                          onChange={(e) => setKeys({ ...keys, [provider.field]: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() =>
                            setShowKey((prev) => ({
                              ...prev,
                              [provider.key]: !prev[provider.key as keyof typeof prev],
                            }))
                          }
                        >
                          {showKey[provider.key as keyof typeof showKey] ? (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => testConnection(provider.key)}
                        disabled={testingProvider === provider.key}
                        title="Test connection"
                      >
                        {testingProvider === provider.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  onClick={saveApiKeys}
                  disabled={keySaving}
                  variant="outline"
                  className="w-full"
                >
                  {keySaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Keys...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Save API Keys
                    </>
                  )}
                </Button>

                <p className="text-xs text-slate-400">
                  Keys are stored securely in the database. Environment variables are used as fallback when no database key is set.
                </p>
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
