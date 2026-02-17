"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bot,
  Upload,
  FileText,
  FileIcon,
  Trash2,
  Link,
  HelpCircle,
  Send,
  Sparkles,
  Globe,
  CheckCircle2,
  Loader2,
  File,
  MessageSquare,
  User,
  AlertCircle,
  UserCircle,
  Clock,
  MousePointer,
  ArrowUpFromLine,
} from "lucide-react";
import { toast } from "sonner";
import { useAIAgentSettings } from "@/hooks/use-settings";
import { AgentTabs, useAgentTab } from "./components/agent-tabs";
import { SkillsTab } from "./components/skills-tab";

interface UploadedDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: "processing" | "ready" | "error";
  created_at: string;
}

interface TestMessage {
  id: number;
  sender: "user" | "bot";
  content: string;
}

const sampleQuestions = [
  "What GFRC products do you offer?",
  "How much do panels cost per sq ft?",
  "What is the lead time for custom orders?",
  "Do you ship to California?",
];

function AIAgentPageContent() {
  const { value: settings, loading, updateSetting } = useAIAgentSettings();
  const [saving, setSaving] = useState(false);
  const currentTab = useAgentTab("training");

  // Local state for form fields
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [aiName, setAiName] = useState("MACt Assistant");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Hi there! I'm the MACt Assistant. How can I help you with your GFRC project today?"
  );
  const [personality, setPersonality] = useState<"professional" | "friendly" | "casual">("professional");
  const [responseLength, setResponseLength] = useState([50]);
  const [fallbackAction, setFallbackAction] = useState<"clarify" | "transfer" | "email">("clarify");

  // Pre-chat form state
  const [preChatEnabled, setPreChatEnabled] = useState(false);
  const [preChatFields, setPreChatFields] = useState({
    name: "required" as "required" | "optional" | "hidden",
    email: "required" as "required" | "optional" | "hidden",
    phone: "optional" as "required" | "optional" | "hidden",
  });

  // Chat triggers state
  const [triggersEnabled, setTriggersEnabled] = useState(false);
  const [timeDelayEnabled, setTimeDelayEnabled] = useState(false);
  const [timeDelaySeconds, setTimeDelaySeconds] = useState("10");
  const [scrollDepthEnabled, setScrollDepthEnabled] = useState(false);
  const [scrollDepthPercent, setScrollDepthPercent] = useState("50");
  const [exitIntentEnabled, setExitIntentEnabled] = useState(false);
  const [oncePerSession, setOncePerSession] = useState(true);

  // Knowledge base state
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sitemap crawler state
  const [sitemapUrl, setSitemapUrl] = useState("https://mact.au/sitemap_index.xml");
  const [discovering, setDiscovering] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [crawlResults, setCrawlResults] = useState<{ succeeded: number; skipped: number; failed: number } | null>(null);

  // Test chat state
  const [testInput, setTestInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);

  // Load settings from Supabase
  useEffect(() => {
    if (!loading && settings) {
      setAgentEnabled(settings.enabled !== false);
      setAiName(settings.name || "MACt Assistant");
      setWelcomeMessage(settings.welcomeMessage || "Hi there! I'm the MACt Assistant. How can I help you with your GFRC project today?");
      setPersonality(settings.personality || "professional");
      setResponseLength([settings.responseLength || 50]);
      setFallbackAction(settings.fallbackAction || "clarify");
      setPreChatEnabled(settings.preChatForm?.enabled ?? false);
      setPreChatFields({
        name: settings.preChatForm?.fields?.name || "required",
        email: settings.preChatForm?.fields?.email || "required",
        phone: settings.preChatForm?.fields?.phone || "optional",
      });

      // Load triggers settings
      setTriggersEnabled(settings.triggers?.enabled ?? false);
      setTimeDelayEnabled(settings.triggers?.timeDelay?.enabled ?? false);
      setTimeDelaySeconds(String(settings.triggers?.timeDelay?.seconds ?? 10));
      setScrollDepthEnabled(settings.triggers?.scrollDepth?.enabled ?? false);
      setScrollDepthPercent(String(settings.triggers?.scrollDepth?.percentage ?? 50));
      setExitIntentEnabled(settings.triggers?.exitIntent?.enabled ?? false);
      setOncePerSession(settings.triggers?.oncePerSession ?? true);

      // Initialize test messages with welcome message
      setTestMessages([{
        id: 1,
        sender: "bot",
        content: settings.welcomeMessage || "Hi there! I'm the MACt Assistant. How can I help you with your GFRC project today?",
      }]);
    }
  }, [loading, settings]);

  // Fetch knowledge base documents via API (uses service role, bypasses RLS)
  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch("/api/knowledge-base/upload");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch documents");
        setDocuments(data.documents || []);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoadingDocs(false);
      }
    }

    fetchDocuments();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting({
        enabled: agentEnabled,
        name: aiName,
        welcomeMessage,
        personality,
        responseLength: responseLength[0],
        fallbackAction,
        preChatForm: {
          enabled: preChatEnabled,
          fields: preChatFields,
        },
        triggers: {
          enabled: triggersEnabled,
          timeDelay: {
            enabled: timeDelayEnabled,
            seconds: parseInt(timeDelaySeconds) || 10,
          },
          scrollDepth: {
            enabled: scrollDepthEnabled,
            percentage: parseInt(scrollDepthPercent) || 50,
          },
          exitIntent: {
            enabled: exitIntentEnabled,
          },
          oncePerSession,
        },
      });
      toast.success("AI Agent settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/upload?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      toast.success("Document deleted");
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error("Failed to delete document");
    }
  };

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    if (fileArray.length === 0) return;

    setUploading(true);

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/knowledge-base/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        // Add the new document to the list
        if (data.document) {
          setDocuments((prev) => [data.document, ...prev]);
        }

        toast.success(`Uploaded: ${file.name}`);
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(error instanceof Error ? error.message : `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
  }, [handleFileUpload]);

  // URL scraping handler
  const handleScrapeUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a URL to scrape");
      return;
    }

    setScraping(true);

    try {
      const response = await fetch("/api/knowledge-base/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to scrape URL");
      }

      // Add the new document to the list
      if (data.document) {
        setDocuments((prev) => {
          // Check if document already exists (updated)
          const exists = prev.some((d) => d.id === data.document.id);
          if (exists) {
            return prev.map((d) => d.id === data.document.id ? data.document : d);
          }
          return [data.document, ...prev];
        });
      }

      setUrlInput("");
      toast.success("URL scraped successfully!", {
        description: `Extracted ${data.contentLength?.toLocaleString() || 0} characters`,
      });
    } catch (error) {
      console.error("Scrape error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to scrape URL");
    } finally {
      setScraping(false);
    }
  }, [urlInput]);

  // Sitemap discovery handler
  const handleDiscoverSitemap = useCallback(async () => {
    if (!sitemapUrl.trim()) {
      toast.error("Please enter a sitemap URL");
      return;
    }

    setDiscovering(true);
    setDiscoveredUrls([]);
    setSelectedUrls(new Set());
    setCrawlResults(null);

    try {
      const response = await fetch("/api/knowledge-base/crawl-sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover", sitemapUrl: sitemapUrl.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch sitemap");

      setDiscoveredUrls(data.urls || []);
      setSelectedUrls(new Set(data.urls || [])); // Select all by default
      toast.success(`Found ${data.total} pages`, {
        description: data.filteredOut > 0 ? `${data.filteredOut} non-HTML URLs filtered out` : undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to discover sitemap");
    } finally {
      setDiscovering(false);
    }
  }, [sitemapUrl]);

  // Sitemap crawl handler
  const handleCrawlSelected = useCallback(async () => {
    if (selectedUrls.size === 0) {
      toast.error("No URLs selected");
      return;
    }

    setCrawling(true);
    setCrawlResults(null);

    try {
      const response = await fetch("/api/knowledge-base/crawl-sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "crawl", urls: Array.from(selectedUrls) }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Crawl failed");

      setCrawlResults(data.summary);
      toast.success(`Crawled ${data.summary.succeeded} pages successfully`, {
        description: `${data.summary.skipped} skipped, ${data.summary.failed} failed`,
      });

      // Refresh documents list via API
      const docsRes = await fetch("/api/knowledge-base/upload");
      const docsData = await docsRes.json();
      if (docsData.documents) setDocuments(docsData.documents);

      // Clear discovery state
      setDiscoveredUrls([]);
      setSelectedUrls(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Crawl failed");
    } finally {
      setCrawling(false);
    }
  }, [selectedUrls]);

  // Poll for document status updates via API
  useEffect(() => {
    const processingDocs = documents.filter((d) => d.status === "processing");
    if (processingDocs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/knowledge-base/upload");
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
        }
      } catch (error) {
        console.error("Failed to poll document status:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [documents]);

  const handleSendTestMessage = async () => {
    if (!testInput.trim()) return;

    const userMessage: TestMessage = {
      id: testMessages.length + 1,
      sender: "user",
      content: testInput,
    };

    const messageContent = testInput.trim();
    setTestMessages((prev) => [...prev, userMessage]);
    setTestInput("");
    setIsTyping(true);

    // Call real AI API
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          conversationHistory: testMessages
            .filter((m) => m.sender !== "bot" || m.id !== 1) // Exclude welcome message
            .map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.content,
            })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const botMessage: TestMessage = {
        id: testMessages.length + 2,
        sender: "bot",
        content: data.response || "I apologize, but I couldn't generate a response. Please try again.",
      };
      setTestMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Test chat error:", error);
      const botMessage: TestMessage = {
        id: testMessages.length + 2,
        sender: "bot",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setTestMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSampleQuestion = (question: string) => {
    setTestInput(question);
  };

  const getFileIcon = (type: string) => {
    const fileType = type?.toUpperCase() || "";
    switch (fileType) {
      case "PDF":
        return <FileText className="h-5 w-5 text-red-500" />;
      case "DOCX":
      case "DOC":
        return <FileIcon className="h-5 w-5 text-blue-500" />;
      case "XLSX":
      case "XLS":
        return <FileIcon className="h-5 w-5 text-green-500" />;
      case "URL":
        return <Globe className="h-5 w-5 text-purple-500" />;
      default:
        return <File className="h-5 w-5 text-slate-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <TooltipProvider>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b bg-white px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AI Agent</h1>
              <p className="text-slate-500">
                Configure and train your AI assistant
              </p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Loading AI settings...</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Render Training Tab Content
  const renderTrainingTab = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* LEFT: Knowledge Base */}
      <div className="space-y-6">
        {/* Train Your AI Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Train Your AI
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Upload documents to train your AI with company-specific knowledge. The AI will use this information to answer customer questions accurately.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Upload your product catalogs, FAQs, pricing sheets, and other documents to train your AI assistant with accurate company information.
            </p>

            {/* File Upload Area */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
                  <p className="mt-3 font-medium text-blue-600">
                    Uploading...
                  </p>
                </>
              ) : (
                <>
                  <Upload className={`mx-auto h-10 w-10 ${dragActive ? "text-blue-500" : "text-slate-400"}`} />
                  <p className="mt-3 font-medium text-slate-700">
                    {dragActive ? "Drop files here" : "Drag and drop files here"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    or click to browse
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Supports PDF, DOCX, TXT, XLSX (Max 10MB each)
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select Files
                  </Button>
                </>
              )}
            </div>

            {/* Add from URL */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Add from URL (e.g., https://yoursite.com/faq)"
                  className="pl-9"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !scraping) {
                      handleScrapeUrl();
                    }
                  }}
                  disabled={scraping}
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleScrapeUrl}
                    disabled={scraping || !urlInput.trim()}
                  >
                    {scraping ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4" />
                        Scrape
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Extract content from a webpage to train your AI
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        {/* Sitemap Crawler */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              Bulk Import from Sitemap
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Crawl your entire website at once by importing from your sitemap.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Input
                placeholder="https://mact.au/sitemap.xml"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !discovering) handleDiscoverSitemap();
                }}
                disabled={discovering || crawling}
              />
              <Button
                variant="outline"
                className="gap-2 shrink-0"
                onClick={handleDiscoverSitemap}
                disabled={discovering || crawling || !sitemapUrl.trim()}
              >
                {discovering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Discover Pages
                  </>
                )}
              </Button>
            </div>

            {/* Discovered URLs list */}
            {discoveredUrls.length > 0 && (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {selectedUrls.size} of {discoveredUrls.length} pages selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUrls(new Set(discoveredUrls))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUrls(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {discoveredUrls.map((url) => (
                      <label
                        key={url}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUrls.has(url)}
                          onChange={(e) => {
                            setSelectedUrls((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(url);
                              else next.delete(url);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                        <span className="truncate text-slate-600">{url}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  className="w-full gap-2"
                  onClick={handleCrawlSelected}
                  disabled={crawling || selectedUrls.size === 0}
                >
                  {crawling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Crawling {selectedUrls.size} pages...
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine className="h-4 w-4" />
                      Crawl {selectedUrls.size} Selected Pages
                    </>
                  )}
                </Button>
                {crawlResults && (
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-600">{crawlResults.succeeded} added</span>
                    <span className="text-amber-600">{crawlResults.skipped} skipped</span>
                    {crawlResults.failed > 0 && (
                      <span className="text-red-600">{crawlResults.failed} failed</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Uploaded Documents */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-blue-600" />
                Uploaded Documents
              </CardTitle>
              <Badge variant="outline">{documents.length} files</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-lg bg-slate-50 py-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No documents uploaded yet</p>
                <p className="text-xs text-slate-400">Upload files above to train your AI</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border bg-white p-3"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.file_type)}
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {doc.filename}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{doc.file_type?.toUpperCase()}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(doc.created_at)}</span>
                          </div>
                          {doc.status === "processing" && (
                            <div className="mt-2 w-32">
                              <Progress value={67} className="h-1" />
                              <p className="mt-1 text-xs text-slate-500">
                                Processing...
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.status === "ready" && (
                          <Tooltip>
                            <TooltipTrigger>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent>Ready for AI training</TooltipContent>
                          </Tooltip>
                        )}
                        {doc.status === "processing" && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent>Processing document...</TooltipContent>
                          </Tooltip>
                        )}
                        {doc.status === "error" && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent>Failed to process document</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Quick Stats */}
      <div className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-purple-600" />
              Training Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
                <div>
                  <p className="font-medium text-green-700">Documents Ready</p>
                  <p className="text-sm text-green-600">
                    {documents.filter((d) => d.status === "ready").length} documents trained
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              {documents.filter((d) => d.status === "processing").length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                <div>
                  <p className="font-medium text-blue-700">Processing</p>
                  <p className="text-sm text-blue-600">
                    {documents.filter((d) => d.status === "processing").length} documents
                  </p>
                </div>
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
              )}
              {documents.filter((d) => d.status === "error").length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-4">
                  <div>
                    <p className="font-medium text-red-700">Errors</p>
                    <p className="text-sm text-red-600">
                      {documents.filter((d) => d.status === "error").length} documents
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-purple-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
              <Sparkles className="h-4 w-4" />
              Pro Tip
            </div>
            <p className="mt-1 text-sm text-purple-600">
              Upload more documents to improve your AI&apos;s accuracy. The more context you provide, the better it can answer customer questions. Try uploading your FAQ pages, product specifications, and company policies.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Render Settings Tab Content
  const renderSettingsTab = () => (
    <div className="max-w-2xl">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-purple-600" />
            AI Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Name */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                AI Name
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent>
                  The name your AI assistant will use to introduce itself
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="Enter AI assistant name"
            />
          </div>

          {/* Welcome Message */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                Welcome Message
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  The first message visitors see when they open the chat widget
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              placeholder="Enter welcome message..."
            />
          </div>

          {/* AI Personality */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                AI Personality
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Sets the tone and style of your AI responses
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={personality} onValueChange={(value) => setPersonality(value as "professional" | "friendly" | "casual")}>
              <SelectTrigger>
                <SelectValue placeholder="Select personality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">
                  <div className="flex items-center gap-2">
                    <span>Professional</span>
                    <span className="text-xs text-slate-500">- Formal and business-like</span>
                  </div>
                </SelectItem>
                <SelectItem value="friendly">
                  <div className="flex items-center gap-2">
                    <span>Friendly</span>
                    <span className="text-xs text-slate-500">- Warm and approachable</span>
                  </div>
                </SelectItem>
                <SelectItem value="casual">
                  <div className="flex items-center gap-2">
                    <span>Casual</span>
                    <span className="text-xs text-slate-500">- Relaxed and conversational</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Response Length */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                Response Length
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Controls how detailed the AI responses will be
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-3">
              <Slider
                value={responseLength}
                onValueChange={setResponseLength}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Concise</span>
                <span>Balanced</span>
                <span>Detailed</span>
              </div>
            </div>
          </div>

          {/* When AI Can't Answer */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                When AI Can&apos;t Answer
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  What happens when the AI doesn&apos;t know how to respond
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={fallbackAction} onValueChange={setFallbackAction}>
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clarify">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Ask for clarification</span>
                  </div>
                </SelectItem>
                <SelectItem value="transfer">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Transfer to human agent</span>
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <span>Collect email for follow-up</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Render Behavior Tab Content
  const renderBehaviorTab = () => (
    <div className="max-w-2xl space-y-6">
      {/* Pre-Chat Form Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCircle className="h-5 w-5 text-green-600" />
            Pre-Chat Form
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-slate-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Collect visitor information before the chat begins
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable Pre-Chat Form</p>
              <p className="text-xs text-slate-500">Collect visitor info before chat starts</p>
            </div>
            <Switch
              checked={preChatEnabled}
              onCheckedChange={setPreChatEnabled}
            />
          </div>

          {preChatEnabled && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">Name field</span>
                <Select
                  value={preChatFields.name}
                  onValueChange={(v) => setPreChatFields({ ...preChatFields, name: v as "required" | "optional" | "hidden" })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">Email field</span>
                <Select
                  value={preChatFields.email}
                  onValueChange={(v) => setPreChatFields({ ...preChatFields, email: v as "required" | "optional" | "hidden" })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">Phone field</span>
                <Select
                  value={preChatFields.phone}
                  onValueChange={(v) => setPreChatFields({ ...preChatFields, phone: v as "required" | "optional" | "hidden" })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Pre-Chat Settings"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Chat Triggers */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MousePointer className="h-5 w-5 text-orange-600" />
            Chat Triggers
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-slate-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Proactively open the chat based on visitor behavior to increase engagement
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable Triggers</p>
              <p className="text-xs text-slate-500">Auto-open chat based on visitor behavior</p>
            </div>
            <Switch
              checked={triggersEnabled}
              onCheckedChange={setTriggersEnabled}
            />
          </div>

          {triggersEnabled && (
            <div className="space-y-4 border-t pt-4">
              {/* Time Delay Trigger */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-700">Open after</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={timeDelayEnabled}
                    onCheckedChange={setTimeDelayEnabled}
                  />
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={timeDelaySeconds}
                    onChange={(e) => setTimeDelaySeconds(e.target.value)}
                    className="w-20"
                    disabled={!timeDelayEnabled}
                  />
                  <span className="text-sm text-slate-500">seconds</span>
                </div>
              </div>

              {/* Scroll Depth Trigger */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-700">Open at scroll</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={scrollDepthEnabled}
                    onCheckedChange={setScrollDepthEnabled}
                  />
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={scrollDepthPercent}
                    onChange={(e) => setScrollDepthPercent(e.target.value)}
                    className="w-20"
                    disabled={!scrollDepthEnabled}
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>

              {/* Exit Intent Trigger */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4 text-slate-400" />
                  <div>
                    <span className="text-sm text-slate-700">Exit intent</span>
                    <p className="text-xs text-slate-500">When mouse leaves viewport</p>
                  </div>
                </div>
                <Switch
                  checked={exitIntentEnabled}
                  onCheckedChange={setExitIntentEnabled}
                />
              </div>

              {/* Once Per Session */}
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <span className="text-sm text-slate-700">Once per session</span>
                  <p className="text-xs text-slate-500">Don&apos;t trigger again after refresh</p>
                </div>
                <Switch
                  checked={oncePerSession}
                  onCheckedChange={setOncePerSession}
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Trigger Settings"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Render Test Tab Content
  const renderTestTab = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Test Your AI
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-slate-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Preview how your AI responds to questions based on your settings and uploaded documents
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setTestMessages([
                {
                  id: 1,
                  sender: "bot",
                  content: welcomeMessage,
                },
              ])
            }
          >
            Reset Chat
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-slate-50">
              {/* Chat Messages */}
              <ScrollArea className="h-[400px] p-4">
                <div className="space-y-4">
                  {testMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${
                        msg.sender === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          msg.sender === "user"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-purple-100 text-purple-600"
                        }`}
                      >
                        {msg.sender === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-md rounded-lg p-3 ${
                          msg.sender === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-900 shadow-sm"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-lg bg-white p-3 shadow-sm">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t bg-white p-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a test message..."
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendTestMessage();
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendTestMessage}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isTyping}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Questions */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-slate-700">
              Sample Questions
            </h4>
            <p className="mb-4 text-xs text-slate-500">
              Click a question to test how your AI responds based on uploaded content
            </p>
            <div className="space-y-2">
              {sampleQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSampleQuestion(question)}
                  className="w-full rounded-lg border bg-white p-3 text-left text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  {question}
                </button>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                <Sparkles className="h-4 w-4" />
                Pro Tip
              </div>
              <p className="mt-1 text-xs text-purple-600">
                Upload more documents to improve your AI&apos;s accuracy. The more context you provide, the better it can answer customer questions.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Agent</h1>
            <p className="text-slate-500">
              Configure and train your AI assistant
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">
                {agentEnabled ? "Agent Active" : "Agent Inactive"}
              </span>
              <Switch
                checked={agentEnabled}
                onCheckedChange={setAgentEnabled}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            <Badge
              className={
                agentEnabled
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-600"
              }
            >
              {agentEnabled ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-white px-6 py-2">
          <Suspense fallback={<div className="h-10" />}>
            <AgentTabs />
          </Suspense>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          {currentTab === "training" && renderTrainingTab()}
          {currentTab === "skills" && <SkillsTab />}
          {currentTab === "settings" && renderSettingsTab()}
          {currentTab === "behavior" && renderBehaviorTab()}
          {currentTab === "test" && renderTestTab()}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function AIAgentPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <AIAgentPageContent />
    </Suspense>
  );
}
