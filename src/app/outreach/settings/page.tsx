"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Eye,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Dynamic import to avoid SSR issues with Unlayer
const EmailEditor = dynamic(
  () => import("react-email-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-slate-100 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    ),
  }
);

// Default signature design matching Chris's Outlook signature
const DEFAULT_SIGNATURE_DESIGN = {
  counters: {
    u_row: 4,
    u_column: 4,
    u_content_text: 4,
    u_content_image: 1,
  },
  body: {
    id: "signature",
    rows: [
      {
        id: "row1",
        cells: [1],
        columns: [
          {
            id: "col1",
            contents: [
              {
                id: "text1",
                type: "text",
                values: {
                  containerPadding: "10px",
                  anchor: "",
                  textAlign: "left",
                  lineHeight: "140%",
                  linkStyle: {
                    inherit: true,
                    linkColor: "#0000ee",
                    linkHoverColor: "#0000ee",
                    linkUnderline: true,
                    linkHoverUnderline: true,
                  },
                  hideDesktop: false,
                  displayCondition: null,
                  _meta: { htmlID: "u_content_text_1", htmlClassNames: "u_content_text" },
                  selectable: true,
                  draggable: true,
                  duplicatable: true,
                  deletable: true,
                  hideable: true,
                  text: '<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;">Cheers,<br />Chris</p>',
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              borderRadius: "0px",
              _meta: { htmlID: "u_column_1", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
          padding: "0px",
          anchor: "",
          hideDesktop: false,
          _meta: { htmlID: "u_row_1", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      },
      {
        id: "row2",
        cells: [1, 2],
        columns: [
          {
            id: "col2",
            contents: [
              {
                id: "image1",
                type: "image",
                values: {
                  containerPadding: "20px",
                  anchor: "",
                  src: { url: "https://mact.au/wp-content/uploads/mact-logo-white.png", width: 120, height: 40 },
                  textAlign: "center",
                  altText: "MACt",
                  action: { name: "web", values: { href: "", target: "_blank" } },
                  hideDesktop: false,
                  displayCondition: null,
                  _meta: { htmlID: "u_content_image_1", htmlClassNames: "u_content_image" },
                  selectable: true,
                  draggable: true,
                  duplicatable: true,
                  deletable: true,
                  hideable: true,
                },
              },
            ],
            values: {
              backgroundColor: "#1a1a1a",
              padding: "10px",
              border: {},
              borderRadius: "8px 0 0 8px",
              _meta: { htmlID: "u_column_2", htmlClassNames: "u_column" },
            },
          },
          {
            id: "col3",
            contents: [
              {
                id: "text2",
                type: "text",
                values: {
                  containerPadding: "20px",
                  anchor: "",
                  textAlign: "left",
                  lineHeight: "160%",
                  linkStyle: {
                    inherit: false,
                    linkColor: "#00b4b4",
                    linkHoverColor: "#00b4b4",
                    linkUnderline: false,
                    linkHoverUnderline: true,
                  },
                  hideDesktop: false,
                  displayCondition: null,
                  _meta: { htmlID: "u_content_text_2", htmlClassNames: "u_content_text" },
                  selectable: true,
                  draggable: true,
                  duplicatable: true,
                  deletable: true,
                  hideable: true,
                  text: `<p style="font-size: 13px; line-height: 160%; color: #ffffff; font-family: arial, helvetica, sans-serif;"><strong style="font-size: 15px;">Chris Born</strong><br /><span style="color: #999999;">Technical Director / Founder</span><br /><br />Mobile 0405 606 234<br />Office 0466 334 630<br /><a rel="noopener" href="mailto:c.born@mact.au" target="_blank" style="color: #00b4b4;">c.born@mact.au</a><br />Unit 3C, 919-925 Nudgee Road,<br />Banyo, QLD 4014</p>`,
                },
              },
            ],
            values: {
              backgroundColor: "#1a1a1a",
              padding: "10px",
              border: {},
              borderRadius: "0 8px 8px 0",
              _meta: { htmlID: "u_column_3", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
          padding: "10px 0",
          anchor: "",
          hideDesktop: false,
          _meta: { htmlID: "u_row_2", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      },
      {
        id: "row3",
        cells: [1],
        columns: [
          {
            id: "col4",
            contents: [
              {
                id: "text3",
                type: "text",
                values: {
                  containerPadding: "15px 0",
                  anchor: "",
                  textAlign: "left",
                  lineHeight: "140%",
                  linkStyle: {
                    inherit: false,
                    linkColor: "#00b4b4",
                    linkHoverColor: "#00b4b4",
                    linkUnderline: false,
                    linkHoverUnderline: true,
                  },
                  hideDesktop: false,
                  displayCondition: null,
                  _meta: { htmlID: "u_content_text_3", htmlClassNames: "u_content_text" },
                  selectable: true,
                  draggable: true,
                  duplicatable: true,
                  deletable: true,
                  hideable: true,
                  text: `<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;"><a rel="noopener" href="https://mact.au" target="_blank" style="color: #00b4b4; font-weight: bold; text-decoration: none;">mact.au</a>&nbsp;&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">GFRC</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Mining</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Admixtures</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Concrete Chemicals</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Consulting</span></p>`,
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              borderRadius: "0px",
              _meta: { htmlID: "u_column_4", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
          padding: "0px",
          anchor: "",
          hideDesktop: false,
          _meta: { htmlID: "u_row_3", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      },
      {
        id: "row4",
        cells: [1],
        columns: [
          {
            id: "col5",
            contents: [
              {
                id: "text4",
                type: "text",
                values: {
                  containerPadding: "20px 0 0 0",
                  anchor: "",
                  textAlign: "left",
                  lineHeight: "150%",
                  linkStyle: { inherit: true, linkColor: "#0000ee", linkHoverColor: "#0000ee", linkUnderline: true, linkHoverUnderline: true },
                  hideDesktop: false,
                  displayCondition: null,
                  _meta: { htmlID: "u_content_text_4", htmlClassNames: "u_content_text" },
                  selectable: true,
                  draggable: true,
                  duplicatable: true,
                  deletable: true,
                  hideable: true,
                  text: `<p style="font-size: 10px; line-height: 150%; color: #999999; font-family: arial, helvetica, sans-serif;">Copyright 2023 by Mining and Cement Technology Pty Ltd. All rights reserved. This email may contain privileged/confidential information intended for the addressee. Attached materials remain the exclusive property of Mining and Cement Technology Pty Ltd, potentially constituting legally protected intellectual property. If you're not the intended recipient or responsible for delivery, don't copy or distribute this email. If received in error, notify us by phone. Mining and Cement Technology Pty Ltd isn't liable for unauthorized use. Company email traffic may be monitored. Thank you.</p>`,
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              borderRadius: "0px",
              _meta: { htmlID: "u_column_5", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
          padding: "0px",
          anchor: "",
          hideDesktop: false,
          _meta: { htmlID: "u_row_4", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      },
    ],
    values: {
      popupPosition: "center",
      popupWidth: "600px",
      popupHeight: "auto",
      borderRadius: "10px",
      contentAlign: "center",
      contentVerticalAlign: "center",
      contentWidth: "600px",
      fontFamily: { label: "Arial", value: "arial,helvetica,sans-serif" },
      textColor: "#000000",
      popupBackgroundColor: "#FFFFFF",
      popupBackgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "cover", position: "center" },
      popupOverlay_backgroundColor: "rgba(0, 0, 0, 0.1)",
      popupCloseButton_position: "top-right",
      popupCloseButton_backgroundColor: "#DDDDDD",
      popupCloseButton_iconColor: "#000000",
      popupCloseButton_borderRadius: "0px",
      popupCloseButton_margin: "0px",
      popupCloseButton_action: { name: "close_popup", attrs: { onClick: "document.querySelector('.u-popup-container').style.display = 'none';" } },
      backgroundColor: "#ffffff",
      backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
      preheaderText: "",
      linkStyle: { body: true, linkColor: "#0000ee", linkHoverColor: "#0000ee", linkUnderline: true, linkHoverUnderline: true },
      _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
    },
  },
  schemaVersion: 16,
};

interface EditorRef {
  editor?: {
    loadDesign: (design: Record<string, unknown>) => void;
    exportHtml: (callback: (data: { design: Record<string, unknown>; html: string }) => void) => void;
  };
}

export default function OutreachSettingsPage() {
  const router = useRouter();
  const emailEditorRef = useRef<EditorRef>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (editorReady && settings && emailEditorRef.current?.editor) {
      const design = (settings.signature_json as Record<string, unknown>) || DEFAULT_SIGNATURE_DESIGN;
      emailEditorRef.current.editor.loadDesign(design);
    }
  }, [editorReady, settings]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/outreach/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const onEditorReady = () => {
    setEditorReady(true);
  };

  const handleSave = async () => {
    if (!emailEditorRef.current?.editor) return;

    setSaving(true);

    emailEditorRef.current.editor.exportHtml(async (data) => {
      const { design, html } = data;

      try {
        const response = await fetch("/api/outreach/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature_json: design,
            signature_html: html,
          }),
        });

        if (response.ok) {
          toast.success("Signature saved successfully!");
        } else {
          toast.error("Failed to save signature");
        }
      } catch (error) {
        console.error("Error saving:", error);
        toast.error("Error saving signature");
      } finally {
        setSaving(false);
      }
    });
  };

  const handleReset = () => {
    if (confirm("Reset signature to default? This will discard your changes.")) {
      emailEditorRef.current?.editor?.loadDesign(DEFAULT_SIGNATURE_DESIGN);
      toast.info("Signature reset to default");
    }
  };

  const handlePreview = () => {
    emailEditorRef.current?.editor?.exportHtml((data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    });
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/outreach">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Email Signature Settings
            </h1>
            <p className="text-sm text-slate-500">
              Design the signature appended to all outreach emails
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button variant="outline" onClick={handlePreview} className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Signature
          </Button>
        </div>
      </div>

      {/* Editor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Signature Editor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-[700px]">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="border-t">
              <EmailEditor
                ref={emailEditorRef}
                onReady={onEditorReady}
                minHeight="700px"
                options={{
                  displayMode: "email",
                  features: {
                    textEditor: {
                      spellChecker: true,
                    },
                  },
                  appearance: {
                    theme: "light",
                    panels: {
                      tools: {
                        dock: "left",
                      },
                    },
                  },
                  tools: {
                    image: {
                      enabled: true,
                    },
                  },
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help text */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Drag blocks from the left panel to build your signature</li>
          <li>• Click any element to edit its content and styling</li>
          <li>• Use the Image block to add your logo (upload or paste URL)</li>
          <li>• This signature will be automatically added to all outreach emails</li>
          <li>• Click Preview to see how it will look in email clients</li>
        </ul>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Email Preview</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPreview(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="text-sm text-slate-500 mb-4">
                  <p>
                    <strong>From:</strong> Chris Born &lt;c.born@mact.au&gt;
                  </p>
                  <p>
                    <strong>Subject:</strong> Quick question about your project
                  </p>
                </div>
                <div className="bg-white p-4 rounded border">
                  <p className="mb-4">Hi Drew,</p>
                  <p className="mb-4">
                    It&apos;s been a while since you grabbed that product. I&apos;d love
                    to know how that project turned out!
                  </p>
                  <p className="mb-4">
                    Still working with GFRC? Happy to help if you need anything.
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
