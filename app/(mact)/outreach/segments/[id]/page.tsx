"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  ChevronDown,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Search,
} from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";

interface SegmentDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  rules: Array<{ field: string; operator: string; value: string | number | null }>;
  source: string;
  is_active: boolean;
  cached_count: number;
  count: number;
  created_at: string;
  updated_at: string;
}

interface Member {
  email: string;
  name: string;
  company: string;
  phone?: string;
  location?: string;
  added_at?: string;
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

export default function SegmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const segmentId = params.id as string;

  const [segment, setSegment] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [activeTab, setActiveTab] = useState("members");

  // Add profile dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", first_name: "", last_name: "", company: "", phone: "" });
  const [addLoading, setAddLoading] = useState(false);

  // Import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importSource, setImportSource] = useState("csv_import");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSegment = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/segments/${segmentId}`);
      if (!res.ok) {
        toast.error("Segment not found");
        router.push("/outreach/segments");
        return;
      }
      const data = await res.json();
      setSegment(data);
    } catch {
      toast.error("Failed to load segment");
    } finally {
      setLoading(false);
    }
  }, [segmentId, router]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/outreach/segments/${segmentId}?members=true`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  }, [segmentId]);

  useEffect(() => {
    fetchSegment();
    fetchMembers();
  }, [fetchSegment, fetchMembers]);

  const filteredMembers = memberSearch
    ? members.filter(
        (m) =>
          m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.company?.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members;

  const handleAddProfile = async () => {
    if (!addForm.email) {
      toast.error("Email is required");
      return;
    }
    setAddLoading(true);
    try {
      // Add contact first
      const contactRes = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addForm.email,
          first_name: addForm.first_name || null,
          last_name: addForm.last_name || null,
          company: addForm.company || null,
          phone: addForm.phone || null,
          source: "manual",
        }),
      });

      // Even if contact already exists (409), we still want to add to segment
      if (!contactRes.ok && contactRes.status !== 409) {
        const data = await contactRes.json();
        toast.error(data.error || "Failed to add contact");
        return;
      }

      // Add to segment if it's a static list
      if (segment?.type === "static") {
        // TODO: Add API endpoint for adding individual members to a segment
        // For now, use CSV import with single entry
        const csvData = `email,first_name,last_name,company\n${addForm.email},${addForm.first_name},${addForm.last_name},${addForm.company}`;
        await fetch("/api/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csv_data: csvData,
            source: "manual",
            segment_id: segmentId,
          }),
        });
      }

      toast.success("Profile added");
      setShowAddDialog(false);
      setAddForm({ email: "", first_name: "", last_name: "", company: "", phone: "" });
      fetchMembers();
      fetchSegment();
    } catch {
      toast.error("Failed to add profile");
    } finally {
      setAddLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
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
          segment_id: segmentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      setImportResult(data);
      toast.success(`Imported ${data.imported} contacts`);
      fetchMembers();
      fetchSegment();
    } catch {
      toast.error("Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${segment?.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/outreach/segments/${segmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Deleted");
      router.push("/outreach/segments");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!segment) return null;

  const isStatic = segment.type === "static";
  const typeLabel = isStatic ? "List" : "Segment";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <Link
          href="/outreach/segments"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Lists & segments
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{segment.name}</h1>
            <Badge variant="outline">{typeLabel}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {isStatic && (
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add profile
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Manage {typeLabel.toLowerCase()}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  Delete {typeLabel.toLowerCase()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger
            value="members"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-4 py-2"
          >
            Members ({segment.count?.toLocaleString() || members.length})
          </TabsTrigger>
          {isStatic && (
            <TabsTrigger
              value="imports"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-4 py-2"
            >
              Imports
            </TabsTrigger>
          )}
          <TabsTrigger
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-4 py-2"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          {/* Search bar */}
          <div className="mb-4">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone number</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Date added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {memberSearch ? "No members match your search" : "No members yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((m) => (
                    <TableRow key={m.email}>
                      <TableCell>
                        <span className="text-blue-600 font-medium">
                          {m.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{m.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.phone || ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.company || ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.added_at
                          ? new Date(m.added_at).toLocaleDateString("en-AU", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View profile</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Imports Tab */}
        {isStatic && (
          <TabsContent value="imports" className="mt-4">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">Import contacts into this list via CSV</p>
              <Button onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Contacts
              </Button>
            </div>
          </TabsContent>
        )}

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <div className="max-w-lg space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-1">Name</h3>
              <p className="text-sm text-muted-foreground">{segment.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">Description</h3>
              <p className="text-sm text-muted-foreground">{segment.description || "No description"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">Type</h3>
              <p className="text-sm text-muted-foreground">{typeLabel}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">Slug</h3>
              <p className="text-sm text-muted-foreground font-mono">{segment.slug}</p>
            </div>
            {!isStatic && segment.rules && segment.rules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-1">Conditions</h3>
                <div className="space-y-1">
                  {segment.rules.map((rule, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {i > 0 && "AND "}
                      {rule.field} {rule.operator} {String(rule.value ?? "")}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium mb-1">Created</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(segment.created_at).toLocaleDateString("en-AU", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Profile Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add profile</DialogTitle>
            <DialogDescription>Add a contact to this list.</DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddProfile} disabled={addLoading}>
              {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) { setCsvText(""); setImportResult(null); }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import contacts into &ldquo;{segment.name}&rdquo;. Required column: email.
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
                  <span className="text-muted-foreground">Added to list</span>
                  <span className="font-medium">{importResult.added_to_segment}</span>
                </div>
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
                <Button onClick={() => { setShowImportDialog(false); setCsvText(""); setImportResult(null); }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
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
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {csvText ? "File loaded — click to change" : "Choose CSV file"}
                  </Button>
                </div>
              </div>
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
              <div>
                <Label>Source Label</Label>
                <Select value={importSource} onValueChange={setImportSource}>
                  <SelectTrigger className="mt-1 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="klaviyo_import">Klaviyo Import</SelectItem>
                    <SelectItem value="csv_import">CSV Import</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
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
