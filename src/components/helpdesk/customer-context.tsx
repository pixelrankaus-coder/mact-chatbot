"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Mail,
  Phone,
  Package,
  ShoppingCart,
  MessageSquare,
  Calendar,
  DollarSign,
  Loader2,
  User,
  Clock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { CustomerContext as CustomerContextType } from "@/types/helpdesk";

interface CustomerContextProps {
  ticketId: string;
}

export function CustomerContext({ ticketId }: CustomerContextProps) {
  const [context, setContext] = useState<CustomerContextType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContext();
  }, [ticketId]);

  const fetchContext = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}/context`);
      if (res.ok) {
        const data = await res.json();
        setContext(data);
      }
    } catch (error) {
      console.error("Failed to fetch context:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency = "NZD") => {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-NZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 1) return "Today";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(date);
  };

  if (loading) {
    return (
      <div className="w-72 border-l bg-white p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="w-72 border-l bg-white p-4">
        <p className="text-sm text-slate-500 text-center">
          No customer context available
        </p>
      </div>
    );
  }

  const woo = context.woo_customer;
  const cin7 = context.cin7_customer;

  return (
    <div className="w-72 border-l bg-white overflow-auto">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Customer Context</h3>
      </div>

      <div className="p-3 space-y-4">
        {/* Customer Info */}
        {(woo || cin7) && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Info
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4 space-y-2 text-sm">
              {woo && (
                <>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {woo.first_name} {woo.last_name}
                    </span>
                  </div>
                  {woo.company && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{woo.company}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{woo.email}</span>
                  </div>
                  {woo.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{woo.phone}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-400">Total Spent</p>
                      <p className="font-medium">
                        {formatCurrency(woo.total_spent || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Orders</p>
                      <p className="font-medium">{woo.orders_count || 0}</p>
                    </div>
                  </div>
                  {woo.id && (
                    <Link
                      href={`/customers/${woo.id}`}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                    >
                      View full profile
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </>
              )}

              {cin7 && !woo && (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span>{cin7.company_name}</span>
                  </div>
                  {cin7.contact_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>{cin7.contact_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{cin7.email}</span>
                  </div>
                  {cin7.price_tier && (
                    <Badge variant="secondary" className="mt-2">
                      {cin7.price_tier}
                    </Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Orders */}
        {context.recent_orders.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="space-y-2">
                {context.recent_orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block p-2 -mx-2 rounded hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        #{order.order_number}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          order.status === "completed"
                            ? "border-green-200 text-green-700"
                            : order.status === "processing"
                            ? "border-blue-200 text-blue-700"
                            : "border-slate-200"
                        }`}
                      >
                        {order.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                      <span>{formatTimeAgo(order.date_created)}</span>
                      <span>{formatCurrency(order.total, order.currency)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Previous Tickets */}
        {context.previous_tickets.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Previous Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="space-y-2">
                {context.previous_tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-2 -mx-2 rounded hover:bg-slate-50"
                  >
                    <p className="text-sm truncate">
                      {ticket.subject || "No subject"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          ticket.status === "closed"
                            ? "border-slate-200 text-slate-600"
                            : "border-blue-200 text-blue-700"
                        }`}
                      >
                        {ticket.status}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatTimeAgo(ticket.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversation Stats */}
        {context.conversation_stats.total_conversations > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Conversations</p>
                  <p className="font-medium">
                    {context.conversation_stats.total_conversations}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Messages</p>
                  <p className="font-medium">
                    {context.conversation_stats.total_messages}
                  </p>
                </div>
                {context.conversation_stats.first_contact && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">First Contact</p>
                    <p className="font-medium">
                      {formatDate(context.conversation_stats.first_contact)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No context message */}
        {!woo && !cin7 && context.recent_orders.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No customer data found
          </p>
        )}
      </div>
    </div>
  );
}
