"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import grapesjs, { Editor } from "grapesjs";
import newsletterPreset from "grapesjs-preset-newsletter";
import "grapesjs/dist/css/grapes.min.css";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Type,
  Image,
  Columns3,
  MousePointerClick,
  PanelTop,
  Eclipse,
  Minus,
  Heart,
  ArrowUpDown,
  ShoppingBag,
  Ticket,
  LayoutGrid,
  Code,
  Video,
  MessageSquareQuote,
  PanelBottom,
  LayoutTemplate,
  Rows3,
  Sparkles,
  LayoutList,
  Undo2,
  Redo2,
  Braces,
} from "lucide-react";

// Klaviyo-style starter template: header bar, empty content zone, social icons, footer
const STARTER_TEMPLATE = `
<table style="width:100%;max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;" data-gjs-type="mj-body">
  <tr>
    <td style="background-color:#f8f8f8;padding:24px 20px;text-align:center;">
      <img src="https://placehold.co/120x40/f8f8f8/1a1a1a?text=LOGO" alt="Logo" style="width:120px;" />
    </td>
  </tr>
  <tr>
    <td style="background-color:#ffffff;padding:40px 30px;text-align:center;min-height:120px;">
      <p style="font-size:16px;color:#94a3b8;margin:0;">Drop content here</p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px;text-align:center;background-color:#ffffff;border-top:1px solid #f1f5f9;">
      <a href="#" style="display:inline-block;margin:0 6px;"><img src="https://placehold.co/24x24/1a1a1a/ffffff?text=X" alt="Twitter" style="width:24px;height:24px;" /></a>
      <a href="#" style="display:inline-block;margin:0 6px;"><img src="https://placehold.co/24x24/1a1a1a/ffffff?text=f" alt="Facebook" style="width:24px;height:24px;" /></a>
      <a href="#" style="display:inline-block;margin:0 6px;"><img src="https://placehold.co/24x24/1a1a1a/ffffff?text=in" alt="Instagram" style="width:24px;height:24px;" /></a>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 20px;text-align:center;background-color:#ffffff;">
      <p style="font-size:11px;color:#94a3b8;margin:0 0 4px;">No longer want to receive these emails? <a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a>.</p>
      <p style="font-size:11px;color:#94a3b8;margin:0;">{{company_name}} {{company_address}}</p>
    </td>
  </tr>
</table>
`;

// Merge tags for template variables
const MERGE_TAGS = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Company", value: "{{company}}" },
  { label: "Last Product", value: "{{last_product}}" },
  { label: "Last Order Date", value: "{{last_order_date}}" },
  { label: "Days Since Order", value: "{{days_since_order}}" },
  { label: "Total Spent", value: "{{total_spent}}" },
  { label: "Order Count", value: "{{order_count}}" },
  { label: "Coupon Code", value: "{{coupon_code}}" },
  { label: "Order Number", value: "{{order_number}}" },
  { label: "Invoice Number", value: "{{invoice_number}}" },
  { label: "Invoice Total", value: "{{invoice_total}}" },
  { label: "Amount Due", value: "{{amount_due}}" },
];

// Block definitions with icons — Klaviyo-style
const BLOCK_DEFS = {
  blocks: {
    label: "Blocks",
    items: [
      { id: "text", label: "Text", icon: Type },
      { id: "image", label: "Image", icon: Image },
      { id: "sect50", label: "Split", icon: Columns3 },
      { id: "button", label: "Button", icon: MousePointerClick },
      { id: "header-block", label: "Header bar", icon: PanelTop },
      { id: "hero-section", label: "Hero", icon: Eclipse },
      { id: "divider", label: "Divider", icon: Minus },
      { id: "social-links", label: "Social links", icon: Heart },
      { id: "spacer", label: "Spacer", icon: ArrowUpDown },
      { id: "product-card", label: "Product", icon: ShoppingBag },
      { id: "coupon-block", label: "Coupon", icon: Ticket, isNew: true },
      { id: "grid-items", label: "Table", icon: LayoutGrid },
      { id: "quote", label: "Review quote", icon: MessageSquareQuote },
      { id: "video-block", label: "Video", icon: Video },
      { id: "html-block", label: "HTML", icon: Code },
    ],
  },
  layout: {
    label: "Layout",
    items: [
      { id: "two-column", label: "Columns", icon: Columns3 },
      { id: "sect100", label: "Section", icon: LayoutTemplate },
      { id: "three-column", label: "3 Columns", icon: Rows3 },
      { id: "footer-block", label: "Footer", icon: PanelBottom },
      { id: "image-text", label: "Image + Text", icon: LayoutList },
    ],
  },
};

interface GrapesEditorProps {
  onEditor: (editor: Editor) => void;
  existingDesign?: Record<string, unknown> | null;
  onUndoRedo?: (canUndo: boolean, canRedo: boolean) => void;
}

export default function GrapesEditorComponent({ onEditor, existingDesign, onUndoRedo }: GrapesEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "styles">("content");
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (!editorContainerRef.current || editorInstanceRef.current) return;

    const editor = grapesjs.init({
      container: editorContainerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      plugins: [newsletterPreset],
      pluginsOpts: {
        [newsletterPreset as unknown as string]: {
          modalTitleImport: "Import template",
          modalTitleExport: "Export template",
          importPlaceholder: "<table>...</table>",
          cellStyle: {
            "font-size": "14px",
            "font-family": "Arial, Helvetica, sans-serif",
            color: "#333333",
          },
        },
      },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Mobile portrait", width: "375px" },
        ],
      },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
        ],
      },
      blockManager: {
        appendTo: "#gjs-hidden-blocks",
      },
      styleManager: {
        appendTo: "#gjs-styles-panel",
        sectors: [
          {
            name: "Dimension",
            open: true,
            buildProps: ["width", "min-height", "padding"],
          },
          {
            name: "Typography",
            open: true,
            buildProps: [
              "font-family", "font-size", "font-weight", "letter-spacing",
              "color", "line-height", "text-align", "text-decoration",
            ],
          },
          {
            name: "Decorations",
            open: false,
            buildProps: ["background-color", "border-radius", "border", "box-shadow"],
          },
        ],
      },
    });

    // Track undo/redo state
    const updateUndoRedo = () => {
      if (onUndoRedo) {
        const um = editor.UndoManager;
        onUndoRedo(um.hasUndo(), um.hasRedo());
      }
    };
    editor.on("change:changesCount", updateUndoRedo);

    // Register custom blocks
    const bm = editor.Blocks;
    const W = "width:100%;max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;";

    bm.add("spacer", {
      label: "Spacer", category: "",
      content: `<table style="${W}"><tr><td><div style="height:40px;line-height:40px;font-size:1px;">&nbsp;</div></td></tr></table>`,
    });
    bm.add("header-block", {
      label: "Header", category: "",
      content: `<table style="${W}background-color:#f8f8f8;"><tr><td style="padding:24px 20px;text-align:center;"><img src="https://placehold.co/120x40/f8f8f8/1a1a1a?text=LOGO" alt="Logo" style="width:120px;" /></td></tr></table>`,
    });
    bm.add("hero-section", {
      label: "Hero", category: "",
      content: `<table style="${W}background-color:#f1f5f9;"><tr><td style="padding:40px 30px;text-align:center;"><h1 style="font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 15px;">Your Headline Here</h1><p style="font-size:16px;color:#64748b;margin:0 0 25px;line-height:1.6;">A compelling description that encourages readers to take action.</p><a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Call to Action</a></td></tr></table>`,
    });
    bm.add("two-column", {
      label: "2 Columns", category: "",
      content: `<table style="${W}"><tr><td style="width:50%;padding:15px;vertical-align:top;"><p style="font-size:14px;color:#333;">Column 1 content</p></td><td style="width:50%;padding:15px;vertical-align:top;"><p style="font-size:14px;color:#333;">Column 2 content</p></td></tr></table>`,
    });
    bm.add("three-column", {
      label: "3 Columns", category: "",
      content: `<table style="${W}"><tr><td style="width:33.33%;padding:15px;vertical-align:top;"><p>Column 1</p></td><td style="width:33.33%;padding:15px;vertical-align:top;"><p>Column 2</p></td><td style="width:33.33%;padding:15px;vertical-align:top;"><p>Column 3</p></td></tr></table>`,
    });
    bm.add("image-text", {
      label: "Image + Text", category: "",
      content: `<table style="${W}"><tr><td style="width:40%;padding:15px;vertical-align:top;"><img src="https://placehold.co/250x200/e2e8f0/64748b?text=Image" alt="Image" style="width:100%;border-radius:6px;" /></td><td style="width:60%;padding:15px;vertical-align:top;"><h3 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 10px;">Feature Title</h3><p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">Description text here.</p></td></tr></table>`,
    });
    bm.add("product-card", {
      label: "Product", category: "",
      content: `<table style="${W}max-width:280px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;"><tr><td style="padding:0;"><img src="https://placehold.co/280x200/f1f5f9/64748b?text=Product" alt="Product" style="width:100%;display:block;" /></td></tr><tr><td style="padding:15px;text-align:center;"><h4 style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Product Name</h4><p style="font-size:14px;color:#64748b;margin:0 0 12px;">$49.99</p><a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:8px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:500;">Shop Now</a></td></tr></table>`,
    });
    bm.add("social-links", {
      label: "Social links", category: "",
      content: `<table style="${W}"><tr><td style="padding:20px;text-align:center;"><a href="#" style="display:inline-block;margin:0 6px;"><img src="https://placehold.co/24x24/1a1a1a/ffffff?text=X" alt="Twitter" style="width:24px;height:24px;" /></a><a href="#" style="display:inline-block;margin:0 6px;"><img src="https://placehold.co/24x24/1a1a1a/ffffff?text=f" alt="Facebook" style="width:24px;height:24px;" /></a><a href="#" style="display:inline-block;margin:0 6px;"><img src="https://placehold.co/24x24/1a1a1a/ffffff?text=in" alt="Instagram" style="width:24px;height:24px;" /></a></td></tr></table>`,
    });
    bm.add("footer-block", {
      label: "Footer", category: "",
      content: `<table style="${W}"><tr><td style="padding:16px 20px;text-align:center;"><p style="font-size:11px;color:#94a3b8;margin:0 0 4px;">No longer want to receive these emails? <a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a>.</p><p style="font-size:11px;color:#94a3b8;margin:0;">{{company_name}} {{company_address}}</p></td></tr></table>`,
    });
    bm.add("coupon-block", {
      label: "Coupon", category: "",
      content: `<table style="${W}max-width:400px;border:2px dashed #2563eb;border-radius:8px;"><tr><td style="padding:25px;text-align:center;"><p style="font-size:12px;color:#64748b;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Your Discount Code</p><p style="font-size:28px;font-weight:700;color:#2563eb;margin:0 0 5px;letter-spacing:3px;">{{coupon_code}}</p><p style="font-size:13px;color:#94a3b8;margin:0;">Use at checkout for your exclusive offer</p></td></tr></table>`,
    });
    bm.add("video-block", {
      label: "Video", category: "",
      content: `<table style="${W}"><tr><td style="padding:15px;text-align:center;"><a href="#" style="display:block;"><img src="https://placehold.co/560x315/1a1a1a/ffffff?text=%E2%96%B6+Video" alt="Video" style="width:100%;max-width:560px;border-radius:8px;" /></a></td></tr></table>`,
    });
    bm.add("html-block", {
      label: "HTML", category: "",
      content: `<table style="${W}"><tr><td style="padding:15px;"><p style="font-size:14px;color:#64748b;text-align:center;padding:20px;border:1px dashed #cbd5e1;border-radius:4px;">Custom HTML Block</p></td></tr></table>`,
    });

    // Make all top-level components draggable/sortable
    editor.on("component:add", (component: ReturnType<Editor["getWrapper"]>) => {
      if (component && component.parent()?.is("wrapper")) {
        component.set({
          draggable: true,
          droppable: true,
          hoverable: true,
          selectable: true,
          removable: true,
          copyable: true,
          moveable: true,
        });
      }
    });

    // Load existing design or starter template
    if (existingDesign) {
      editor.loadProjectData(existingDesign as Parameters<Editor["loadProjectData"]>[0]);
    } else {
      editor.setComponents(STARTER_TEMPLATE);
    }

    // Clear undo history after loading default template
    setTimeout(() => {
      editor.UndoManager.clear();
      updateUndoRedo();
    }, 100);

    editorInstanceRef.current = editor;
    setEditorReady(true);
    onEditor(editor);

    return () => {
      editor.destroy();
      editorInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click to add block at end
  const handleBlockClick = useCallback((blockId: string) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    const block = editor.Blocks.get(blockId);
    if (!block) return;

    const content = block.get("content");
    if (!content) return;

    const wrapper = editor.getWrapper();
    if (!wrapper) return;

    wrapper.append(content);

    const canvasEl = editor.Canvas.getBody();
    if (canvasEl) {
      setTimeout(() => { canvasEl.scrollTop = canvasEl.scrollHeight; }, 100);
    }
  }, []);

  // Proxy drag from our custom card to GrapesJS's hidden block manager
  const handleBlockMouseDown = useCallback((e: React.MouseEvent, blockId: string) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    const hiddenPanel = document.getElementById("gjs-hidden-blocks");
    if (!hiddenPanel) return;

    const gjsBlockEl = hiddenPanel.querySelector(`.gjs-block[data-gjs-block="${blockId}"]`) as HTMLElement;
    if (!gjsBlockEl) return;

    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true, cancelable: true,
      clientX: e.clientX, clientY: e.clientY,
      button: 0,
    });
    gjsBlockEl.dispatchEvent(mouseDownEvent);
  }, []);

  // Insert merge tag into the active RTE
  const insertMergeTag = useCallback((tag: string) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    // Try inserting into active RTE (rich text editor)
    const rte = editor.RichTextEditor;
    const activeRte = rte?.getToolbarEl()?.style.display !== "none";
    if (activeRte) {
      document.execCommand("insertText", false, tag);
    } else {
      // If no RTE active, add as text block
      const wrapper = editor.getWrapper();
      if (wrapper) {
        wrapper.append(`<table style="width:100%;max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:15px 30px;"><p style="font-size:15px;color:#333;">${tag}</p></td></tr></table>`);
      }
    }
  }, []);

  return (
    <div className="flex h-full w-full">
      {/* Hidden container for GrapesJS block manager */}
      <div id="gjs-hidden-blocks" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }} />

      {/* Left sidebar */}
      <div className="w-[300px] min-w-[300px] h-full flex flex-col border-r bg-white">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("content")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "content" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Content
            {activeTab === "content" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button
            onClick={() => setActiveTab("styles")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "styles" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Styles
            {activeTab === "styles" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>

        {/* Content tab */}
        {activeTab === "content" && (
          <ScrollArea className="flex-1">
            <div className="p-4">
              {/* Merge tags */}
              <div className="mb-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                      <Braces className="h-3.5 w-3.5" />
                      Insert Merge Tag
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="start">
                    <ScrollArea className="max-h-64">
                      {MERGE_TAGS.map((tag) => (
                        <button
                          key={tag.value}
                          onClick={() => insertMergeTag(tag.value)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors flex items-center justify-between"
                        >
                          <span>{tag.label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{tag.value}</span>
                        </button>
                      ))}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              <Separator className="mb-4" />

              {Object.entries(BLOCK_DEFS).map(([key, section]) => (
                <div key={key} className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    {section.label}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map((block) => {
                      const Icon = block.icon;
                      return (
                        <div
                          key={block.id}
                          onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                          onClick={() => handleBlockClick(block.id)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border cursor-grab",
                            "bg-card hover:bg-accent hover:border-primary/30 transition-all",
                            "active:cursor-grabbing select-none relative"
                          )}
                        >
                          {"isNew" in block && block.isNew && (
                            <div className="absolute -top-1.5 -right-1.5">
                              <span className="flex items-center gap-0.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                <Sparkles className="h-2.5 w-2.5" />
                                New
                              </span>
                            </div>
                          )}
                          <div className="absolute top-1 right-1 opacity-30">
                            <svg width="10" height="10" viewBox="0 0 10 10">
                              <circle cx="2" cy="2" r="1" fill="currentColor" />
                              <circle cx="6" cy="2" r="1" fill="currentColor" />
                              <circle cx="2" cy="6" r="1" fill="currentColor" />
                              <circle cx="6" cy="6" r="1" fill="currentColor" />
                              <circle cx="2" cy="10" r="1" fill="currentColor" />
                              <circle cx="6" cy="10" r="1" fill="currentColor" />
                            </svg>
                          </div>
                          <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                          <span className="text-[11px] font-medium text-muted-foreground leading-tight text-center">
                            {block.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Styles tab */}
        {activeTab === "styles" && (
          <ScrollArea className="flex-1">
            <div id="gjs-styles-panel" className="p-4" />
            {!editorReady && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Loading styles...
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      {/* Editor canvas */}
      <div ref={editorContainerRef} className="flex-1 h-full overflow-hidden" />

      {/* GrapesJS style overrides */}
      <style>{`
        .gjs-pn-panels { display: none !important; }
        .gjs-cv-canvas { background-color: #f1f5f9 !important; }
        .gjs-frame-wrapper { overflow: auto !important; }
        .gjs-one-bg { background-color: #ffffff !important; }
        .gjs-two-color { color: #334155 !important; }
        .gjs-three-bg { background-color: #f8fafc !important; }
        .gjs-four-color, .gjs-four-color-h:hover { color: hsl(var(--primary)) !important; }

        /* Styles panel */
        #gjs-styles-panel .gjs-sm-sector .gjs-sm-sector-title {
          font-size: 13px !important; font-weight: 600 !important;
          color: hsl(var(--foreground)) !important;
          padding: 10px 0 !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          background: transparent !important;
        }
        #gjs-styles-panel .gjs-field {
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 6px !important;
          background: hsl(var(--background)) !important;
        }
        #gjs-styles-panel .gjs-field input { font-size: 12px !important; color: hsl(var(--foreground)) !important; }
        #gjs-styles-panel .gjs-sm-label { font-size: 12px !important; color: hsl(var(--muted-foreground)) !important; }

        /* Selection */
        .gjs-selected { outline: 2px solid hsl(var(--primary)) !important; }
        .gjs-hovered { outline: 1px dashed hsl(var(--primary) / 0.5) !important; }

        /* Toolbar — component action buttons */
        .gjs-toolbar {
          background: hsl(var(--primary)) !important;
          border-radius: 6px !important;
          padding: 2px !important;
          gap: 2px !important;
        }
        .gjs-toolbar-item {
          color: white !important;
          width: 28px !important;
          height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 4px !important;
          font-size: 14px !important;
        }
        .gjs-toolbar-item:hover { background: rgba(255,255,255,0.2) !important; }

        /* RTE */
        .gjs-rte-toolbar {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        }

        /* Drag placeholder */
        .gjs-placeholder {
          border: 2px dashed hsl(var(--primary)) !important;
          background: hsl(var(--primary) / 0.05) !important;
        }

        /* Badge (component label) */
        .gjs-badge {
          background: hsl(var(--primary)) !important;
          font-size: 10px !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }

        /* Component hover shows grab cursor */
        .gjs-comp-selected, .gjs-comp-hover { cursor: move !important; }
      `}</style>
    </div>
  );
}

// Export for use in page.tsx
export { type Editor };
