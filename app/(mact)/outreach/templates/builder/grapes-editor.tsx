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
      panels: { defaults: [] },
    });

    // Add custom blocks for email building
    const bm = editor.Blocks;

    bm.add("spacer", {
      label: "Spacer",
      category: "Basic",
      content: `<div style="height:40px;line-height:40px;font-size:1px;" data-gjs-type="spacer">&nbsp;</div>`,
      attributes: { class: "fa fa-arrows-v" },
    });

    bm.add("header-block", {
      label: "Header",
      category: "Sections",
      content: `<table style="width:100%;background-color:#1a1a1a;">
        <tr>
          <td style="padding:20px;text-align:center;">
            <img src="https://mact.au/wp-content/uploads/mact-logo-white.png" alt="MACt" style="width:140px;" />
          </td>
        </tr>
      </table>`,
      attributes: { class: "fa fa-header" },
    });

    bm.add("hero-section", {
      label: "Hero Section",
      category: "Sections",
      content: `<table style="width:100%;background-color:#f1f5f9;">
        <tr>
          <td style="padding:40px 30px;text-align:center;">
            <h1 style="font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 15px;">Your Headline Here</h1>
            <p style="font-size:16px;color:#64748b;margin:0 0 25px;line-height:1.6;">A compelling description that encourages your readers to take action.</p>
            <a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Call to Action</a>
          </td>
        </tr>
      </table>`,
      attributes: { class: "fa fa-image" },
    });

    bm.add("two-column", {
      label: "2 Columns",
      category: "Sections",
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
      attributes: { class: "fa fa-columns" },
    });

    bm.add("three-column", {
      label: "3 Columns",
      category: "Sections",
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
      attributes: { class: "fa fa-th" },
    });

    bm.add("image-text", {
      label: "Image + Text",
      category: "Sections",
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
      attributes: { class: "fa fa-picture-o" },
    });

    bm.add("product-card", {
      label: "Product Card",
      category: "Sections",
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
      attributes: { class: "fa fa-shopping-bag" },
    });

    bm.add("social-links", {
      label: "Social Links",
      category: "Basic",
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
      attributes: { class: "fa fa-share-alt" },
    });

    bm.add("footer-block", {
      label: "Footer",
      category: "Sections",
      content: `<table style="width:100%;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
        <tr>
          <td style="padding:20px 30px;text-align:center;">
            <p style="font-size:12px;color:#94a3b8;margin:0 0 8px;">MACt &bull; Unit 3C, 919-925 Nudgee Road, Banyo QLD 4014</p>
            <p style="font-size:11px;color:#94a3b8;margin:0;"><a href="{{unsubscribe_url}}" style="color:#94a3b8;">Unsubscribe</a></p>
          </td>
        </tr>
      </table>`,
      attributes: { class: "fa fa-ellipsis-h" },
    });

    bm.add("coupon-block", {
      label: "Coupon",
      category: "Basic",
      content: `<table style="width:100%;max-width:400px;margin:0 auto;border:2px dashed #2563eb;border-radius:8px;">
        <tr>
          <td style="padding:25px;text-align:center;">
            <p style="font-size:12px;color:#64748b;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Your Discount Code</p>
            <p style="font-size:28px;font-weight:700;color:#2563eb;margin:0 0 5px;letter-spacing:3px;">{{coupon_code}}</p>
            <p style="font-size:13px;color:#94a3b8;margin:0;">Use at checkout for your exclusive offer</p>
          </td>
        </tr>
      </table>`,
      attributes: { class: "fa fa-ticket" },
    });

    // Load existing design or default
    if (existingDesign) {
      editor.loadProjectData(existingDesign as Parameters<Editor["loadProjectData"]>[0]);
    } else {
      editor.setComponents(DEFAULT_EMAIL_HTML);
    }

    // Style the GrapesJS UI to match our app
    const editorEl = editorContainerRef.current;
    if (editorEl) {
      const style = document.createElement("style");
      style.textContent = `
        .gjs-one-bg { background-color: #ffffff; }
        .gjs-two-color { color: #334155; }
        .gjs-three-bg { background-color: #f1f5f9; }
        .gjs-four-color, .gjs-four-color-h:hover { color: #2563eb; }
        .gjs-pn-panel { border: none; }
        .gjs-block { min-height: auto; padding: 10px; }
        .gjs-block__media { display: none; }
        .gjs-block-label { font-size: 12px; }
        .gjs-cv-canvas { background-color: #f1f5f9; }
        .gjs-frame-wrapper { overflow: auto; }
        .gjs-category-title { font-size: 13px; font-weight: 600; }
        /* Hide default panels — we have our own top bar */
        .gjs-pn-panels { display: none; }
      `;
      editorEl.appendChild(style);
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
    <div
      ref={editorContainerRef}
      style={{ height: "100%", width: "100%" }}
    />
  );
}
