"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SettingsSidebar } from "@/components/settings";
import { toast } from "sonner";
import {
  Plug,
  ShoppingCart,
  Mail,
  MessageSquare,
  BarChart3,
  Webhook,
  ExternalLink,
  Check,
  Settings,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "ecommerce" | "communication" | "analytics" | "other";
  connected: boolean;
  comingSoon?: boolean;
}

export default function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "woocommerce",
      name: "WooCommerce",
      description: "Sync orders, customers, and products from your store",
      icon: <ShoppingCart className="h-6 w-6" />,
      category: "ecommerce",
      connected: true,
    },
    {
      id: "shopify",
      name: "Shopify",
      description: "Connect your Shopify store for order and customer data",
      icon: <ShoppingCart className="h-6 w-6" />,
      category: "ecommerce",
      connected: false,
      comingSoon: true,
    },
    {
      id: "mailchimp",
      name: "Mailchimp",
      description: "Sync contacts and trigger email campaigns",
      icon: <Mail className="h-6 w-6" />,
      category: "communication",
      connected: false,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Get notifications and respond to chats from Slack",
      icon: <MessageSquare className="h-6 w-6" />,
      category: "communication",
      connected: false,
    },
    {
      id: "google-analytics",
      name: "Google Analytics",
      description: "Track chat events and conversions",
      icon: <BarChart3 className="h-6 w-6" />,
      category: "analytics",
      connected: true,
    },
    {
      id: "webhook",
      name: "Webhooks",
      description: "Send real-time events to your custom endpoints",
      icon: <Webhook className="h-6 w-6" />,
      category: "other",
      connected: false,
    },
  ]);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? { ...integration, connected: !integration.connected }
          : integration
      )
    );
    const integration = integrations.find((i) => i.id === id);
    if (integration) {
      if (integration.connected) {
        toast.success(`${integration.name} disconnected`);
      } else {
        toast.success(`${integration.name} connected!`);
      }
    }
  };

  const renderIntegrationCard = (integration: Integration) => (
    <Card
      key={integration.id}
      className={`border-0 shadow-sm ${integration.comingSoon ? "opacity-60" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                integration.connected
                  ? "bg-green-100 text-green-600"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {integration.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900">
                  {integration.name}
                </h4>
                {integration.connected && (
                  <Badge className="bg-green-100 text-green-700">
                    <Check className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {integration.comingSoon && (
                  <Badge className="bg-purple-100 text-purple-700">
                    Coming Soon
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {integration.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {integration.connected && !integration.comingSoon && (
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {!integration.comingSoon && (
              <Switch
                checked={integration.connected}
                onCheckedChange={() => toggleConnection(integration.id)}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ecommerceIntegrations = integrations.filter(
    (i) => i.category === "ecommerce"
  );
  const communicationIntegrations = integrations.filter(
    (i) => i.category === "communication"
  );
  const analyticsIntegrations = integrations.filter(
    (i) => i.category === "analytics"
  );
  const otherIntegrations = integrations.filter((i) => i.category === "other");

  return (
    <div className="flex h-full">
      <SettingsSidebar />

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500">
            Connect your favorite tools and services
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-4xl space-y-6">
            {/* E-commerce */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <ShoppingCart className="h-4 w-4" />
                E-commerce
              </h3>
              <div className="space-y-3">
                {ecommerceIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* Communication */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <MessageSquare className="h-4 w-4" />
                Communication
              </h3>
              <div className="space-y-3">
                {communicationIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* Analytics */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </h3>
              <div className="space-y-3">
                {analyticsIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* Other */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
                <Plug className="h-4 w-4" />
                Developer Tools
              </h3>
              <div className="space-y-3">
                {otherIntegrations.map(renderIntegrationCard)}
              </div>
            </div>

            {/* API Access */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Plug className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">API Access</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Build custom integrations with our REST API
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
