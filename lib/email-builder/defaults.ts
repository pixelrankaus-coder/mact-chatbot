import type {
  BlockType,
  BlockPropsMap,
  EmailDesign,
  EmailBlock,
  Padding,
  ColumnDef,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0;
export function uid(): string {
  return `blk_${Date.now()}_${++counter}`;
}

export const pad = (v: number): Padding => ({
  top: v,
  right: v,
  bottom: v,
  left: v,
});

export const padXY = (x: number, y: number): Padding => ({
  top: y,
  right: x,
  bottom: y,
  left: x,
});

// ─── Default Props Per Block Type ────────────────────────────────────────────

export const DEFAULT_PROPS: { [K in BlockType]: () => BlockPropsMap[K] } = {
  text: () => ({
    content: "<p>Click to edit text. Add your content here.</p>",
    fontSize: 16,
    lineHeight: 1.5,
    color: "#333333",
    alignment: "left",
    padding: padXY(20, 12),
    backgroundColor: "",
  }),

  image: () => ({
    src: "",
    alt: "Image",
    href: "",
    width: "full" as const,
    alignment: "center",
    padding: padXY(20, 10),
    backgroundColor: "",
    border: { width: 0, style: "solid", color: "#cccccc", radius: 0 },
  }),

  button: () => ({
    text: "Click here",
    href: "https://",
    fontSize: 16,
    color: "#ffffff",
    backgroundColor: "#0066cc",
    alignment: "center",
    padding: padXY(32, 14),
    borderRadius: 6,
    fullWidth: false,
    containerBackgroundColor: "",
    containerPadding: padXY(20, 12),
  }),

  columns: () => ({
    columns: [
      { id: uid(), width: 50, blocks: [] },
      { id: uid(), width: 50, blocks: [] },
    ] as ColumnDef[],
    gap: 16,
    padding: padXY(20, 10),
    backgroundColor: "",
  }),

  section: () => ({
    blocks: [] as EmailBlock[],
    backgroundColor: "#ffffff",
    padding: padXY(20, 24),
    borderTop: { width: 0, color: "#e0e0e0" },
    borderBottom: { width: 0, color: "#e0e0e0" },
  }),

  divider: () => ({
    style: "solid" as const,
    color: "#e0e0e0",
    thickness: 1,
    width: 100,
    padding: padXY(20, 16),
    backgroundColor: "",
  }),

  spacer: () => ({
    height: 32,
    backgroundColor: "",
  }),

  social: () => ({
    links: [
      { platform: "facebook" as const, url: "https://facebook.com/" },
      { platform: "instagram" as const, url: "https://instagram.com/" },
      { platform: "linkedin" as const, url: "https://linkedin.com/" },
    ],
    iconSize: 32,
    iconStyle: "color" as const,
    alignment: "center",
    padding: padXY(20, 16),
    backgroundColor: "",
  }),

  header: () => ({
    logoSrc: "",
    logoWidth: 150,
    logoHref: "https://",
    backgroundColor: "#ffffff",
    padding: padXY(20, 16),
    alignment: "center",
  }),

  footer: () => ({
    content:
      '<p style="margin:0">Company Name<br>123 Street, City, State 12345</p><p style="margin:8px 0 0"><a href="{{unsubscribe_url}}" style="color:#999999">Unsubscribe</a></p>',
    fontSize: 12,
    color: "#999999",
    alignment: "center",
    padding: padXY(20, 24),
    backgroundColor: "#f5f5f5",
  }),

  hero: () => ({
    imageSrc: "",
    heading: "Your headline here",
    subheading: "Add a short description below.",
    buttonText: "Learn More",
    buttonHref: "https://",
    buttonColor: "#0066cc",
    buttonTextColor: "#ffffff",
    headingColor: "#111111",
    subheadingColor: "#555555",
    backgroundColor: "#f8f9fa",
    padding: padXY(32, 48),
    imagePosition: "above",
    alignment: "center",
  }),

  product: () => ({
    imageSrc: "",
    name: "Product Name",
    description: "Brief product description goes here.",
    price: "$0.00",
    buttonText: "Shop Now",
    buttonHref: "https://",
    buttonColor: "#0066cc",
    buttonTextColor: "#ffffff",
    padding: padXY(20, 16),
    backgroundColor: "",
    imagePosition: "top",
  }),

  coupon: () => ({
    code: "{{coupon_code}}",
    description: "Use this code at checkout",
    fontSize: 24,
    codeColor: "#0066cc",
    codeBgColor: "#f0f7ff",
    descriptionColor: "#666666",
    padding: padXY(24, 20),
    backgroundColor: "",
    borderStyle: "dashed",
    borderColor: "#0066cc",
    alignment: "center",
  }),

  video: () => ({
    thumbnailSrc: "",
    videoUrl: "https://",
    alt: "Video thumbnail",
    padding: padXY(20, 10),
    backgroundColor: "",
    alignment: "center",
  }),

  html: () => ({
    content: "<!-- Custom HTML -->\n<div>\n  \n</div>",
    padding: pad(0),
  }),

  quote: () => ({
    content: "This is an amazing product. Highly recommended!",
    author: "Happy Customer",
    fontSize: 18,
    color: "#333333",
    quoteColor: "#0066cc",
    alignment: "center",
    padding: padXY(32, 24),
    backgroundColor: "#f8f9fa",
  }),
};

// ─── Create a New Block ──────────────────────────────────────────────────────

export function createBlock<T extends BlockType>(type: T) {
  return {
    id: uid(),
    type,
    props: DEFAULT_PROPS[type](),
  };
}

// ─── Empty Design ────────────────────────────────────────────────────────────

export function emptyDesign(): EmailDesign {
  return {
    version: 1,
    bodySettings: {
      backgroundColor: "#f4f4f5",
      contentWidth: 600,
      fontFamily: "Arial, Helvetica, sans-serif",
    },
    blocks: [
      {
        id: uid(),
        type: "footer",
        props: {
          content:
            '<p style="margin:0">No longer want to receive these emails? <a href="{{unsubscribe_url}}" style="color:#999999;text-decoration:underline">Unsubscribe</a>.</p><p style="margin:4px 0 0">{{organization_name}} {{organization_full_address}}</p>',
          fontSize: 12,
          color: "#999999",
          alignment: "center" as const,
          padding: padXY(20, 24),
          backgroundColor: "#f5f5f5",
        },
      },
    ],
  };
}
