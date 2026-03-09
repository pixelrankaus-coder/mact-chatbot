"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UsersRound,
  Plus,
  Upload,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string | null;
  source: string;
  tags: string[];
  is_subscribed: boolean;
  cin7_customer_id: string | null;
  woo_customer_id: string | null;
  created_at: string;
}

interface Segment {
  id: string;
  db_id: string | null;
  name: string;
  type: string;
}

interface ImportResult {
  success: boolean;
  total_rows: number;
  imported: number;
  skipped: number;
  linked_to_existing: number;
  added_to_segment: number;
  errors?: string[];
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Add contact form
  const [addForm, setAddForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company: "",
    phone: "",
    source: "manual",
  });
  const [addLoading, setAddLoading] = useState(false);

  // Import state
  const [csvText, setCsvText] = useState("");
  const [importSource, setImportSource] = useState("klaviyo_import");
  const [importSegmentId, setImportSegmentId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limit = 50;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("search", search);
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [page, search, sourceFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Fetch segments for import dialog
  useEffect(() => {
    if (showImportDialog && segments.length === 0) {
      fetch("/api/outreach/segments")
        .then((r) => r.json())
        .then((d) => setSegments((d.segments || []).filter((s: Segment) => s.type === "static" || s.id === "custom")))
        .catch(() => {});
    }
  }, [showImportDialog, segments.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContacts();
  };

  const handleAddContact = async () => {
    if (!addForm.email) {
      toast.error("Email is required");
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add contact");
        return;
      }
      toast.success("Contact added");
      setShowAddDialog(false);
      setAddForm({ email: "", first_name: "", last_name: "", company: "", phone: "", source: "manual" });
      fetchContacts();
    } catch {
      toast.error("Failed to add contact");
    } finally {
      setAddLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      toast.error("No CSV data provided");
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv_data: csvText,
          source: importSource,
          segment_id: importSegmentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      setImportResult(data);
      toast.success(`Imported ${data.imported} contacts`);
      fetchContacts();
    } catch {
      toast.error("Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const sourceBadgeColor = (source: string) => {
    switch (source) {
      case "klaviyo_import": return "bg-purple-100 text-purple-700 border-purple-300";
      case "csv_import": return "bg-blue-100 text-blue-700 border-blue-300";
      case "manual": return "bg-gray-100 text-gray-700 border-gray-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Manage imported contacts from Klaviyo, CSV, or manual entry
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {page} / {totalPages || 1}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Source Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="klaviyo_import">Klaviyo Import</SelectItem>
                <SelectItem value="csv_import">CSV Import</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Linked</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No contacts found
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.email}</TableCell>
                    <TableCell>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>{c.company || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sourceBadgeColor(c.source)}>
                        {c.source.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.cin7_customer_id && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Cin7
                          </Badge>
                        )}
                        {c.woo_customer_id && (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-300 text-xs">
                            <LinkIcon className="h-3 w-3 mr-1" />
                            Woo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to the database. They&apos;ll be auto-linked to Cin7/Woo if a matching email is found.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="contact@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input
                  value={addForm.first_name}
                  onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={addForm.last_name}
                  onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={addForm.company}
                onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddContact} disabled={addLoading}>
              {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) {
          setCsvText("");
          setImportResult(null);
          setImportSegmentId("");
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file or paste CSV data. Required column: <strong>email</strong>.
              Optional: first_name, last_name, company, phone.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Import Complete</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between border rounded-md p-3">
                  <span className="text-muted-foreground">Total Rows</span>
                  <span className="font-medium">{importResult.total_rows}</span>
                </div>
                <div className="flex justify-between border rounded-md p-3">
                  <span className="text-muted-foreground">Imported</span>
                  <span className="font-medium text-green-600">{importResult.imported}</span>
                </div>
                <div className="flex justify-between border rounded-md p-3">
                  <span className="text-muted-foreground">Skipped (duplicates)</span>
                  <span className="font-medium text-yellow-600">{importResult.skipped}</span>
                </div>
                <div className="flex justify-between border rounded-md p-3">
                  <span className="text-muted-foreground">Linked to Cin7/Woo</span>
                  <span className="font-medium text-blue-600">{importResult.linked_to_existing}</span>
                </div>
                {importResult.added_to_segment > 0 && (
                  <div className="flex justify-between border rounded-md p-3 col-span-2">
                    <span className="text-muted-foreground">Added to Segment</span>
                    <span className="font-medium">{importResult.added_to_segment}</span>
                  </div>
                )}
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Errors</span>
                  </div>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => {
                  setShowImportDialog(false);
                  setCsvText("");
                  setImportResult(null);
                  setImportSegmentId("");
                }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File upload */}
              <div>
                <Label>Upload CSV File</Label>
                <div className="mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {csvText ? "File loaded — click to change" : "Choose CSV file"}
                  </Button>
                </div>
              </div>

              {/* Or paste */}
              <div>
                <Label>Or Paste CSV Data</Label>
                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`email,first_name,last_name,company\njohn@example.com,John,Doe,Acme Inc`}
                  className="mt-1 font-mono text-xs"
                  rows={6}
                />
              </div>

              {csvText && (
                <p className="text-xs text-muted-foreground">
                  {csvText.split(/\r?\n/).filter((l) => l.trim()).length - 1} data rows detected
                </p>
              )}

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source Label</Label>
                  <Select value={importSource} onValueChange={setImportSource}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="klaviyo_import">Klaviyo Import</SelectItem>
                      <SelectItem value="csv_import">CSV Import</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Add to Segment (optional)</Label>
                  <Select value={importSegmentId} onValueChange={setImportSegmentId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {segments.map((s) => (
                        <SelectItem key={s.db_id || s.id} value={s.db_id || s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={importLoading || !csvText.trim()}>
                  {importLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import Contacts
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
