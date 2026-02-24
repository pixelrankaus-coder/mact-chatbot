"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Mail,
  FileText,
  CreditCard,
  RefreshCw,
} from "lucide-react";

interface OrderAutomation {
  id: string;
  order_cin7_id: string;
  order_number: string;
  automation_type: "quote_followup" | "cod_followup";
  status: "active" | "paused" | "completed" | "cancelled";
  customer_email: string;
  customer_name: string;
  next_action_date: string;
  reminder_count: number;
  max_reminders: number;
  last_reminder_at: string | null;
  completed_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AutomationCounts {
  total: number;
  active: number;
  paused: number;
  completed: number;
  quote_followup: number;
  cod_followup: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 }> = {
  active: { label: "Active", variant: "default", icon: Play },
  paused: { label: "Paused", variant: "secondary", icon: Pause },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const typeConfig: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  quote_followup: { label: "Quote Follow-up", icon: FileText, color: "text-blue-600" },
  cod_followup: { label: "COD Payment", icon: CreditCard, color: "text-amber-600" },
};

const completedReasonLabels: Record<string, string> = {
  order_confirmed: "Order Confirmed",
  payment_received: "Payment Received",
  order_cancelled: "Order Cancelled",
  max_reminders: "Max Reminders Reached",
  manual_cancel: "Manually Cancelled",
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<OrderAutomation[]>([]);
  const [counts, setCounts] = useState<AutomationCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/automations?${params}`);
      const data = await res.json();
      setAutomations(data.automations || []);
      setCounts(data.counts || null);
    } catch (err) {
      console.error("Failed to fetch automations:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleAction = async (id: string, action: "pause" | "resume" | "cancel") => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchAutomations();
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeUntilNext = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff < 0) return "Overdue";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Automations</h1>
          <p className="text-sm text-muted-foreground">Automated email follow-ups for quotes and invoices</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAutomations} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {counts && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{counts.active}</p>
                </div>
                <Zap className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paused</p>
                  <p className="text-2xl font-bold">{counts.paused}</p>
                </div>
                <Pause className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Quote Follow-ups</p>
                  <p className="text-2xl font-bold">{counts.quote_followup}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">COD Follow-ups</p>
                  <p className="text-2xl font-bold">{counts.cod_followup}</p>
                </div>
                <CreditCard className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardDescription>
              {automations.length} automation{automations.length !== 1 ? "s" : ""}
            </CardDescription>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quote_followup">Quote Follow-up</SelectItem>
                  <SelectItem value="cod_followup">COD Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No automations found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Automations are created automatically when quotes or COD invoices are detected in Cin7
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reminders</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Last Sent</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automations.map((auto) => {
                  const typeInfo = typeConfig[auto.automation_type];
                  const statusInfo = statusConfig[auto.status];
                  const StatusIcon = statusInfo.icon;
                  const TypeIcon = typeInfo.icon;

                  return (
                    <TableRow key={auto.id}>
                      <TableCell className="font-medium">{auto.order_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className={`h-3.5 w-3.5 ${typeInfo.color}`} />
                          <span className="text-xs">{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{auto.customer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{auto.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="flex w-fit items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                        {auto.completed_reason && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {completedReasonLabels[auto.completed_reason] || auto.completed_reason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{auto.reminder_count}</span>
                          <span className="text-xs text-muted-foreground">/ {auto.max_reminders}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {auto.status === "active" ? (
                          <div>
                            <div className="text-sm">{formatDate(auto.next_action_date)}</div>
                            <div className="text-xs text-muted-foreground">
                              <Clock className="mr-1 inline h-3 w-3" />
                              {getTimeUntilNext(auto.next_action_date)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(auto.last_reminder_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(auto.status === "active" || auto.status === "paused") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={actionLoading === auto.id}>
                                {actionLoading === auto.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {auto.status === "active" ? (
                                <DropdownMenuItem onClick={() => handleAction(auto.id, "pause")}>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Pause
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleAction(auto.id, "resume")}>
                                  <Play className="mr-2 h-4 w-4" />
                                  Resume
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleAction(auto.id, "cancel")}
                                className="text-destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
