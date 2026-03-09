"use client";

import { useEffect, useRef } from "react";
import grapesjs, { Editor } from "grapesjs";
import newsletterPreset from "grapesjs-preset-newsletter";
import "grapesjs/dist/css/grapes.min.css";

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
      <p>Your email content goes here. Use the blocks on the right to add images, buttons, dividers and more.</p>
    </td>
  </tr>
  <tr>
    <td style="background-color:#f8fafc;padding:15px 30px;text-align:center;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">MACt &bull; Unit 3C, 919-925 Nudgee Road, Banyo QLD 4014</p>
    </td>
  </tr>
</table>
`;

interface GrapesEditorProps {
  onEditor: (editor: Editor) => void;
  existingDesign?: Record<string, unknown> | null;
}

export default function GrapesEditorComponent({ onEditor, existingDesign }: GrapesEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);

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
        appendTo: "#blocks-panel",
      },
      styleManager: {
        appendTo: "#styles-panel",
        sectors: [
          {
            name: "Dimension",
            open: false,
            buildProps: ["width", "min-height", "padding"],
          },
          {
            name: "Typography",
            open: false,
            buildProps: [
              "font-family",
              "font-size",
              "font-weight",
              "letter-spacing",
              "color",
              "line-height",
              "text-align",
              "text-decoration",
              "text-transform",
            ],
          },
          {
            name: "Decorations",
            open: false,
            buildProps: [
              "background-color",
              "border-radius",
              "border",
              "box-shadow",
            ],
          },
          {
            name: "Extra",
            open: false,
            buildProps: ["opacity", "transition"],
          },
        ],
      },
      layerManager: {
        appendTo: "#layers-panel",
      },
    });

    // Add custom blocks for email building
    const bm = editor.Blocks;

    bm.add("spacer", {
      label: "Spacer",
      category: "Custom",
      content: `<div style="height:40px;line-height:40px;font-size:1px;" data-gjs-type="spacer">&nbsp;</div>`,
    });

    bm.add("header-block", {
      label: "Header",
      category: "Custom",
      content: `<table style="width:100%;background-color:#1a1a1a;">
        <tr>
          <td style="padding:20px;text-align:center;">
            <img src="https://mact.au/wp-content/uploads/mact-logo-white.png" alt="MACt" style="width:140px;" />
          </td>
        </tr>
      </table>`,
    });

    bm.add("hero-section", {
      label: "Hero Section",
      category: "Custom",
      content: `<table style="width:100%;background-color:#f1f5f9;">
        <tr>
          <td style="padding:40px 30px;text-align:center;">
            <h1 style="font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 15px;">Your Headline Here</h1>
            <p style="font-size:16px;color:#64748b;margin:0 0 25px;line-height:1.6;">A compelling description that encourages your readers to take action.</p>
            <a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Call to Action</a>
          </td>
        </tr>
      </table>`,
    });

    bm.add("two-column", {
      label: "2 Columns",
      category: "Custom",
      content: `<table style="width:100%;">
        <tr>
          <td style="width:50%;padding:15px;vertical-align:top;">
            <p style="font-size:14px;color:#333;">Column 1 content</p>
          </td>
          <td style="width:50%;padding:15px;vertical-align:top;">
            <p style="font-size:14px;color:#333;">Column 2 content</p>
          </td>
        </tr>
      </table>`,
    });

    bm.add("three-column", {
      label: "3 Columns",
      category: "Custom",
      content: `<table style="width:100%;">
        <tr>
          <td style="width:33.33%;padding:15px;vertical-align:top;">
            <p style="font-size:14px;color:#333;">Column 1</p>
          </td>
          <td style="width:33.33%;padding:15px;vertical-align:top;">
            <p style="font-size:14px;color:#333;">Column 2</p>
          </td>
          <td style="width:33.33%;padding:15px;vertical-align:top;">
            <p style="font-size:14px;color:#333;">Column 3</p>
          </td>
        </tr>
      </table>`,
    });

    bm.add("image-text", {
      label: "Image + Text",
      category: "Custom",
      content: `<table style="width:100%;">
        <tr>
          <td style="width:40%;padding:15px;vertical-align:top;">
            <img src="https://placehold.co/250x200/e2e8f0/64748b?text=Image" alt="Image" style="width:100%;border-radius:6px;" />
          </td>
          <td style="width:60%;padding:15px;vertical-align:top;">
            <h3 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 10px;">Feature Title</h3>
            <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">Describe this feature or product in a few sentences. Keep it brief and compelling.</p>
          </td>
        </tr>
      </table>`,
    });

    bm.add("product-card", {
      label: "Product Card",
      category: "Custom",
      content: `<table style="width:100%;max-width:280px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:0;">
            <img src="https://placehold.co/280x200/f1f5f9/64748b?text=Product" alt="Product" style="width:100%;display:block;" />
          </td>
        </tr>
        <tr>
          <td style="padding:15px;text-align:center;">
            <h4 style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Product Name</h4>
            <p style="font-size:14px;color:#64748b;margin:0 0 12px;">$49.99</p>
            <a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:8px 20px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:500;">Shop Now</a>
          </td>
        </tr>
      </table>`,
    });

    bm.add("social-links", {
      label: "Social Links",
      category: "Custom",
      content: `<table style="width:100%;">
        <tr>
          <td style="padding:20px;text-align:center;">
            <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">Facebook</a>
            <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">Instagram</a>
            <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">LinkedIn</a>
            <a href="#" style="display:inline-block;margin:0 8px;text-decoration:none;color:#64748b;font-size:13px;">Website</a>
          </td>
        </tr>
      </table>`,
    });

    bm.add("footer-block", {
      label: "Footer",
      category: "Custom",
      content: `<table style="width:100%;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
        <tr>
          <td style="padding:20px 30px;text-align:center;">
            <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">MACt &bull; Unit 3C, 919-925 Nudgee Road, Banyo QLD 4014</p>
            <p style="font-size:11px;color:#94a3b8;margin:0;"><a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a></p>
          </td>
        </tr>
      </table>`,
    });

    bm.add("coupon-block", {
      label: "Coupon",
      category: "Custom",
      content: `<table style="width:100%;max-width:400px;margin:0 auto;border:2px dashed #2563eb;border-radius:8px;">
        <tr>
          <td style="padding:25px;text-align:center;">
            <p style="font-size:12px;color:#64748b;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Your Discount Code</p>
            <p style="font-size:28px;font-weight:700;color:#2563eb;margin:0 0 5px;letter-spacing:3px;">{{coupon_code}}</p>
            <p style="font-size:13px;color:#94a3b8;margin:0;">Use at checkout for your exclusive offer</p>
          </td>
        </tr>
      </table>`,
    });

    // Load existing design or default
    if (existingDesign) {
      editor.loadProjectData(existingDesign as Parameters<Editor["loadProjectData"]>[0]);
    } else {
      editor.setComponents(DEFAULT_EMAIL_HTML);
    }

    editorInstanceRef.current = editor;
    onEditor(editor);

    return () => {
      editor.destroy();
      editorInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ height: "100%", width: "100%", display: "flex" }}>
      {/* Left panel: Blocks, Styles, Layers tabs */}
      <div
        style={{
          width: "280px",
          minWidth: "280px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #e2e8f0",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        {/* Tab buttons */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          <button
            className="gjs-tab-btn"
            data-tab="blocks"
            onClick={(e) => {
              const parent = e.currentTarget.parentElement?.parentElement;
              if (!parent) return;
              parent.querySelectorAll<HTMLElement>(".gjs-tab-content").forEach(el => el.style.display = "none");
              parent.querySelectorAll<HTMLElement>(".gjs-tab-btn").forEach(el => {
                el.style.borderBottom = "2px solid transparent";
                el.style.color = "#64748b";
              });
              const target = parent.querySelector<HTMLElement>("#blocks-panel");
              if (target) target.style.display = "block";
              e.currentTarget.style.borderBottom = "2px solid #2563eb";
              e.currentTarget.style.color = "#1e293b";
            }}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderBottom: "2px solid #2563eb",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "#1e293b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Blocks
          </button>
          <button
            className="gjs-tab-btn"
            data-tab="styles"
            onClick={(e) => {
              const parent = e.currentTarget.parentElement?.parentElement;
              if (!parent) return;
              parent.querySelectorAll<HTMLElement>(".gjs-tab-content").forEach(el => el.style.display = "none");
              parent.querySelectorAll<HTMLElement>(".gjs-tab-btn").forEach(el => {
                el.style.borderBottom = "2px solid transparent";
                el.style.color = "#64748b";
              });
              const target = parent.querySelector<HTMLElement>("#styles-panel");
              if (target) target.style.display = "block";
              e.currentTarget.style.borderBottom = "2px solid #2563eb";
              e.currentTarget.style.color = "#1e293b";
            }}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderBottom: "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Styles
          </button>
          <button
            className="gjs-tab-btn"
            data-tab="layers"
            onClick={(e) => {
              const parent = e.currentTarget.parentElement?.parentElement;
              if (!parent) return;
              parent.querySelectorAll<HTMLElement>(".gjs-tab-content").forEach(el => el.style.display = "none");
              parent.querySelectorAll<HTMLElement>(".gjs-tab-btn").forEach(el => {
                el.style.borderBottom = "2px solid transparent";
                el.style.color = "#64748b";
              });
              const target = parent.querySelector<HTMLElement>("#layers-panel");
              if (target) target.style.display = "block";
              e.currentTarget.style.borderBottom = "2px solid #2563eb";
              e.currentTarget.style.color = "#1e293b";
            }}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderBottom: "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Layers
          </button>
        </div>
        {/* Panel content areas */}
        <div id="blocks-panel" className="gjs-tab-content" style={{ flex: 1, overflow: "auto", padding: "8px" }} />
        <div id="styles-panel" className="gjs-tab-content" style={{ flex: 1, overflow: "auto", padding: "8px", display: "none" }} />
        <div id="layers-panel" className="gjs-tab-content" style={{ flex: 1, overflow: "auto", padding: "8px", display: "none" }} />
      </div>

      {/* Editor canvas */}
      <div
        ref={editorContainerRef}
        style={{ flex: 1, height: "100%", overflow: "hidden" }}
      />

      {/* Inject custom styles for GrapesJS */}
      <style>{`
        /* Clean up GrapesJS default chrome */
        .gjs-one-bg { background-color: #ffffff !important; }
        .gjs-two-color { color: #334155 !important; }
        .gjs-three-bg { background-color: #f8fafc !important; }
        .gjs-four-color, .gjs-four-color-h:hover { color: #2563eb !important; }
        .gjs-cv-canvas { background-color: #f1f5f9 !important; }

        /* Hide GrapesJS default top panels — we have our own top bar */
        .gjs-pn-panels { display: none !important; }

        /* Block styling */
        .gjs-blocks-cs { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
        .gjs-block {
          padding: 10px 6px !important;
          min-height: auto !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
          background: #f8fafc !important;
          cursor: grab !important;
          text-align: center !important;
          font-size: 12px !important;
          transition: all 0.15s !important;
        }
        .gjs-block:hover {
          border-color: #2563eb !important;
          background: #eff6ff !important;
        }
        .gjs-block__media { display: none !important; }
        .gjs-block-label {
          font-size: 11px !important;
          font-weight: 500 !important;
          color: #475569 !important;
        }

        /* Category headers */
        .gjs-block-category .gjs-title {
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #1e293b !important;
          padding: 8px 4px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: transparent !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }

        /* Style manager */
        .gjs-sm-sector .gjs-sm-sector-title {
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #1e293b !important;
          padding: 8px 4px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          background: transparent !important;
        }
        .gjs-field { border: 1px solid #e2e8f0 !important; border-radius: 4px !important; }
        .gjs-field input { font-size: 12px !important; }

        /* Layer manager */
        .gjs-layers { font-size: 12px !important; }
        .gjs-layer-name { font-size: 12px !important; }

        /* Canvas frame */
        .gjs-frame-wrapper { overflow: auto !important; }
      `}</style>
    </div>
  );
}
