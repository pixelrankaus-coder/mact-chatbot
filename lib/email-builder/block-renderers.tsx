"use client";

import React from "react";
import type {
  EmailBlock,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  ColumnsBlockProps,
  SectionBlockProps,
  DividerBlockProps,
  SpacerBlockProps,
  SocialBlockProps,
  HeaderBlockProps,
  FooterBlockProps,
  HeroBlockProps,
  ProductBlockProps,
  CouponBlockProps,
  VideoBlockProps,
  HtmlBlockProps,
  QuoteBlockProps,
  EmailDesign,
  Padding,
} from "./types";
import {
  Image as ImageIcon,
  Play,
  GripVertical,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function padStyle(p: Padding): React.CSSProperties {
  return {
    paddingTop: p.top,
    paddingRight: p.right,
    paddingBottom: p.bottom,
    paddingLeft: p.left,
  };
}

const SOCIAL_ICONS: Record<string, { label: string; color: string; letter: string }> = {
  facebook: { label: "Facebook", color: "#1877F2", letter: "f" },
  instagram: { label: "Instagram", color: "#E4405F", letter: "I" },
  twitter: { label: "X", color: "#000000", letter: "X" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", letter: "in" },
  youtube: { label: "YouTube", color: "#FF0000", letter: "Y" },
  tiktok: { label: "TikTok", color: "#000000", letter: "T" },
  website: { label: "Website", color: "#555555", letter: "W" },
};

// ─── Canvas Block Renderers ─────────────────────────────────────────────────

interface RendererProps<T> {
  props: T;
  design: EmailDesign;
  onUpdate?: (partial: Partial<T>) => void;
  selected?: boolean;
}

export function TextRenderer({ props: p, onUpdate }: RendererProps<TextBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        fontSize: p.fontSize,
        lineHeight: p.lineHeight,
        color: p.color,
        textAlign: p.alignment,
      }}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: p.content }}
        onBlur={(e) => onUpdate?.({ content: e.currentTarget.innerHTML })}
        className="outline-none min-h-[1em] cursor-text"
        style={{ fontFamily: "inherit" }}
      />
    </div>
  );
}

export function ImageRenderer({ props: p }: RendererProps<ImageBlockProps>) {
  const w = p.width === "full" ? "100%" : p.width;
  const borderStyle: React.CSSProperties = {
    borderWidth: p.border.width,
    borderStyle: p.border.style,
    borderColor: p.border.color,
    borderRadius: p.border.radius,
  };
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      {p.src ? (
        <img
          src={p.src}
          alt={p.alt}
          style={{ maxWidth: "100%", width: w, height: "auto", display: "inline-block", ...borderStyle }}
        />
      ) : (
        <div
          className="flex items-center justify-center text-slate-400"
          style={{
            width: w,
            maxWidth: "100%",
            height: 200,
            background: "#f1f5f9",
            display: "inline-flex",
            ...borderStyle,
          }}
        >
          <div className="text-center">
            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
            <span className="text-xs">Click to add image</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ButtonRenderer({ props: p }: RendererProps<ButtonBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.containerPadding),
        backgroundColor: p.containerBackgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      <span
        style={{
          display: p.fullWidth ? "block" : "inline-block",
          padding: `${p.padding.top}px ${p.padding.right}px ${p.padding.bottom}px ${p.padding.left}px`,
          backgroundColor: p.backgroundColor,
          color: p.color,
          fontSize: p.fontSize,
          fontWeight: 600,
          textDecoration: "none",
          borderRadius: p.borderRadius,
          textAlign: "center",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {p.text}
      </span>
    </div>
  );
}

interface ColumnsRendererProps extends RendererProps<ColumnsBlockProps> {
  renderBlock: (block: EmailBlock, columnId: string) => React.ReactNode;
  onDropInColumn?: (columnId: string, blockType: string) => void;
}

export function ColumnsRenderer({ props: p, renderBlock, onDropInColumn }: ColumnsRendererProps) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        display: "flex",
        gap: p.gap,
      }}
    >
      {p.columns.map((col) => (
        <div
          key={col.id}
          style={{ width: `${col.width}%`, minHeight: 60 }}
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.add("ring-2", "ring-blue-400", "ring-inset");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("ring-2", "ring-blue-400", "ring-inset");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.remove("ring-2", "ring-blue-400", "ring-inset");
            const blockType = e.dataTransfer.getData("text/block-type");
            if (blockType && onDropInColumn) {
              onDropInColumn(col.id, blockType);
            }
          }}
        >
          {col.blocks.length === 0 ? (
            <div className="h-full min-h-[60px] border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">
              Drop here
            </div>
          ) : (
            col.blocks.map((block) => renderBlock(block, col.id))
          )}
        </div>
      ))}
    </div>
  );
}

export function DividerRenderer({ props: p }: RendererProps<DividerBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: `${p.width}%`,
          margin: "0 auto",
          borderTop: `${p.thickness}px ${p.style} ${p.color}`,
        }}
      />
    </div>
  );
}

export function SpacerRenderer({ props: p }: RendererProps<SpacerBlockProps>) {
  return (
    <div
      style={{
        height: p.height,
        backgroundColor: p.backgroundColor || undefined,
        position: "relative",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <GripVertical className="h-4 w-4 text-slate-300" />
      </div>
    </div>
  );
}

export function SocialRenderer({ props: p }: RendererProps<SocialBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      {p.links
        .filter((l) => l.url)
        .map((l, i) => {
          const info = SOCIAL_ICONS[l.platform] || { label: l.platform, color: "#555", letter: "?" };
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: p.iconSize,
                height: p.iconSize,
                borderRadius: "50%",
                backgroundColor: info.color,
                color: "#fff",
                fontSize: Math.round(p.iconSize * 0.4),
                fontWeight: "bold",
                margin: "0 6px",
                cursor: "pointer",
              }}
            >
              {info.letter}
            </span>
          );
        })}
    </div>
  );
}

export function HeaderRenderer({ props: p }: RendererProps<HeaderBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      {p.logoSrc ? (
        <img
          src={p.logoSrc}
          alt="Logo"
          style={{ maxWidth: "100%", width: p.logoWidth, height: "auto", display: "inline-block" }}
        />
      ) : (
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#333" }}>Your Logo</div>
      )}
    </div>
  );
}

export function FooterRenderer({ props: p, onUpdate }: RendererProps<FooterBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        fontSize: p.fontSize,
        color: p.color,
        textAlign: p.alignment,
      }}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: p.content }}
        onBlur={(e) => onUpdate?.({ content: e.currentTarget.innerHTML })}
        className="outline-none min-h-[1em] cursor-text"
      />
    </div>
  );
}

export function HeroRenderer({ props: p }: RendererProps<HeroBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      {p.imageSrc && p.imagePosition === "above" && (
        <img src={p.imageSrc} alt="Hero" style={{ maxWidth: "100%", width: "100%", height: "auto", marginBottom: 24 }} />
      )}
      <h1 style={{ margin: "0 0 12px", fontSize: 32, fontWeight: "bold", color: p.headingColor }}>
        {p.heading}
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 16, color: p.subheadingColor, lineHeight: 1.5 }}>
        {p.subheading}
      </p>
      {p.buttonText && (
        <span
          style={{
            display: "inline-block",
            padding: "14px 32px",
            backgroundColor: p.buttonColor,
            color: p.buttonTextColor,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {p.buttonText}
        </span>
      )}
      {p.imageSrc && p.imagePosition === "below" && (
        <img src={p.imageSrc} alt="Hero" style={{ maxWidth: "100%", width: "100%", height: "auto", marginTop: 24 }} />
      )}
    </div>
  );
}

export function ProductRenderer({ props: p }: RendererProps<ProductBlockProps>) {
  const imgEl = p.imageSrc ? (
    <img src={p.imageSrc} alt={p.name} style={{ maxWidth: "100%", width: "100%", height: "auto" }} />
  ) : (
    <div className="flex items-center justify-center bg-slate-100 text-slate-400" style={{ width: "100%", height: 180 }}>
      <ImageIcon className="h-8 w-8" />
    </div>
  );

  if (p.imagePosition === "top") {
    return (
      <div style={{ ...padStyle(p.padding), backgroundColor: p.backgroundColor || undefined }}>
        {imgEl}
        <div style={{ padding: "16px 0 0" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#333" }}>{p.name}</h3>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#666" }}>{p.description}</p>
          <p style={{ margin: "0 0 16px", fontSize: 20, fontWeight: "bold", color: "#333" }}>{p.price}</p>
          <span
            style={{
              display: "inline-block",
              padding: "10px 24px",
              backgroundColor: p.buttonColor,
              color: p.buttonTextColor,
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {p.buttonText}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...padStyle(p.padding), backgroundColor: p.backgroundColor || undefined, display: "flex", gap: 16 }}>
      {p.imagePosition === "left" && <div style={{ width: "40%" }}>{imgEl}</div>}
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#333" }}>{p.name}</h3>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#666" }}>{p.description}</p>
        <p style={{ margin: "0 0 16px", fontSize: 20, fontWeight: "bold", color: "#333" }}>{p.price}</p>
        <span
          style={{
            display: "inline-block",
            padding: "10px 24px",
            backgroundColor: p.buttonColor,
            color: p.buttonTextColor,
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {p.buttonText}
        </span>
      </div>
      {p.imagePosition === "right" && <div style={{ width: "40%" }}>{imgEl}</div>}
    </div>
  );
}

export function CouponRenderer({ props: p }: RendererProps<CouponBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "20px 32px",
          border: `2px ${p.borderStyle} ${p.borderColor}`,
          backgroundColor: p.codeBgColor,
        }}
      >
        <div style={{ fontSize: p.fontSize, fontWeight: "bold", color: p.codeColor, letterSpacing: 3, fontFamily: "monospace" }}>
          {p.code}
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: p.descriptionColor }}>{p.description}</div>
      </div>
    </div>
  );
}

export function VideoRenderer({ props: p }: RendererProps<VideoBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", width: "100%" }}>
        {p.thumbnailSrc ? (
          <img src={p.thumbnailSrc} alt={p.alt} style={{ maxWidth: "100%", width: "100%", height: "auto" }} />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ width: "100%", height: 300, background: "#111" }}
          >
            <Play className="h-12 w-12 text-white" />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Play className="h-7 w-7 text-white" style={{ marginLeft: 3 }} />
        </div>
      </div>
    </div>
  );
}

export function HtmlRenderer({ props: p }: RendererProps<HtmlBlockProps>) {
  return (
    <div style={padStyle(p.padding)}>
      <div
        className="border border-dashed border-slate-300 rounded p-3 bg-slate-50"
        style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", color: "#666" }}
      >
        {p.content || "<!-- Custom HTML -->"}
      </div>
    </div>
  );
}

export function QuoteRenderer({ props: p }: RendererProps<QuoteBlockProps>) {
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        textAlign: p.alignment,
      }}
    >
      <div style={{ borderLeft: `4px solid ${p.quoteColor}`, padding: "12px 24px", textAlign: "left", display: "inline-block" }}>
        <p style={{ margin: "0 0 8px", fontSize: p.fontSize, fontStyle: "italic", color: p.color, lineHeight: 1.5 }}>
          &ldquo;{p.content}&rdquo;
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#999" }}>&mdash; {p.author}</p>
      </div>
    </div>
  );
}

// ─── Section Renderer ────────────────────────────────────────────────────────

interface SectionRendererProps extends RendererProps<SectionBlockProps> {
  renderBlock: (block: EmailBlock, columnId: string) => React.ReactNode;
  onDropInColumn?: (columnId: string, blockType: string) => void;
}

export function SectionRenderer({ props: p, renderBlock, onDropInColumn }: SectionRendererProps) {
  const sectionId = "section-inner";
  return (
    <div
      style={{
        ...padStyle(p.padding),
        backgroundColor: p.backgroundColor || undefined,
        borderTop: p.borderTop.width ? `${p.borderTop.width}px solid ${p.borderTop.color}` : undefined,
        borderBottom: p.borderBottom.width ? `${p.borderBottom.width}px solid ${p.borderBottom.color}` : undefined,
      }}
    >
      <div
        className="relative min-h-[60px]"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.add("ring-2", "ring-blue-400", "ring-inset");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("ring-2", "ring-blue-400", "ring-inset");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.remove("ring-2", "ring-blue-400", "ring-inset");
          const blockType = e.dataTransfer.getData("text/block-type");
          if (blockType && onDropInColumn) {
            onDropInColumn(sectionId, blockType);
          }
        }}
      >
        {p.blocks.length === 0 ? (
          <div className="min-h-[60px] border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">
            Drop content here
          </div>
        ) : (
          p.blocks.map((block) => renderBlock(block, sectionId))
        )}
      </div>
    </div>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

interface BlockRendererProps {
  block: EmailBlock;
  design: EmailDesign;
  selected?: boolean;
  onUpdate?: (partial: Record<string, unknown>) => void;
  renderNestedBlock?: (block: EmailBlock, columnId: string) => React.ReactNode;
  onDropInColumn?: (columnId: string, blockType: string) => void;
}

export function BlockRenderer({
  block,
  design,
  selected,
  onUpdate,
  renderNestedBlock,
  onDropInColumn,
}: BlockRendererProps) {
  const common = { design, selected, onUpdate };

  switch (block.type) {
    case "text":
      return <TextRenderer props={block.props as TextBlockProps} {...common} />;
    case "image":
      return <ImageRenderer props={block.props as ImageBlockProps} {...common} />;
    case "button":
      return <ButtonRenderer props={block.props as ButtonBlockProps} {...common} />;
    case "columns":
      return (
        <ColumnsRenderer
          props={block.props as ColumnsBlockProps}
          {...common}
          renderBlock={renderNestedBlock || (() => null)}
          onDropInColumn={onDropInColumn}
        />
      );
    case "section":
      return (
        <SectionRenderer
          props={block.props as SectionBlockProps}
          {...common}
          renderBlock={renderNestedBlock || (() => null)}
          onDropInColumn={onDropInColumn}
        />
      );
    case "divider":
      return <DividerRenderer props={block.props as DividerBlockProps} {...common} />;
    case "spacer":
      return <SpacerRenderer props={block.props as SpacerBlockProps} {...common} />;
    case "social":
      return <SocialRenderer props={block.props as SocialBlockProps} {...common} />;
    case "header":
      return <HeaderRenderer props={block.props as HeaderBlockProps} {...common} />;
    case "footer":
      return <FooterRenderer props={block.props as FooterBlockProps} {...common} />;
    case "hero":
      return <HeroRenderer props={block.props as HeroBlockProps} {...common} />;
    case "product":
      return <ProductRenderer props={block.props as ProductBlockProps} {...common} />;
    case "coupon":
      return <CouponRenderer props={block.props as CouponBlockProps} {...common} />;
    case "video":
      return <VideoRenderer props={block.props as VideoBlockProps} {...common} />;
    case "html":
      return <HtmlRenderer props={block.props as HtmlBlockProps} {...common} />;
    case "quote":
      return <QuoteRenderer props={block.props as QuoteBlockProps} {...common} />;
    default:
      return <div className="p-4 text-red-500 text-sm">Unknown block type</div>;
  }
}
