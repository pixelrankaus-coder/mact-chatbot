"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAgent } from "@/contexts/AgentContext";
import {
  User,
  Mail,
  Building,
  Camera,
  Shield,
  Key,
  Trash2,
  LogOut,
  Loader2,
  ArrowLeft,
} from "lucide-react";

export default function AccountSettings() {
  const router = useRouter();
  const { agent, logout, loading: agentLoading } = useAgent();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState({
    name: "Drew Mitchell",
    email: "drew@mact.au",
    company: "MACt GFRC Products",
    role: "Admin",
  });

  const handleSave = () => {
    toast.success("Account settings saved!");
  };

  // Task 044: Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to logout");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Account</h1>
          <p className="text-sm text-slate-500">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* Profile Photo */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Profile Photo
                </h3>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                      DM
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" className="gap-2">
                      <Camera className="h-4 w-4" />
                      Change Photo
                    </Button>
                    <p className="mt-2 text-xs text-slate-500">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name" className="text-sm text-slate-600">
                        <User className="mr-1 inline h-3 w-3" />
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm text-slate-600">
                        <Mail className="mr-1 inline h-3 w-3" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="company" className="text-sm text-slate-600">
                      <Building className="mr-1 inline h-3 w-3" />
                      Company Name
                    </Label>
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(e) =>
                        setProfile({ ...profile, company: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <Shield className="mr-2 inline h-4 w-4" />
                  Security
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium text-slate-900">Password</p>
                      <p className="text-sm text-slate-500">
                        Last changed 30 days ago
                      </p>
                    </div>
                    <Button variant="outline" className="gap-2">
                      <Key className="h-4 w-4" />
                      Change Password
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        Two-Factor Authentication
                      </p>
                      <p className="text-sm text-slate-500">
                        Add an extra layer of security
                      </p>
                    </div>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session - Task 044 */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <LogOut className="mr-2 inline h-4 w-4" />
                  Session
                </h3>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium text-slate-900">Sign Out</p>
                    <p className="text-sm text-slate-500">
                      {agent ? `Signed in as ${agent.email}` : "End your current session"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing out...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-0 shadow-sm border-red-200">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-red-600">
                  <Trash2 className="mr-2 inline h-4 w-4" />
                  Danger Zone
                </h3>
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
                  <div>
                    <p className="font-medium text-slate-900">Delete Account</p>
                    <p className="text-sm text-slate-500">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button variant="destructive">Delete Account</Button>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
