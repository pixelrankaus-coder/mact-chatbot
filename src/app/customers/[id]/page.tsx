"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  ExternalLink,
  Loader2,
  Package,
  Users,
  CreditCard,
  Calendar,
  Globe,
  Tag,
  Truck,
  FileText,
  DollarSign,
  Percent,
  Clock,
} from "lucide-react";
import type { Cin7Customer, Cin7Sale } from "@/lib/cin7";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Cin7Customer | null>(null);
  const [orders, setOrders] = useState<Cin7Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch(`/api/cin7/customers/${id}`);
        const data = await res.json();
        if (res.ok) {
          setCustomer(data.customer);
        }
      } catch (error) {
        console.error("Failed to fetch customer:", error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchOrders() {
      try {
        const res = await fetch(`/api/cin7/customers/${id}/orders?limit=20`);
        const data = await res.json();
        if (res.ok) {
          setOrders(data.orders || []);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setOrdersLoading(false);
      }
    }

    fetchCustomer();
    fetchOrders();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-700";
      case "hold":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "invoiced":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <User className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500">Customer not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {customer.Name}
              </h1>
              <Badge className={getStatusColor(customer.Status)}>
                {customer.Status}
              </Badge>
            </div>
            <p className="text-slate-500">Customer ID: {customer.ID}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              `${CIN7_BASE_URL}/Customers/View?ID=${customer.ID}`,
              "_blank"
            )
          }
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in Cin7
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Customer Info Card */}
          <Card className="border-0 shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-blue-600" />
                Customer Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Contact Info */}
              {(customer.Email || customer.Contacts?.[0]?.Email) && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <a
                      href={`mailto:${customer.Email || customer.Contacts?.[0]?.Email}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.Email || customer.Contacts?.[0]?.Email}
                    </a>
                  </div>
                </div>
              )}
              {(customer.Phone || customer.Contacts?.[0]?.Phone) && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <a
                      href={`tel:${customer.Phone || customer.Contacts?.[0]?.Phone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.Phone || customer.Contacts?.[0]?.Phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.Mobile && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Mobile</p>
                    <a
                      href={`tel:${customer.Mobile}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.Mobile}
                    </a>
                  </div>
                </div>
              )}
              {customer.Website && (
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Website</p>
                    <a
                      href={customer.Website.startsWith('http') ? customer.Website : `https://${customer.Website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.Website}
                    </a>
                  </div>
                </div>
              )}

              {/* Business Info */}
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Business Details</p>
                {customer.Currency && (
                  <div className="flex items-start gap-3 mb-2">
                    <DollarSign className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Currency</p>
                      <p className="text-sm">{customer.Currency}</p>
                    </div>
                  </div>
                )}
                {customer.PaymentTerm && (
                  <div className="flex items-start gap-3 mb-2">
                    <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Payment Terms</p>
                      <p className="text-sm">{customer.PaymentTerm}</p>
                    </div>
                  </div>
                )}
                {customer.CreditLimit !== undefined && customer.CreditLimit > 0 && (
                  <div className="flex items-start gap-3 mb-2">
                    <CreditCard className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Credit Limit</p>
                      <p className="text-sm">
                        ${customer.CreditLimit.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {customer.Discount !== undefined && customer.Discount > 0 && (
                  <div className="flex items-start gap-3 mb-2">
                    <Percent className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Discount</p>
                      <p className="text-sm">{customer.Discount}%</p>
                    </div>
                  </div>
                )}
                {customer.PriceTier && (
                  <div className="flex items-start gap-3 mb-2">
                    <Tag className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Price Tier</p>
                      <p className="text-sm">{customer.PriceTier}</p>
                    </div>
                  </div>
                )}
                {customer.TaxRule && (
                  <div className="flex items-start gap-3 mb-2">
                    <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Tax Rule</p>
                      <p className="text-sm">{customer.TaxRule}</p>
                    </div>
                  </div>
                )}
                {customer.TaxNumber && (
                  <div className="flex items-start gap-3 mb-2">
                    <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Tax Number (ABN)</p>
                      <p className="text-sm">{customer.TaxNumber}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fulfillment Info */}
              {(customer.Carrier || customer.Location || customer.SalesRepresentative) && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">Fulfillment</p>
                  {customer.Carrier && (
                    <div className="flex items-start gap-3 mb-2">
                      <Truck className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Default Carrier</p>
                        <p className="text-sm">{customer.Carrier}</p>
                      </div>
                    </div>
                  )}
                  {customer.Location && (
                    <div className="flex items-start gap-3 mb-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Location</p>
                        <p className="text-sm">{customer.Location}</p>
                      </div>
                    </div>
                  )}
                  {customer.SalesRepresentative && (
                    <div className="flex items-start gap-3 mb-2">
                      <User className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Sales Rep</p>
                        <p className="text-sm">{customer.SalesRepresentative}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {customer.Tags && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-slate-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {customer.Tags.split(',').map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Activity</p>
                {customer.LastModifiedOn && (
                  <div className="flex items-start gap-3 mb-2">
                    <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Last Modified</p>
                      <p className="text-sm">
                        {new Date(customer.LastModifiedOn).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {customer.Comments && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">
                    {customer.Comments}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <Tabs defaultValue="orders" className="w-full">
              <CardHeader className="pb-0">
                <TabsList>
                  <TabsTrigger value="orders" className="gap-2">
                    <Package className="h-4 w-4" />
                    Orders
                  </TabsTrigger>
                  <TabsTrigger value="addresses" className="gap-2">
                    <MapPin className="h-4 w-4" />
                    Addresses
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="gap-2">
                    <Users className="h-4 w-4" />
                    Contacts
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Orders Tab */}
                <TabsContent value="orders" className="mt-0">
                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="py-8 text-center">
                      <Package className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No orders found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order, index) => (
                          <TableRow key={order.ID || `order-${index}`}>
                            <TableCell className="font-medium">
                              {order.OrderNumber}
                            </TableCell>
                            <TableCell>
                              {new Date(order.OrderDate).toLocaleDateString(
                                "en-AU"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.Status)}>
                                {order.Status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${order.Total?.toFixed(2) || "0.00"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Addresses Tab */}
                <TabsContent value="addresses" className="mt-0">
                  {customer.Addresses && customer.Addresses.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {customer.Addresses.map((address, index) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-white p-4"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Building className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium">
                              {address.Type || `Address ${index + 1}`}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            {address.Line1 && <p>{address.Line1}</p>}
                            {address.Line2 && <p>{address.Line2}</p>}
                            <p>
                              {[address.City, address.State, address.Postcode]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {address.Country && <p>{address.Country}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <MapPin className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No addresses on file</p>
                    </div>
                  )}
                </TabsContent>

                {/* Contacts Tab */}
                <TabsContent value="contacts" className="mt-0">
                  {customer.Contacts && customer.Contacts.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {customer.Contacts.map((contact, index) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-white p-4"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium">
                              {contact.Name || `Contact ${index + 1}`}
                            </span>
                            {contact.Default && (
                              <Badge variant="outline" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-slate-600">
                            {contact.Email && (
                              <p className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <a
                                  href={`mailto:${contact.Email}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {contact.Email}
                                </a>
                              </p>
                            )}
                            {contact.Phone && (
                              <p className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <a
                                  href={`tel:${contact.Phone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {contact.Phone}
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Users className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No contacts on file</p>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
