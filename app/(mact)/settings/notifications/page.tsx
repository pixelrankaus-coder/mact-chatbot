"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  Smartphone,
  Monitor,
  MessageSquare,
  UserPlus,
  AlertCircle,
  Volume2,
  ArrowLeft,
} from "lucide-react";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  email: boolean;
  push: boolean;
  desktop: boolean;
}

export default function NotificationsSettings() {
  const [notifications, setNotifications] = useState<NotificationSetting[]>([
    {
      id: "new-message",
      label: "New Messages",
      description: "When a customer sends a new message",
      icon: <MessageSquare className="h-5 w-5" />,
      email: true,
      push: true,
      desktop: true,
    },
    {
      id: "new-visitor",
      label: "New Visitors",
      description: "When a new visitor starts a chat",
      icon: <UserPlus className="h-5 w-5" />,
      email: false,
      push: true,
      desktop: true,
    },
    {
      id: "unresolved",
      label: "Unresolved Chats",
      description: "Reminder for chats pending for too long",
      icon: <AlertCircle className="h-5 w-5" />,
      email: true,
      push: false,
      desktop: false,
    },
  ]);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const updateNotification = (
    id: string,
    channel: "email" | "push" | "desktop",
    value: boolean
  ) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [channel]: value } : n))
    );
  };

  const handleSave = () => {
    toast.success("Notification preferences saved!");
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            Choose how you want to be notified
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* Sound Settings */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Volume2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Notification Sounds
                      </h3>
                      <p className="text-sm text-slate-500">
                        Play sound when receiving new messages
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={setSoundEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Channels Header */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    Notification Preferences
                  </h3>
                  <div className="flex gap-8 text-sm font-medium text-slate-600">
                    <div className="flex w-16 items-center justify-center gap-1">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                    <div className="flex w-16 items-center justify-center gap-1">
                      <Smartphone className="h-4 w-4" />
                      Push
                    </div>
                    <div className="flex w-16 items-center justify-center gap-1">
                      <Monitor className="h-4 w-4" />
                      Desktop
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          {notification.icon}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {notification.label}
                          </p>
                          <p className="text-sm text-slate-500">
                            {notification.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-8">
                        <div className="flex w-16 justify-center">
                          <Switch
                            checked={notification.email}
                            onCheckedChange={(v) =>
                              updateNotification(notification.id, "email", v)
                            }
                          />
                        </div>
                        <div className="flex w-16 justify-center">
                          <Switch
                            checked={notification.push}
                            onCheckedChange={(v) =>
                              updateNotification(notification.id, "push", v)
                            }
                          />
                        </div>
                        <div className="flex w-16 justify-center">
                          <Switch
                            checked={notification.desktop}
                            onCheckedChange={(v) =>
                              updateNotification(notification.id, "desktop", v)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Email Digest */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                      <Bell className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Daily Email Digest
                      </h3>
                      <p className="text-sm text-slate-500">
                        Receive a daily summary of all chat activity
                      </p>
                    </div>
                  </div>
                  <Switch defaultChecked={false} />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                Save Preferences
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
