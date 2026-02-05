"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface FormField {
  id: string;
  type: "text" | "email" | "tel" | "select" | "textarea";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface PrechatConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  fields: FormField[];
}

const defaultConfig: PrechatConfig = {
  enabled: false,
  title: "Start a conversation",
  subtitle: "Please fill in your details to begin",
  fields: [
    { id: "name", type: "text", label: "Name", placeholder: "Your name", required: true },
    { id: "email", type: "email", label: "Email", placeholder: "your@email.com", required: true },
  ],
};

export default function PrechatSettingsPage() {
  const [config, setConfig] = useState<PrechatConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/prechat")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig({
            enabled: data.enabled ?? false,
            title: data.title || defaultConfig.title,
            subtitle: data.subtitle || defaultConfig.subtitle,
            fields: data.fields || defaultConfig.fields,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load prechat settings:", err);
        toast.error("Failed to load settings");
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/prechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        toast.success("Pre-chat form settings saved");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save");
      }
    } catch (err) {
      console.error("Failed to save prechat settings:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    setConfig((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          id: `field_${Date.now()}`,
          type: "text",
          label: "New Field",
          placeholder: "",
          required: false,
        },
      ],
    }));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((field, i) =>
        i === index ? { ...field, ...updates } : field
      ),
    }));
  };

  const removeField = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pre-chat Form</h1>
          <p className="text-sm text-slate-500">
            Collect visitor information before chat starts
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Enable/Disable Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Enable Pre-chat Form</Label>
              <p className="text-sm text-slate-500">
                Require visitors to fill out a form before starting a chat
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig((prev) => ({ ...prev, enabled }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Header Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Form Header</CardTitle>
          <CardDescription>
            Customize the title and subtitle shown on the pre-chat form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={config.title}
              onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Start a conversation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={config.subtitle}
              onChange={(e) => setConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Please fill in your details to begin"
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Fields */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Form Fields</CardTitle>
            <CardDescription>
              Configure the fields visitors need to fill out
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1 h-4 w-4" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.fields.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              No fields configured. Add a field to get started.
            </p>
          ) : (
            config.fields.map((field, index) => (
              <div
                key={field.id}
                className="flex gap-3 rounded-lg border bg-slate-50 p-4"
              >
                <div className="flex items-center text-slate-400">
                  <GripVertical className="h-5 w-5" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Field label"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(type: FormField["type"]) =>
                        updateField(index, { type })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="tel">Phone</SelectItem>
                        <SelectItem value="textarea">Text Area</SelectItem>
                        <SelectItem value="select">Dropdown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Placeholder</Label>
                    <Input
                      value={field.placeholder || ""}
                      onChange={(e) =>
                        updateField(index, { placeholder: e.target.value })
                      }
                      placeholder="Placeholder text"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(required) =>
                          updateField(index, { required })
                        }
                      />
                      <Label className="text-sm">Required</Label>
                    </div>
                  </div>
                  {field.type === "select" && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-500">
                        Options (comma separated)
                      </Label>
                      <Input
                        value={field.options?.join(", ") || ""}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value
                              .split(",")
                              .map((o) => o.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => removeField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {config.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This is how your pre-chat form will appear to visitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto max-w-sm rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{config.title}</h3>
              <p className="mb-4 text-sm text-slate-500">{config.subtitle}</p>
              <div className="space-y-4">
                {config.fields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-sm">
                      {field.label}
                      {field.required && <span className="ml-1 text-red-500">*</span>}
                    </Label>
                    {field.type === "select" ? (
                      <Select disabled>
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder || "Select..."} />
                        </SelectTrigger>
                      </Select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder={field.placeholder}
                        rows={3}
                        disabled
                      />
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        disabled
                      />
                    )}
                  </div>
                ))}
                <Button className="w-full" disabled>
                  Start Chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
