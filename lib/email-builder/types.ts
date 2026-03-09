// ─── Email Builder Block Types ───────────────────────────────────────────────

export type BlockType =
  | "text"
  | "image"
  | "button"
  | "columns"
  | "section"
  | "divider"
  | "spacer"
  | "social"
  | "header"
  | "footer"
  | "hero"
  | "product"
  | "coupon"
  | "video"
  | "html"
  | "quote";

// ─── Shared Style Types ─────────────────────────────────────────────────────

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Border {
  width: number;
  style: "solid" | "dashed" | "dotted" | "none";
  color: string;
  radius: number;
}

export type Alignment = "left" | "center" | "right";

// ─── Block Props ─────────────────────────────────────────────────────────────

export interface TextBlockProps {
  content: string; // HTML string (rich text)
  fontSize: number;
  lineHeight: number;
  color: string;
  alignment: Alignment;
  padding: Padding;
  backgroundColor: string;
}

export interface ImageBlockProps {
  src: string;
  alt: string;
  href: string;
  width: "full" | number; // "full" = 100%, number = fixed px
  alignment: Alignment;
  padding: Padding;
  backgroundColor: string;
  border: Border;
}

export interface ButtonBlockProps {
  text: string;
  href: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  alignment: Alignment;
  padding: Padding;
  borderRadius: number;
  fullWidth: boolean;
  containerBackgroundColor: string;
  containerPadding: Padding;
}

export interface ColumnsBlockProps {
  columns: ColumnDef[];
  gap: number;
  padding: Padding;
  backgroundColor: string;
}

export interface ColumnDef {
  id: string;
  width: number; // percentage, e.g. 50
  blocks: EmailBlock[];
}

export interface DividerBlockProps {
  style: "solid" | "dashed" | "dotted";
  color: string;
  thickness: number;
  width: number; // percentage
  padding: Padding;
  backgroundColor: string;
}

export interface SpacerBlockProps {
  height: number;
  backgroundColor: string;
}

export interface SocialLink {
  platform: "facebook" | "instagram" | "twitter" | "linkedin" | "youtube" | "tiktok" | "website" | "x" | "snapchat" | "pinterest" | "android" | "custom";
  url: string;
  customIconUrl?: string;
  label?: string;
}

export interface SocialBlockProps {
  links: SocialLink[];
  iconSize: number;
  iconStyle: "color" | "black" | "grey" | "white";
  alignment: Alignment;
  spacing: number;
  padding: Padding;
  backgroundColor: string;
}

export interface HeaderBlockProps {
  logoSrc: string;
  logoWidth: number;
  logoHref: string;
  backgroundColor: string;
  padding: Padding;
  alignment: Alignment;
}

export interface FooterBlockProps {
  content: string; // HTML
  fontSize: number;
  color: string;
  alignment: Alignment;
  padding: Padding;
  backgroundColor: string;
}

export interface HeroBlockProps {
  imageSrc: string;
  heading: string;
  subheading: string;
  buttonText: string;
  buttonHref: string;
  buttonColor: string;
  buttonTextColor: string;
  headingColor: string;
  subheadingColor: string;
  backgroundColor: string;
  padding: Padding;
  imagePosition: "above" | "below" | "background";
  alignment: Alignment;
}

export interface ProductBlockProps {
  imageSrc: string;
  name: string;
  description: string;
  price: string;
  buttonText: string;
  buttonHref: string;
  buttonColor: string;
  buttonTextColor: string;
  padding: Padding;
  backgroundColor: string;
  imagePosition: "left" | "right" | "top";
}

export interface CouponBlockProps {
  code: string;
  description: string;
  fontSize: number;
  codeColor: string;
  codeBgColor: string;
  descriptionColor: string;
  padding: Padding;
  backgroundColor: string;
  borderStyle: "solid" | "dashed" | "dotted";
  borderColor: string;
  alignment: Alignment;
}

export interface VideoBlockProps {
  thumbnailSrc: string;
  videoUrl: string;
  alt: string;
  padding: Padding;
  backgroundColor: string;
  alignment: Alignment;
}

export interface SectionBlockProps {
  blocks: EmailBlock[];
  backgroundColor: string;
  padding: Padding;
  borderTop: { width: number; color: string };
  borderBottom: { width: number; color: string };
}

export interface HtmlBlockProps {
  content: string; // raw HTML
  padding: Padding;
}

export interface QuoteBlockProps {
  content: string;
  author: string;
  fontSize: number;
  color: string;
  quoteColor: string;
  alignment: Alignment;
  padding: Padding;
  backgroundColor: string;
}

// ─── Block Union ─────────────────────────────────────────────────────────────

export type BlockPropsMap = {
  text: TextBlockProps;
  image: ImageBlockProps;
  button: ButtonBlockProps;
  columns: ColumnsBlockProps;
  section: SectionBlockProps;
  divider: DividerBlockProps;
  spacer: SpacerBlockProps;
  social: SocialBlockProps;
  header: HeaderBlockProps;
  footer: FooterBlockProps;
  hero: HeroBlockProps;
  product: ProductBlockProps;
  coupon: CouponBlockProps;
  video: VideoBlockProps;
  html: HtmlBlockProps;
  quote: QuoteBlockProps;
};

export interface EmailBlock<T extends BlockType = BlockType> {
  id: string;
  type: T;
  props: BlockPropsMap[T];
}

// ─── Design Document ─────────────────────────────────────────────────────────

export interface EmailDesign {
  version: 1;
  bodySettings: {
    backgroundColor: string;
    contentWidth: number; // default 600
    fontFamily: string;
  };
  blocks: EmailBlock[];
}

// ─── Editor API (exposed to page.tsx) ────────────────────────────────────────

export interface EmailBuilderApi {
  getHtml: () => string;
  getDesignJson: () => EmailDesign;
  loadDesign: (design: EmailDesign) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// ─── Merge Tags ──────────────────────────────────────────────────────────────

export const MERGE_TAGS = [
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
] as const;
