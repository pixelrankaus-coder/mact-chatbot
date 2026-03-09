"use client";

import { useEffect, useRef, useState } from "react";
import grapesjs, { Editor } from "grapesjs";
import newsletterPreset from "grapesjs-preset-newsletter";
import "grapesjs/dist/css/grapes.min.css";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  LayoutList,
  Code,
  Video,
  MessageSquareQuote,
  PanelBottom,
  LayoutTemplate,
  Rows3,
  Sparkles,
} from "lucide-react";

// Default email HTML template for new emails
const DEFAULT_EMAIL_HTML = `
<table style="width:100%;max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="background-color:#1a1a1a;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
      <img src="https://mact.au/wp-content/uploads/mact-logo-white.png" alt="MACt" style="width:140px;" />
    </td>
  </tr>
  <tr>
    <td style="background-color:#ffffff;padding:30px;font-size:15px;line-height:1.6;color:#333333;">
      <p>Hi {{first_name}},</p>
      <p>Your email content goes here. Drag blocks from the left to build your email.</p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#f8fafc;padding:15px 30px;text-align:center;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">MACt &bull; Unit 3C, 919-925 Nudgee Road, Banyo QLD 4014</p>
    </td>
  </tr>
</table>
`;

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
      { id: "hero-section", label: "Drop shadow", icon: Eclipse },
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
}

export default function GrapesEditorComponent({ onEditor, existingDesign }: GrapesEditorProps) {
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
      // Render style manager into our custom panel
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

    // Remove all default blocks from the newsletter preset so we control the order
    // We keep them registered for drag/drop — they just won't appear in the default block manager

    // Add our custom blocks
    const bm = editor.Blocks;

    bm.add("spacer", {
      label: "Spacer",
      category: "",
      content: `<div style="height:40px;line-height:40px;font-size:1px;">&nbsp;</div>`,
    });

    bm.add("header-block", {
      label: "Header",
      category: "",
      content: `<table style="width:100%;background-color:#1a1a1a;"><tr><td style="padding:20px;text-align:center;"><img src="https://mact.au/wp-content/uploads/mact-logo-white.png" alt="MACt" style="width:140px;" /></td></tr></table>`,
    });

    bm.add("hero-section", {
      label: "Hero",
      category: "",
      content: `<table style="width:100%;background-color:#f1f5f9;"><tr><td style="padding:40px 30px;text-align:center;"><h1 style="font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 15px;">Your Headline Here</h1><p style="font-size:16px;color:#64748b;margin:0 0 25px;line-height:1.6;">A compelling description that encourages readers to take action.</p><a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Call to Action</a></td></tr></table>`,
    });

    bm.add("two-column", {
      label: "2 Columns",
      category: "",
      content: `<table style="width:100%;"><tr><td style="width:50%;padding:15px;vertical-align:top;"><p style="font-size:14px;color:#333;">Column 1 content</p></td><td style="width:50%;padding:15px;vertical-align:top;"><p style="font-size:14px;color:#333;">Column 2 content</p></td></tr></table>`,
    });

    bm.add("three-column", {
      label: "3 Columns",
      category: "",
      content: `<table style="width:100%;"><tr><td style="width:33.33%;padding:15px;vertical-align:top;"><p>Column 1</p></td><td style="width:33.33%;padding:15px;vertical-align:top;"><p>Column 2</p></td><td style="width:33.33%;padding:15px;vertical-align:top;"><p>Column 3</p></td></tr></table>`,
    });

    bm.add("image-text", {
      label: "Image + Text",
      category: "",
      content: `<table style="width:100%;"><tr><td style="width:40%;padding:15px;vertical-align:top;"><img src="https://placehold.co/250x200/e2e8f0/64748b?text=Image" alt="Image" style="width:100%;border-radius:6px;" /></td><td style="width:60%;padding:15px;vertical-align:top;"><h3 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 10px;">Feature Title</h3><p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">Description text here.</p></td></tr></table>`,
    });

    bm.add("product-card", {
      label: "Product",
      category: "",
      content: `<table style="width:100%;max-width:280px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;"><tr><td style="padding:0;"><img src="https://placehold.co/280x200/f1f5f9/64748b?text=Product" alt="Product" style="width:100%;display:block;" /></td></tr><tr><td style="padding:15px;text-align:center;"><h4 style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Product Name</h4><p style="font-size:14px;color:#64748b;margin:0 0 12px;">$49.99</p><a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:8px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:500;">Shop Now</a></td></tr></table>`,
    });

    bm.add("social-links", {
      label: "Social links",
      category: "",
      content: `<table style="width:100%;"><tr><td style="padding:20px;text-align:center;"><a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">Facebook</a><a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">Instagram</a><a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">LinkedIn</a></td></tr></table>`,
    });

    bm.add("footer-block", {
      label: "Footer",
      category: "",
      content: `<table style="width:100%;background-color:#f8fafc;border-top:1px solid #e2e8f0;"><tr><td style="padding:20px 30px;text-align:center;"><p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">MACt &bull; Unit 3C, 919-925 Nudgee Road, Banyo QLD 4014</p><p style="font-size:11px;color:#94a3b8;margin:0;"><a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a></p></td></tr></table>`,
    });

    bm.add("coupon-block", {
      label: "Coupon",
      category: "",
      content: `<table style="width:100%;max-width:400px;margin:0 auto;border:2px dashed #2563eb;border-radius:8px;"><tr><td style="padding:25px;text-align:center;"><p style="font-size:12px;color:#64748b;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Your Discount Code</p><p style="font-size:28px;font-weight:700;color:#2563eb;margin:0 0 5px;letter-spacing:3px;">{{coupon_code}}</p><p style="font-size:13px;color:#94a3b8;margin:0;">Use at checkout for your exclusive offer</p></td></tr></table>`,
    });

    bm.add("video-block", {
      label: "Video",
      category: "",
      content: `<table style="width:100%;"><tr><td style="padding:15px;text-align:center;"><a href="#" style="display:block;position:relative;"><img src="https://placehold.co/560x315/1a1a1a/ffffff?text=▶+Video" alt="Video" style="width:100%;max-width:560px;border-radius:8px;" /></a><p style="font-size:12px;color:#94a3b8;margin:8px 0 0;">Click to watch video</p></td></tr></table>`,
    });

    bm.add("html-block", {
      label: "HTML",
      category: "",
      content: `<div style="padding:15px;"><!-- Custom HTML here --><p style="font-size:14px;color:#64748b;text-align:center;padding:20px;border:1px dashed #cbd5e1;border-radius:4px;">Custom HTML Block</p></div>`,
    });

    // Load existing design or default
    if (existingDesign) {
      editor.loadProjectData(existingDesign as Parameters<Editor["loadProjectData"]>[0]);
    } else {
      editor.setComponents(DEFAULT_EMAIL_HTML);
    }

    editorInstanceRef.current = editor;
    setEditorReady(true);
    onEditor(editor);

    return () => {
      editor.destroy();
      editorInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag block into GrapesJS canvas
  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    const block = editor.Blocks.get(blockId);
    if (block) {
      // Use GrapesJS drag API
      e.dataTransfer.setData("text/plain", blockId);
      e.dataTransfer.effectAllowed = "copy";
      // Trigger GrapesJS block drag
      const content = block.get("content");
      if (content) {
        editor.Commands.run("core:component-drag", {
          event: e.nativeEvent,
          result: typeof content === "string" ? { content } : content,
        });
      }
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Left sidebar — Klaviyo style */}
      <div className="w-[300px] min-w-[300px] h-full flex flex-col border-r bg-white">
        {/* Tabs: Content / Styles */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("content")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "content"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Content
            {activeTab === "content" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("styles")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "styles"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Styles
            {activeTab === "styles" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Content tab */}
        {activeTab === "content" && (
          <ScrollArea className="flex-1">
            <div className="p-4">
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
                          draggable
                          onDragStart={(e) => handleDragStart(e, block.id)}
                          onClick={() => {
                            // Click to add at bottom
                            const editor = editorInstanceRef.current;
                            if (!editor) return;
                            const b = editor.Blocks.get(block.id);
                            if (b) {
                              const content = b.get("content");
                              if (typeof content === "string") {
                                editor.addComponents(content);
                              }
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border cursor-grab",
                            "bg-card hover:bg-accent hover:border-primary/30 transition-all",
                            "active:cursor-grabbing select-none relative"
                          )}
                        >
                          {/* "New" badge */}
                          {"isNew" in block && block.isNew && (
                            <div className="absolute -top-1.5 -right-1.5">
                              <span className="flex items-center gap-0.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                <Sparkles className="h-2.5 w-2.5" />
                                New
                              </span>
                            </div>
                          )}
                          {/* Drag dots */}
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

        {/* Styles tab — GrapesJS style manager renders here */}
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
      <div
        ref={editorContainerRef}
        className="flex-1 h-full overflow-hidden"
      />

      {/* Override GrapesJS default styles */}
      <style>{`
        /* Hide GrapesJS default panels — we have our own sidebar + top bar */
        .gjs-pn-panels { display: none !important; }
        /* Hide default block manager (we render our own) */
        .gjs-blocks-cs { display: none !important; }

        /* Canvas */
        .gjs-cv-canvas { background-color: #f1f5f9 !important; }
        .gjs-frame-wrapper { overflow: auto !important; }

        /* Style manager theme */
        .gjs-one-bg { background-color: #ffffff !important; }
        .gjs-two-color { color: #334155 !important; }
        .gjs-three-bg { background-color: #f8fafc !important; }
        .gjs-four-color, .gjs-four-color-h:hover { color: hsl(var(--primary)) !important; }

        #gjs-styles-panel .gjs-sm-sector .gjs-sm-sector-title {
          font-size: 13px !important;
          font-weight: 600 !important;
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
        #gjs-styles-panel .gjs-field input {
          font-size: 12px !important;
          color: hsl(var(--foreground)) !important;
        }
        #gjs-styles-panel .gjs-sm-label {
          font-size: 12px !important;
          color: hsl(var(--muted-foreground)) !important;
        }

        /* Selected component highlight */
        .gjs-selected { outline: 2px solid hsl(var(--primary)) !important; }
        .gjs-hovered { outline: 1px dashed hsl(var(--primary) / 0.5) !important; }

        /* Toolbar */
        .gjs-toolbar {
          background: hsl(var(--primary)) !important;
          border-radius: 6px !important;
        }
        .gjs-toolbar-item { color: white !important; }

        /* RTE (rich text editor) */
        .gjs-rte-toolbar {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        }
      `}</style>
    </div>
  );
}
