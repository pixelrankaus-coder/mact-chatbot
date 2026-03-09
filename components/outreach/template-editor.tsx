"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Variable,
  Code,
  Eye,
} from "lucide-react";
import { TEMPLATE_VARIABLES } from "@/lib/outreach/templates";

// Convert {{variable}} text to visual chip HTML for the editor
function textToEditorHtml(text: string): string {
  if (!text) return "";
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_match, varName) =>
      `<span data-var="${varName}" contenteditable="false" class="variable-chip">\u200B{{${varName}}}\u200B</span>`
  );
}

// Convert editor HTML back to storage format (chips → {{variable}})
function editorHtmlToStorage(html: string): string {
  if (!html) return "";
  // Replace chip spans with {{variable}}
  let result = html.replace(
    /<span[^>]*data-var="(\w+)"[^>]*>[^<]*<\/span>/gi,
    "{{$1}}"
  );
  // Clean up zero-width spaces
  result = result.replace(/\u200B/g, "");
  return result;
}

interface TemplateEditorProps {
  body: string;
  onChange: (html: string) => void;
}

export function TemplateEditor({ body, onChange }: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlSource, setHtmlSource] = useState("");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const savedSelection = useRef<Range | null>(null);
  const isInitialized = useRef(false);

  // Initialize editor content from body prop
  useEffect(() => {
    if (editorRef.current && !isInitialized.current && body !== undefined) {
      editorRef.current.innerHTML = textToEditorHtml(body);
      isInitialized.current = true;
    }
  }, [body]);

  // When body changes externally (e.g., loading template), update editor
  useEffect(() => {
    if (editorRef.current && isInitialized.current) {
      const currentStorage = editorHtmlToStorage(editorRef.current.innerHTML);
      if (currentStorage !== body) {
        editorRef.current.innerHTML = textToEditorHtml(body);
      }
    }
  }, [body]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const storageHtml = editorHtmlToStorage(editorRef.current.innerHTML);
      onChange(storageHtml);
    }
  }, [onChange]);

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelection.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelection.current);
      }
    }
  };

  const insertVariable = (variable: string) => {
    editorRef.current?.focus();
    const chipHtml = `<span data-var="${variable}" contenteditable="false" class="variable-chip">\u200B{{${variable}}}\u200B</span>\u200B`;
    document.execCommand("insertHTML", false, chipHtml);
    handleInput();
  };

  const openLinkDialog = () => {
    saveSelection();
    const selection = window.getSelection();
    const text = selection?.toString() || "";
    setLinkText(text);
    setLinkUrl("");
    setShowLinkDialog(true);
  };

  const insertLink = () => {
    if (!linkUrl) return;
    let url = linkUrl;
    if (!url.match(/^https?:\/\//)) {
      url = "https://" + url;
    }
    const text = linkText || url;
    restoreSelection();
    editorRef.current?.focus();

    // Delete selection first, then insert link
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.getRangeAt(0).deleteContents();
    }
    document.execCommand(
      "insertHTML",
      false,
      `<a href="${url}">${text}</a>`
    );

    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");
    handleInput();
  };

  const toggleHtmlView = () => {
    if (!showHtml) {
      // Switching to HTML view
      const storageHtml = editorHtmlToStorage(
        editorRef.current?.innerHTML || ""
      );
      setHtmlSource(storageHtml);
    } else {
      // Switching back to visual view
      if (editorRef.current) {
        editorRef.current.innerHTML = textToEditorHtml(htmlSource);
        onChange(htmlSource);
      }
    }
    setShowHtml(!showHtml);
  };

  const handleHtmlSourceChange = (value: string) => {
    setHtmlSource(value);
  };

  // Handle paste - strip complex formatting, keep basic tags
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // Prevent Enter from creating divs — use <br> instead
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      handleInput();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Email Body</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleHtmlView}
            title={showHtml ? "Visual editor" : "HTML source"}
          >
            {showHtml ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!showHtml && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1 p-1 border rounded-t-md bg-slate-50 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => execCommand("bold")}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => execCommand("italic")}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => execCommand("underline")}
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => execCommand("insertUnorderedList")}
              title="Bullet list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => execCommand("insertOrderedList")}
              title="Numbered list"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs"
              onClick={openLinkDialog}
              title="Insert link"
            >
              <Link2 className="h-4 w-4" />
              Link
            </Button>

            <div className="w-px h-5 bg-slate-300 mx-1" />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs"
                >
                  <Variable className="h-4 w-4" />
                  Variable
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100 flex items-center justify-between"
                      onClick={() => insertVariable(v.key)}
                    >
                      <span className="font-mono text-xs text-blue-600">
                        {`{{${v.key}}}`}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {v.example}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* ContentEditable Editor */}
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[300px] p-3 border border-t-0 rounded-b-md text-sm font-[family-name:var(--font-poppins)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_.variable-chip]:inline-flex [&_.variable-chip]:items-center [&_.variable-chip]:bg-blue-100 [&_.variable-chip]:text-blue-700 [&_.variable-chip]:px-1.5 [&_.variable-chip]:py-0.5 [&_.variable-chip]:rounded [&_.variable-chip]:text-xs [&_.variable-chip]:font-mono [&_.variable-chip]:mx-0.5 [&_.variable-chip]:cursor-default [&_.variable-chip]:select-none [&_a]:text-blue-600 [&_a]:underline"
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            suppressContentEditableWarning
            data-placeholder="Start writing your email..."
          />
        </>
      )}

      {showHtml && (
        <textarea
          value={htmlSource}
          onChange={(e) => handleHtmlSourceChange(e.target.value)}
          className="w-full min-h-[350px] p-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          spellCheck={false}
        />
      )}

      {/* Insert Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Add a clickable hyperlink to your email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editorLinkUrl">URL</Label>
              <Input
                id="editorLinkUrl"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && insertLink()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editorLinkText">Link Text</Label>
              <Input
                id="editorLinkText"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Click here"
                onKeyDown={(e) => e.key === "Enter" && insertLink()}
              />
              <p className="text-xs text-slate-500">
                Leave blank to use the URL as the text
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLinkDialog(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={insertLink}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Placeholder styles - using regular style tag since styled-jsx may not be configured */}
      <style dangerouslySetInnerHTML={{ __html: `
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}} />
    </div>
  );
}
