import type {
  EmailDesign,
  EmailBlock,
  Padding,
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
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const px = (n: number) => `${n}px`;

function padStr(p: Padding): string {
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

function bgStyle(color: string): string {
  return color ? `background-color:${color};` : "";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SOCIAL_ICONS: Record<string, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E4405F" },
  twitter: { label: "Twitter", color: "#1DA1F2" },
  x: { label: "X", color: "#000000" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  youtube: { label: "YouTube", color: "#FF0000" },
  tiktok: { label: "TikTok", color: "#000000" },
  snapchat: { label: "Snapchat", color: "#FFFC00" },
  pinterest: { label: "Pinterest", color: "#E60023" },
  android: { label: "Android", color: "#3DDC84" },
  website: { label: "Website", color: "#555555" },
  custom: { label: "Custom", color: "#888888" },
};

function getSocialColor(platform: string, iconStyle: string): string {
  const info = SOCIAL_ICONS[platform] || SOCIAL_ICONS.custom;
  if (iconStyle === "black") return "#000000";
  if (iconStyle === "grey") return "#999999";
  if (iconStyle === "white") return "#ffffff";
  return info.color;
}

// ─── Block Renderers ─────────────────────────────────────────────────────────

function renderText(p: TextBlockProps): string {
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}font-size:${px(p.fontSize)};line-height:${p.lineHeight};color:${p.color};text-align:${p.alignment};font-family:inherit;">${p.content}</td></tr>`;
}

function renderImage(p: ImageBlockProps): string {
  const w = p.width === "full" ? "100%" : px(p.width as number);
  const borderCss = p.border.width > 0
    ? `border:${px(p.border.width)} ${p.border.style} ${p.border.color};border-radius:${px(p.border.radius)};`
    : p.border.radius > 0
      ? `border-radius:${px(p.border.radius)};`
      : "";
  const img = p.src
    ? `<img src="${esc(p.src)}" alt="${esc(p.alt)}" width="${p.width === "full" ? "100%" : p.width}" style="display:block;max-width:100%;width:${w};height:auto;${borderCss}" />`
    : `<div style="width:${w};max-width:100%;height:200px;background:#e0e0e0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;${borderCss}">No image set</div>`;
  const wrapped = p.href ? `<a href="${esc(p.href)}" target="_blank">${img}</a>` : img;
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${p.alignment};">${wrapped}</td></tr>`;
}

function renderButton(p: ButtonBlockProps): string {
  const widthStyle = p.fullWidth ? "display:block;width:100%;" : "";
  return `<tr><td style="padding:${padStr(p.containerPadding)};${bgStyle(p.containerBackgroundColor)}text-align:${p.alignment};"><a href="${esc(p.href)}" target="_blank" style="${widthStyle}display:inline-block;padding:${padStr(p.padding)};background-color:${p.backgroundColor};color:${p.color};font-size:${px(p.fontSize)};font-family:inherit;text-decoration:none;border-radius:${px(p.borderRadius)};font-weight:600;text-align:center;">${esc(p.text)}</a></td></tr>`;
}

function renderColumns(p: ColumnsBlockProps, design: EmailDesign): string {
  const contentWidth = design.bodySettings.contentWidth;
  const innerWidth = contentWidth - p.padding.left - p.padding.right;

  const cols = p.columns
    .map((col) => {
      const colWidth = Math.round((col.width / 100) * innerWidth);
      const innerBlocks = col.blocks.map((b) => renderBlock(b, design)).join("");
      const innerTable = innerBlocks
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>${innerBlocks}</tbody></table>`
        : `<div style="padding:16px;color:#aaa;font-size:13px;text-align:center;">Column</div>`;
      return `<td style="width:${col.width}%;vertical-align:top;padding:0 ${Math.round(p.gap / 2)}px;" width="${colWidth}">${innerTable}</td>`;
    })
    .join("");

  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cols}</tr></table></td></tr>`;
}

function renderDivider(p: DividerBlockProps): string {
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:center;"><div style="width:${p.width}%;margin:0 auto;border-top:${px(p.thickness)} ${p.style} ${p.color};"></div></td></tr>`;
}

function renderSpacer(p: SpacerBlockProps): string {
  return `<tr><td style="height:${px(p.height)};${bgStyle(p.backgroundColor)}line-height:${px(p.height)};font-size:0;">&nbsp;</td></tr>`;
}

function renderSocial(p: SocialBlockProps): string {
  const spacing = p.spacing ?? 10;
  const icons = p.links
    .filter((l) => l.url)
    .map((l) => {
      const info = SOCIAL_ICONS[l.platform] || SOCIAL_ICONS.custom;
      const bgColor = getSocialColor(l.platform, p.iconStyle || "color");
      const textColor = (p.iconStyle === "white" || l.platform === "snapchat") ? "#000" : "#fff";
      const border = p.iconStyle === "white" ? "border:1px solid #ddd;" : "";
      if (l.customIconUrl) {
        return `<a href="${esc(l.url)}" target="_blank" style="display:inline-block;margin:0 ${spacing / 2}px;text-decoration:none;"><img src="${esc(l.customIconUrl)}" alt="${esc(l.label || info.label)}" width="${p.iconSize}" height="${p.iconSize}" style="display:block;border-radius:50%;width:${px(p.iconSize)};height:${px(p.iconSize)};object-fit:cover;" /></a>`;
      }
      return `<a href="${esc(l.url)}" target="_blank" style="display:inline-block;margin:0 ${spacing / 2}px;text-decoration:none;"><span style="display:inline-block;width:${px(p.iconSize)};height:${px(p.iconSize)};border-radius:50%;background-color:${bgColor};color:${textColor};font-size:${Math.round(p.iconSize * 0.45)}px;line-height:${px(p.iconSize)};text-align:center;font-family:Arial,sans-serif;font-weight:bold;${border}">${info.label.charAt(0).toUpperCase()}</span></a>`;
    })
    .join("");
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${p.alignment};">${icons}</td></tr>`;
}

function renderHeader(p: HeaderBlockProps): string {
  const img = p.logoSrc
    ? `<img src="${esc(p.logoSrc)}" alt="Logo" width="${p.logoWidth}" style="display:block;max-width:100%;height:auto;" />`
    : `<div style="font-size:24px;font-weight:bold;color:#333;font-family:inherit;">Your Logo</div>`;
  const wrapped = p.logoHref ? `<a href="${esc(p.logoHref)}" target="_blank" style="text-decoration:none;">${img}</a>` : img;
  const alignMap = { left: "left", center: "center", right: "right" };
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${alignMap[p.alignment]};">${wrapped}</td></tr>`;
}

function renderFooter(p: FooterBlockProps): string {
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}font-size:${px(p.fontSize)};color:${p.color};text-align:${p.alignment};font-family:inherit;">${p.content}</td></tr>`;
}

function renderHero(p: HeroBlockProps): string {
  const parts: string[] = [];
  if (p.imageSrc && p.imagePosition === "above") {
    parts.push(`<img src="${esc(p.imageSrc)}" alt="Hero" style="display:block;max-width:100%;width:100%;height:auto;margin-bottom:24px;" />`);
  }
  parts.push(`<h1 style="margin:0 0 12px;font-size:32px;font-weight:bold;color:${p.headingColor};font-family:inherit;">${esc(p.heading)}</h1>`);
  parts.push(`<p style="margin:0 0 24px;font-size:16px;color:${p.subheadingColor};line-height:1.5;font-family:inherit;">${esc(p.subheading)}</p>`);
  if (p.buttonText) {
    parts.push(`<a href="${esc(p.buttonHref)}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${p.buttonColor};color:${p.buttonTextColor};font-size:16px;font-family:inherit;text-decoration:none;border-radius:6px;font-weight:600;">${esc(p.buttonText)}</a>`);
  }
  if (p.imageSrc && p.imagePosition === "below") {
    parts.push(`<img src="${esc(p.imageSrc)}" alt="Hero" style="display:block;max-width:100%;width:100%;height:auto;margin-top:24px;" />`);
  }
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${p.alignment};">${parts.join("")}</td></tr>`;
}

function renderProduct(p: ProductBlockProps): string {
  const img = p.imageSrc
    ? `<img src="${esc(p.imageSrc)}" alt="${esc(p.name)}" style="display:block;max-width:100%;width:100%;height:auto;" />`
    : `<div style="width:100%;height:180px;background:#e0e0e0;"></div>`;

  if (p.imagePosition === "top") {
    return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}">${img}<div style="padding:16px 0 0;"><h3 style="margin:0 0 8px;font-size:18px;color:#333;font-family:inherit;">${esc(p.name)}</h3><p style="margin:0 0 8px;font-size:14px;color:#666;font-family:inherit;">${esc(p.description)}</p><p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#333;font-family:inherit;">${esc(p.price)}</p><a href="${esc(p.buttonHref)}" target="_blank" style="display:inline-block;padding:10px 24px;background-color:${p.buttonColor};color:${p.buttonTextColor};font-size:14px;font-family:inherit;text-decoration:none;border-radius:6px;font-weight:600;">${esc(p.buttonText)}</a></div></td></tr>`;
  }

  // Left or right image
  const imgFirst = p.imagePosition === "left";
  const imgCell = `<td style="width:40%;vertical-align:top;">${img}</td>`;
  const textCell = `<td style="width:60%;vertical-align:top;padding:0 16px;"><h3 style="margin:0 0 8px;font-size:18px;color:#333;font-family:inherit;">${esc(p.name)}</h3><p style="margin:0 0 8px;font-size:14px;color:#666;font-family:inherit;">${esc(p.description)}</p><p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#333;font-family:inherit;">${esc(p.price)}</p><a href="${esc(p.buttonHref)}" target="_blank" style="display:inline-block;padding:10px 24px;background-color:${p.buttonColor};color:${p.buttonTextColor};font-size:14px;font-family:inherit;text-decoration:none;border-radius:6px;font-weight:600;">${esc(p.buttonText)}</a></td>`;
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${imgFirst ? imgCell + textCell : textCell + imgCell}</tr></table></td></tr>`;
}

function renderCoupon(p: CouponBlockProps): string {
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${p.alignment};"><div style="display:inline-block;padding:20px 32px;border:2px ${p.borderStyle} ${p.borderColor};background-color:${p.codeBgColor};"><div style="font-size:${px(p.fontSize)};font-weight:bold;color:${p.codeColor};letter-spacing:3px;font-family:monospace;">${esc(p.code)}</div><div style="margin-top:8px;font-size:14px;color:${p.descriptionColor};font-family:inherit;">${esc(p.description)}</div></div></td></tr>`;
}

function renderVideo(p: VideoBlockProps): string {
  const thumb = p.thumbnailSrc
    ? `<img src="${esc(p.thumbnailSrc)}" alt="${esc(p.alt)}" style="display:block;max-width:100%;width:100%;height:auto;" />`
    : `<div style="width:100%;height:300px;background:#111;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;color:#fff;">&#9654;</span></div>`;
  const content = p.videoUrl
    ? `<a href="${esc(p.videoUrl)}" target="_blank" style="display:block;position:relative;">${thumb}<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;"><span style="font-size:28px;color:#fff;margin-left:4px;">&#9654;</span></div></a>`
    : thumb;
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${p.alignment};">${content}</td></tr>`;
}

function renderHtml(p: HtmlBlockProps): string {
  return `<tr><td style="padding:${padStr(p.padding)};">${p.content}</td></tr>`;
}

function renderQuote(p: QuoteBlockProps): string {
  return `<tr><td style="padding:${padStr(p.padding)};${bgStyle(p.backgroundColor)}text-align:${p.alignment};"><div style="border-left:4px solid ${p.quoteColor};padding:12px 24px;text-align:left;display:inline-block;"><p style="margin:0 0 8px;font-size:${px(p.fontSize)};font-style:italic;color:${p.color};line-height:1.5;font-family:inherit;">&ldquo;${esc(p.content)}&rdquo;</p><p style="margin:0;font-size:14px;color:#999;font-family:inherit;">&mdash; ${esc(p.author)}</p></div></td></tr>`;
}

function sectionBorderCss(side: string, b: { width: number; style: string; color: string }): string {
  return b.width > 0 && b.style !== "none" ? `border-${side}:${px(b.width)} ${b.style} ${b.color};` : "";
}

function renderSection(p: SectionBlockProps, design: EmailDesign): string {
  const innerBlocks = p.blocks.map((b) => renderBlock(b, design)).join("");
  const innerTable = innerBlocks
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>${innerBlocks}</tbody></table>`
    : "";

  // Border CSS
  const borders = [
    sectionBorderCss("top", p.border.top),
    sectionBorderCss("bottom", p.border.bottom),
    sectionBorderCss("left", p.border.left),
    sectionBorderCss("right", p.border.right),
  ].join("");

  // Background image CSS
  const bgImgCss = p.backgroundImage?.url
    ? `background-image:url('${p.backgroundImage.url}');background-repeat:${p.backgroundImage.repeat};background-position:${p.backgroundImage.position};${p.backgroundImage.cover ? "background-size:cover;" : ""}`
    : "";

  // CSS classes for hide/show
  const hideClasses: string[] = [];
  if (p.hideDesktop) hideClasses.push("hide-desktop");
  if (p.hideMobile) hideClasses.push("hide-mobile");
  const classAttr = hideClasses.length ? ` class="${hideClasses.join(" ")}"` : "";

  // Outer row = section color (full bleed) + background image
  const outerBg = bgStyle(p.backgroundColor) + bgImgCss;

  // Inner = content color (within content width) + padding + borders
  const contentWidth = design.bodySettings.contentWidth;
  const contentBg = bgStyle(p.contentBackgroundColor);

  return `<tr${classAttr}><td style="${outerBg}" align="center">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${contentWidth}" style="max-width:${contentWidth}px;${contentBg}">` +
    `<tr><td style="padding:${padStr(p.padding)};${borders}">` +
    innerTable +
    `</td></tr></table></td></tr>`;
}

// ─── Block Dispatcher ────────────────────────────────────────────────────────

function renderBlock(block: EmailBlock, design: EmailDesign): string {
  switch (block.type) {
    case "text": return renderText(block.props as TextBlockProps);
    case "image": return renderImage(block.props as ImageBlockProps);
    case "button": return renderButton(block.props as ButtonBlockProps);
    case "columns": return renderColumns(block.props as ColumnsBlockProps, design);
    case "section": return renderSection(block.props as SectionBlockProps, design);
    case "divider": return renderDivider(block.props as DividerBlockProps);
    case "spacer": return renderSpacer(block.props as SpacerBlockProps);
    case "social": return renderSocial(block.props as SocialBlockProps);
    case "header": return renderHeader(block.props as HeaderBlockProps);
    case "footer": return renderFooter(block.props as FooterBlockProps);
    case "hero": return renderHero(block.props as HeroBlockProps);
    case "product": return renderProduct(block.props as ProductBlockProps);
    case "coupon": return renderCoupon(block.props as CouponBlockProps);
    case "video": return renderVideo(block.props as VideoBlockProps);
    case "html": return renderHtml(block.props as HtmlBlockProps);
    case "quote": return renderQuote(block.props as QuoteBlockProps);
    default: return "";
  }
}

// ─── Full HTML Export ────────────────────────────────────────────────────────

// ─── Google Font Detection ───────────────────────────────────────────────────

const GOOGLE_FONT_MAP: Record<string, string> = {
  "Open Sans": "Open+Sans",
  "Roboto": "Roboto",
  "Lato": "Lato",
  "Montserrat": "Montserrat",
  "Poppins": "Poppins",
  "Raleway": "Raleway",
  "Playfair Display": "Playfair+Display",
  "Merriweather": "Merriweather",
  "Oswald": "Oswald",
  "PT Sans": "PT+Sans",
  "Source Sans 3": "Source+Sans+3",
  "Nunito": "Nunito",
};

function getGoogleFontImport(fontFamily: string): string {
  for (const [name, slug] of Object.entries(GOOGLE_FONT_MAP)) {
    if (fontFamily.includes(name)) {
      return `@import url('https://fonts.googleapis.com/css2?family=${slug}:wght@400;600;700&display=swap');`;
    }
  }
  return "";
}

export function exportToHtml(design: EmailDesign): string {
  const { bodySettings, blocks } = design;
  const rows = blocks.map((b) => renderBlock(b, design)).join("\n");
  const googleImport = getGoogleFontImport(bodySettings.fontFamily);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>Email</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
${googleImport}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
table{border-collapse:collapse!important}
body{margin:0;padding:0;width:100%!important;height:100%!important}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}
@media only screen and (max-width:640px){
.email-container{width:100%!important;max-width:100%!important}
.email-container td{padding-left:16px!important;padding-right:16px!important}
.stack-column{display:block!important;width:100%!important;max-width:100%!important}
.hide-mobile{display:none!important;max-height:0!important;overflow:hidden!important;mso-hide:all!important}
}
.hide-desktop{display:none!important;max-height:0!important;overflow:hidden!important}
@media only screen and (max-width:640px){
.hide-desktop{display:table-row!important;max-height:none!important;overflow:visible!important}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${bodySettings.backgroundColor};font-family:${bodySettings.fontFamily};">
<center style="width:100%;background-color:${bodySettings.backgroundColor};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${bodySettings.backgroundColor};">
<tr>
<td style="padding:20px 0;" align="center">
<!--[if mso]>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${bodySettings.contentWidth}"><tr><td>
<![endif]-->
<table role="presentation" class="email-container" cellpadding="0" cellspacing="0" border="0" width="${bodySettings.contentWidth}" style="max-width:${bodySettings.contentWidth}px;margin:0 auto;background-color:#ffffff;">
<tbody>
${rows}
</tbody>
</table>
<!--[if mso]>
</td></tr></table>
<![endif]-->
</td>
</tr>
</table>
</center>
</body>
</html>`;
}
