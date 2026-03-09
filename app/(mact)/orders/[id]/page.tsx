"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Package,
  Mail,
  User,
  MapPin,
  ExternalLink,
  Loader2,
  Calendar,
  Truck,
  DollarSign,
  Hash,
  FileText,
  CreditCard,
  Printer,
  ChevronDown,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { UnifiedOrder, InvoiceData } from "@/types/order";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";
const WOO_BASE_URL =
  process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || "https://mact.au";

const BPOINT_BASE_URL = "https://www.bpoint.com.au/pay/MININGANDCEMENTT";

const BANK_DETAILS = {
  bank: "Commonwealth Bank of Australia",
  bsb: "064-131",
  account: "10592006",
  name: "Mining & Cement Technology Pty Ltd",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "invoiced":
    case "paid":
      return "bg-green-100 text-green-700";
    case "processing":
    case "picking":
    case "packed":
    case "approved":
      return "bg-blue-100 text-blue-700";
    case "shipped":
      return "bg-purple-100 text-purple-700";
    case "pending":
    case "on-hold":
    case "draft":
    case "ordering":
    case "unpaid":
      return "bg-yellow-100 text-yellow-700";
    case "overdue":
      return "bg-red-100 text-red-700";
    case "cancelled":
    case "refunded":
    case "failed":
    case "void":
    case "voided":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getInvoicePaymentStatus(
  invoice: InvoiceData
): "paid" | "unpaid" | "partial" {
  if (invoice.paid >= invoice.total) return "paid";
  if (invoice.paid > 0) return "partial";
  return "unpaid";
}

function SourceBadge({ source }: { source: "cin7" | "woocommerce" }) {
  if (source === "cin7") {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 text-xs border-green-200"
      >
        Cin7
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-purple-50 text-purple-700 text-xs border-purple-200"
    >
      WooCommerce
    </Badge>
  );
}

// ─── Email Dialog ─────────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  { id: "invoice", label: "Invoice", icon: FileText },
  { id: "receipt", label: "Receipt", icon: CheckCircle2 },
  { id: "invoice-payment", label: "Invoice - Payment", icon: CreditCard },
  { id: "invoice-reminder", label: "Payment Reminder", icon: Clock },
];

function EmailDialog({
  open,
  onOpenChange,
  order,
  invoice,
  templateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: UnifiedOrder;
  invoice?: InvoiceData;
  templateId: string;
}) {
  const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
  const invNum = invoice?.invoiceNumber || "N/A";
  const [toEmail, setToEmail] = useState(order.customerEmail || "");
  const [subject, setSubject] = useState(
    `${template?.label || "Invoice"} — ${invNum}`
  );
  const [body, setBody] = useState(
    `Hi ${order.contactName || order.customerName},\n\nPlease find attached your ${template?.label?.toLowerCase() || "invoice"} for order ${order.orderNumber}.\n\nTotal due: ${formatAUD(invoice ? invoice.total - invoice.paid : order.total)}\n${invoice?.invoiceDate ? `Invoice date: ${formatDateShort(invoice.invoiceDate)}` : ""}\n\nIf you have any questions, please don't hesitate to reach out.\n\nKind regards,\nChris Born\nMACt`
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setToEmail(order.customerEmail || "");
      setSubject(`${template?.label || "Invoice"} — ${invNum}`);
      setSending(false);
      setSent(false);
    }
  }, [open, order, template, invNum]);

  const handleSend = () => {
    setSending(true);
    // TODO: Wire up to actual email sending API
    setTimeout(() => {
      setSending(false);
      setSent(true);
      toast.success(`${template?.label} email sent to ${toEmail}`);
      setTimeout(() => onOpenChange(false), 1200);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send {template?.label}
          </DialogTitle>
          <DialogDescription>
            {invNum} &middot; {order.customerName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="emailTo">To</Label>
            <Input
              id="emailTo"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailSubject">Subject</Label>
            <Input
              id="emailSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailBody">Message</Label>
            <textarea
              id="emailBody"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {invoice && (
            <div className="flex items-center gap-2 rounded-md bg-slate-50 border p-3 text-sm text-slate-600">
              <FileText className="h-4 w-4 text-slate-400" />
              <span>{invNum}.pdf</span>
              <span className="ml-auto text-xs text-slate-400">
                Auto-attached
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || sent || !toEmail}
            className="gap-2"
          >
            {sent ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Sent!
              </>
            ) : sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────

function PaymentDialog({
  open,
  onOpenChange,
  order,
  invoice,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: UnifiedOrder;
  invoice?: InvoiceData;
  onRecorded: () => void;
}) {
  const amountDue = invoice ? invoice.total - invoice.paid : order.total;
  const [amount, setAmount] = useState(amountDue.toFixed(2));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(amountDue.toFixed(2));
      setDate(new Date().toISOString().split("T")[0]);
      setMethod("bank_transfer");
      setReference("");
      setSaving(false);
    }
  }, [open, amountDue]);

  const handleRecord = () => {
    setSaving(true);
    // TODO: Wire up to actual payment recording API
    setTimeout(() => {
      setSaving(false);
      toast.success("Payment recorded successfully");
      onRecorded();
      onOpenChange(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            {invoice?.invoiceNumber || order.orderNumber} &middot;{" "}
            {order.customerName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="payAmount">Amount ($)</Label>
            <Input
              id="payAmount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payDate">Payment Date</Label>
            <Input
              id="payDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payRef">Reference / Note</Label>
            <Input
              id="payRef"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. BSB ref #"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRecord} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Record Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice Tab Content ──────────────────────────────────────────────────────

function InvoiceTab({
  order,
  invoice,
}: {
  order: UnifiedOrder;
  invoice: InvoiceData;
}) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTemplateId, setEmailTemplateId] = useState("invoice");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const paymentStatus = getInvoicePaymentStatus(invoice);
  const amountDue = invoice.total - invoice.paid;
  const subtotal = invoice.lines.reduce((s, i) => s + i.total, 0);
  const gst = invoice.total - subtotal;

  const paymentLink = `${BPOINT_BASE_URL}?ref=${encodeURIComponent(invoice.invoiceNumber)}`;

  const openEmailDialog = (templateId: string) => {
    setEmailTemplateId(templateId);
    setEmailDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Invoice Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Invoice
            </span>
            <span className="text-xl font-bold text-slate-900">
              #{invoice.invoiceNumber}
            </span>
            <Badge className={getStatusColor(paymentStatus)}>
              {paymentStatus === "paid"
                ? "Paid"
                : paymentStatus === "partial"
                  ? "Partial"
                  : "Unpaid"}
            </Badge>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <div>
              <span className="font-medium text-slate-700">Invoice Date:</span>{" "}
              {formatDateShort(invoice.invoiceDate)}
            </div>
            {order.paymentInfo?.paymentTerm && (
              <div>
                <span className="font-medium text-slate-700">
                  Payment Term:
                </span>{" "}
                {order.paymentInfo.paymentTerm}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {paymentStatus !== "paid" && (
            <Button
              onClick={() => setPaymentDialogOpen(true)}
              variant="default"
              className="gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Record Payment
            </Button>
          )}
          {paymentStatus === "paid" && (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200 px-3 py-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Payment Recorded
            </Badge>
          )}

          {/* Email dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Email
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EMAIL_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => openEmailDialog(t.id)}
                  className="gap-2"
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Line Items */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Line Items ({invoice.lines.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.sku && (
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {item.sku}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity.toLocaleString("en-AU")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAUD(item.price)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAUD(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals + Payment Info side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Details */}
        {paymentStatus !== "paid" && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Pay by Credit Card</p>
                <Button asChild variant="default" size="sm" className="gap-2">
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                    <CreditCard className="h-4 w-4" />
                    Pay Now — {formatAUD(amountDue)}
                  </a>
                </Button>
                <p className="text-xs text-slate-400 mt-1.5">
                  1.5% surcharge applies to credit card payments
                </p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-2">
                  Pay by Bank Transfer
                </p>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <span className="text-slate-500">Bank:</span>
                  <span>{BANK_DETAILS.bank}</span>
                  <span className="text-slate-500">BSB:</span>
                  <span className="font-mono">{BANK_DETAILS.bsb}</span>
                  <span className="text-slate-500">Account:</span>
                  <span className="font-mono">{BANK_DETAILS.account}</span>
                  <span className="text-slate-500">Name:</span>
                  <span>{BANK_DETAILS.name}</span>
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-semibold">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Please email remittance to accounts@mact.au
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal (ex. GST)</span>
                <span className="tabular-nums">{formatAUD(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>GST (10%)</span>
                <span className="tabular-nums">{formatAUD(gst)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-3 mt-2">
                <span>Total (inc. GST)</span>
                <span className="tabular-nums text-primary">
                  {formatAUD(invoice.total)}
                </span>
              </div>
              {invoice.paid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600 border-t pt-2 mt-2">
                    <span>Paid</span>
                    <span className="tabular-nums">
                      {formatAUD(invoice.paid)}
                    </span>
                  </div>
                  {amountDue > 0 && (
                    <div className="flex justify-between font-semibold text-orange-600">
                      <span>Amount Due</span>
                      <span className="tabular-nums">
                        {formatAUD(amountDue)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {invoice.paid === 0 && (
                <div className="flex justify-between font-semibold text-orange-600 border-t pt-2 mt-2">
                  <span>Amount Due</span>
                  <span className="tabular-nums">{formatAUD(amountDue)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <EmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        order={order}
        invoice={invoice}
        templateId={emailTemplateId}
      />
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        order={order}
        invoice={invoice}
        onRecorded={() => {
          // Refresh would happen here when wired up
        }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<UnifiedOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        if (res.ok) {
          setOrder(data.order);
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [id]);

  const getExternalUrl = () => {
    if (!order) return null;
    if (order.source === "cin7" && order.cin7Id) {
      return `${CIN7_BASE_URL}/Sale/SaleOrder?ID=${order.cin7Id}`;
    }
    if (order.source === "woocommerce" && order.wooId) {
      return `${WOO_BASE_URL}/wp-admin/post.php?post=${order.wooId}&action=edit`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500">Order not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
  const hasInvoices =
    order.source === "cin7" && order.invoices && order.invoices.length > 0;

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
                Order {order.orderNumber}
              </h1>
              <Badge className={getStatusColor(order.status)}>
                {order.statusLabel}
              </Badge>
              <SourceBadge source={order.source} />
            </div>
            <p className="text-slate-500">
              {order.customerName}
              {order.contactName && order.contactName !== order.customerName
                ? ` · ${order.contactName}`
                : ""}
            </p>
          </div>
        </div>
        {getExternalUrl() && (
          <Button
            variant="outline"
            onClick={() => window.open(getExternalUrl()!, "_blank")}
            className="gap-2"
          >
            {order.source === "cin7" ? (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            )}
            Open in {order.source === "cin7" ? "Cin7" : "WooCommerce"}
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content with Tabs */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <Tabs defaultValue={hasInvoices ? "invoice" : "order"}>
          <TabsList className="mb-6">
            <TabsTrigger value="order" className="gap-1.5">
              <Package className="h-4 w-4" />
              Order
            </TabsTrigger>
            {hasInvoices && (
              <TabsTrigger value="invoice" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Invoice
                {order.invoices!.length > 1 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                    {order.invoices!.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {(order.trackingNumber || order.carrier) && (
              <TabsTrigger value="shipping" className="gap-1.5">
                <Truck className="h-4 w-4" />
                Shipping
              </TabsTrigger>
            )}
          </TabsList>

          {/* Order Tab */}
          <TabsContent value="order">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Order Summary Card */}
              <Card className="border-0 shadow-sm lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-blue-600" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Hash className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Order Number</p>
                      <p className="text-sm font-medium">
                        {order.orderNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Order Date</p>
                      <p className="text-sm">{formatDate(order.orderDate)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DollarSign className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-sm font-medium">
                        {formatAUD(order.total)} {order.currency}
                      </p>
                    </div>
                  </div>

                  {order.paymentInfo?.paymentTerm && (
                    <div className="flex items-start gap-3">
                      <CreditCard className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Payment Term</p>
                        <p className="text-sm">
                          {order.paymentInfo.paymentTerm}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs font-medium text-slate-700 mb-3">
                      Customer
                    </p>

                    {order.customerName && (
                      <div className="flex items-start gap-3 mb-2">
                        <User className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Name</p>
                          <p className="text-sm">{order.customerName}</p>
                          {order.contactName &&
                            order.contactName !== order.customerName && (
                              <p className="text-xs text-slate-400">
                                Contact: {order.contactName}
                              </p>
                            )}
                        </div>
                      </div>
                    )}

                    {order.customerEmail && (
                      <div className="flex items-start gap-3 mb-2">
                        <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Email</p>
                          <a
                            href={`mailto:${order.customerEmail}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {order.customerEmail}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shipping Address */}
                  {order.shippingAddress && (
                    <div className="border-t pt-4 mt-4">
                      <p className="text-xs font-medium text-slate-700 mb-3">
                        Shipping
                      </p>
                      <div className="flex items-start gap-3 mb-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Address</p>
                          <p className="text-sm">
                            {order.shippingAddress.address1}
                          </p>
                          <p className="text-sm">
                            {[
                              order.shippingAddress.city,
                              order.shippingAddress.state,
                              order.shippingAddress.postcode,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                          {order.shippingAddress.country && (
                            <p className="text-sm">
                              {order.shippingAddress.country}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Line Items Card */}
              <Card className="border-0 shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-blue-600" />
                    Line Items ({order.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {order.items.length === 0 ? (
                    <div className="py-8 text-center">
                      <Package className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">
                        No items in this order
                      </p>
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  {item.sku && (
                                    <p className="text-xs text-slate-500">
                                      SKU: {item.sku}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {item.quantity.toLocaleString("en-AU")}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAUD(item.price)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatAUD(item.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <div className="mt-4 border-t pt-4">
                        <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Subtotal</span>
                              <span className="tabular-nums">
                                {formatAUD(subtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between font-medium text-lg border-t pt-2">
                              <span>Total</span>
                              <span className="tabular-nums">
                                {formatAUD(order.total)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Invoice Tab */}
          {hasInvoices && (
            <TabsContent value="invoice">
              {order.invoices!.length === 1 ? (
                <InvoiceTab order={order} invoice={order.invoices![0]} />
              ) : (
                <div className="space-y-8">
                  {order.invoices!.map((inv, idx) => (
                    <div key={inv.invoiceNumber}>
                      {idx > 0 && (
                        <div className="border-t my-6" />
                      )}
                      <InvoiceTab order={order} invoice={inv} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Shipping Tab */}
          {(order.trackingNumber || order.carrier) && (
            <TabsContent value="shipping">
              <Card className="border-0 shadow-sm max-w-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Truck className="h-5 w-5 text-blue-600" />
                    Shipping Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.carrier && (
                    <div className="flex items-start gap-3">
                      <Truck className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Carrier</p>
                        <p className="text-sm">{order.carrier}</p>
                      </div>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div className="flex items-start gap-3">
                      <Package className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Tracking Number
                        </p>
                        <p className="text-sm font-mono">
                          {order.trackingNumber}
                        </p>
                      </div>
                    </div>
                  )}
                  {order.shippedDate && (
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Shipped Date</p>
                        <p className="text-sm">
                          {formatDate(order.shippedDate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {order.shippingAddress && (
                    <div className="flex items-start gap-3 border-t pt-4">
                      <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Delivery Address
                        </p>
                        <p className="text-sm">
                          {order.shippingAddress.address1}
                        </p>
                        <p className="text-sm">
                          {[
                            order.shippingAddress.city,
                            order.shippingAddress.state,
                            order.shippingAddress.postcode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
