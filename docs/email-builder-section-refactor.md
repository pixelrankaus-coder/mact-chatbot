# Email Builder — Section Refactor Guide

## Goal

Refactor our custom email builder's "Section" concept to match Unlayer's architecture. This document covers exactly what Unlayer does, what we currently have, and what needs to change.

---

## 1. Unlayer's Architecture (Target)

### Hierarchy

```
Body (page-level settings)
  └── Row (= "Section" in the UI)        ← the fundamental structural unit
        └── Column(s)                      ← 12-grid layout system
              └── Content blocks           ← text, image, button, etc.
```

**Every content block must live inside a Row > Column.** There are no naked blocks floating at the root level.

What Unlayer calls a **"Section"** in the UI is actually a **Row** in the JSON. There is no separate section entity — a Row IS the section.

### The Two-Background System

This is the most important visual concept. Each Row/Section has **two separate background layers**:

| UI Label | JSON Field | What It Does |
|----------|-----------|--------------|
| **Section color** | `backgroundColor` | Full-width bleed — extends to the edges of the viewport/email client, behind everything |
| **Content color** | `columnsBackgroundColor` | Only covers the content area (e.g. 600px wide), sits on top of the section color |

Think of it as two rectangles stacked:
```
┌──────────────────────────── viewport width ────────────────────────────┐
│  Section color (backgroundColor) — full bleed                          │
│    ┌───────────── 600px content width ──────────────┐                  │
│    │  Content color (columnsBackgroundColor)         │                  │
│    │    ┌─── Column 1 ───┐  ┌─── Column 2 ───┐     │                  │
│    │    │  [text block]   │  │  [image block]  │     │                  │
│    │    └────────────────┘  └────────────────┘     │                  │
│    └────────────────────────────────────────────────┘                  │
└───────────────────────────────────────────────────────────────────────┘
```

### Row/Section Properties (Styles Tab)

| Property | Type | Description |
|----------|------|-------------|
| **Background image** | `{ url, fullWidth, repeat, center, cover, size }` | Full section background image with positioning controls |
| **Content color** | `string \| "auto" \| "none"` | Background within the content width area. "Auto" = transparent, "Custom" = pick color, "None" = no background |
| **Section color** | `string` | Full-bleed background behind everything |
| **Border** | `object` | Border on the section |
| **Padding** | `{ top, right, bottom, left }` | Separate **desktop** and **mobile** padding values |
| **Column content alignment** | `"top" \| "middle" \| "bottom"` | Vertical alignment of content within columns |
| **Mobile stacking** | `"rtl" \| "ltr" \| "none"` | How columns stack on mobile: Right-to-left, Left-to-right, or No stacking (stay side-by-side) |

### Row/Section Properties (Display Tab)

| Property | Type | Description |
|----------|------|-------------|
| **Hide on Desktop** | `boolean` | Don't render this section on desktop |
| **Hide on Mobile** | `boolean` | Don't render this section on mobile |
| **Display Conditions** | `object \| null` | Conditional show/hide logic (advanced, lower priority) |

### Column Grid System

Unlayer uses a **12-unit grid**. Column widths are defined as fractions of 12:

| Layout | Grid Values | Visual |
|--------|-------------|--------|
| Full width | `[12]` | `[████████████]` |
| Two equal | `[6, 6]` | `[██████][██████]` |
| Three equal | `[4, 4, 4]` | `[████][████][████]` |
| Sidebar + main | `[3, 9]` | `[███][█████████]` |
| 4 equal | `[3, 3, 3, 3]` | `[███][███][███][███]` |

**Column properties:**
- `backgroundColor` — per-column background
- `padding` — per-column padding
- `border` — per-column border (top, right, bottom, left with width/style/color)
- `borderRadius` — rounded corners

Users can **drag column edges** to resize interactively. Columns **stack vertically on mobile** by default.

### Section UI Controls

**Floating toolbar** (appears on left edge when section is selected):
- Clone/duplicate section
- Save as favourite (reusable block)
- Conditional display settings
- Delete section
- Drag handle for reordering

**Between-section controls:**
- `+` button appears between every two sections
- Clicking it adds a new empty row/section at that position

**Selection indicator:**
- Blue "Section" label badge at the top-left corner of the selected section

### Unlayer Design JSON (simplified)

```json
{
  "body": {
    "rows": [
      {
        "id": "row_1",
        "cells": [6, 6],
        "columns": [
          {
            "id": "col_1",
            "contents": [
              { "id": "content_1", "type": "text", "values": { "text": "<p>Hello</p>" } }
            ],
            "values": { "backgroundColor": "", "padding": "0px", "border": {} }
          },
          {
            "id": "col_2",
            "contents": [
              { "id": "content_2", "type": "image", "values": { "src": { "url": "..." } } }
            ],
            "values": { "backgroundColor": "", "padding": "0px", "border": {} }
          }
        ],
        "values": {
          "backgroundColor": "#f5f5f5",
          "columnsBackgroundColor": "#ffffff",
          "backgroundImage": { "url": "", "fullWidth": true, "repeat": "no-repeat", "center": true, "cover": false },
          "padding": "10px",
          "hideDesktop": false,
          "hideMobile": false,
          "noStackMobile": false,
          "selectable": true,
          "draggable": true,
          "duplicatable": true,
          "deletable": true
        }
      }
    ],
    "values": {
      "backgroundColor": "#e7e7e7",
      "contentWidth": "600px",
      "contentAlign": "center",
      "fontFamily": { "label": "Arial", "value": "arial,helvetica,sans-serif" }
    }
  }
}
```

---

## 2. Our Current Architecture

### Hierarchy (flat)

```
EmailDesign
  └── blocks[]            ← flat array at root
        ├── text          ← naked block, no wrapper
        ├── columns       ← has nested columns[].blocks[]
        ├── section       ← has nested blocks[] (simple wrapper)
        ├── image         ← naked block
        └── footer        ← naked block
```

**Key difference:** Blocks can live at the root level without any row/column wrapper. The `section` and `columns` types are optional layout wrappers, not mandatory structure.

### Current Section Type

```typescript
// types.ts
interface SectionBlockProps {
  blocks: EmailBlock[];        // flat list of nested blocks (no columns)
  backgroundColor: string;     // single background (no two-layer system)
  padding: Padding;            // single padding (no desktop/mobile split)
  borderTop: { width: number; color: string };
  borderBottom: { width: number; color: string };
}
```

### What's Missing vs Unlayer

| Feature | Unlayer | Us | Gap |
|---------|---------|-----|-----|
| Mandatory row/column structure | Yes — every block in Row > Column | No — blocks float at root | **Major structural change** |
| Two-layer backgrounds | Section color + Content color | Single `backgroundColor` | Need to add `columnsBackgroundColor` |
| Background image on section | Full support (URL, repeat, position, cover) | Not supported | Need to add |
| Column vertical alignment | Top / Middle / Bottom per section | Not present | Need to add |
| Mobile stacking control | RTL / LTR / No stacking per section | Not present | Need to add |
| Desktop/Mobile padding | Separate values | Single padding | Need to add |
| Hide on Desktop/Mobile | Per section and per content block | Not present | Need to add |
| 12-column grid | Widths as fractions of 12 | Percentage-based (50, 33, 67, etc.) | Different system, works similarly |
| Column-level styling | Background, padding, border, radius per column | Background only (implicit) | Need to expand |
| Draggable column edges | Users drag to resize | Fixed presets only | Need to add |
| `+` between sections | Adds new row between sections | DropZone (drag-only, no click) | Need add button |
| Save section as favourite | Reusable saved sections | Not present | Future feature |
| Display conditions | Conditional logic per section/block | Not present | Future feature |

---

## 3. Refactor Plan

### Phase 1 — Upgrade Section Props (data model)

Update `SectionBlockProps` to support Unlayer-equivalent properties:

```typescript
interface SectionBlockProps {
  // Existing
  blocks: EmailBlock[];
  padding: Padding;

  // CHANGED: Two-layer background system
  backgroundColor: string;          // "Section color" — full-bleed
  contentBackgroundColor: string;    // "Content color" — within content width

  // NEW: Background image
  backgroundImage: {
    url: string;
    fullWidth: boolean;
    repeat: "no-repeat" | "repeat" | "repeat-x" | "repeat-y";
    position: "center" | "top" | "bottom";
    cover: boolean;
  };

  // CHANGED: Full border support (not just top/bottom)
  border: {
    top: { width: number; color: string; style: "solid" | "dashed" | "dotted" };
    bottom: { width: number; color: string; style: "solid" | "dashed" | "dotted" };
    left: { width: number; color: string; style: "solid" | "dashed" | "dotted" };
    right: { width: number; color: string; style: "solid" | "dashed" | "dotted" };
  };

  // NEW: Column content vertical alignment
  columnAlignment: "top" | "middle" | "bottom";

  // NEW: Mobile controls
  mobileStacking: "ltr" | "rtl" | "none";
  mobilePadding: Padding;           // Separate mobile padding
  hideDesktop: boolean;
  hideMobile: boolean;
}
```

### Phase 2 — Make Sections the Mandatory Root Structure

This is the **biggest architectural change**. Instead of a flat `blocks[]` array at the root, every content block should live inside a Section > Column structure.

**Option A — Full Unlayer model (Row > Column > Content):**
- Merge current `section` and `columns` into one concept
- Every section has columns built in (default: 1 column at 100%)
- The `+` button between sections adds a new section with a column layout picker

**Option B — Keep separate but enforce wrapping (recommended for v1):**
- Keep `section` and `columns` as separate types
- Auto-wrap any naked block in a section when dropped at root level
- Sections always wrap their content; columns can exist inside sections

**Recommendation: Option B** — less breaking change, can evolve to Option A later.

### Phase 3 — Update the Section Property Panel

Current panel has 6 controls. New panel should have:

**Styles tab:**
1. Background image — URL input + upload, fullWidth toggle, repeat select, position select, cover toggle
2. Content color — Auto / Custom / None selector + color picker
3. Section color — Color picker (full-bleed background)
4. Border — 4-sided border controls (width, style, color per side)
5. Padding — Desktop padding (4-sided) + Mobile padding (4-sided)
6. Column content alignment — Top / Middle / Bottom radio buttons with icons
7. Mobile stacking — RTL / LTR / No stacking radio buttons

**Display tab:**
8. Hide on Desktop — Toggle
9. Hide on Mobile — Toggle

### Phase 4 — Update the Canvas Rendering

**Section Renderer changes:**
- Render two background layers (section color behind, content color in front)
- Support background image with CSS background properties
- Apply column vertical alignment via `align-items` on the flex container
- Show/hide based on desktop/mobile preview mode

**Between-section `+` button:**
- Replace or augment the current DropZone with a visible `+` button
- Clicking opens a column layout picker (1col, 2col, 3col, etc.)
- Drag-and-drop still works alongside the click

**Section selection UI:**
- "Section" badge label at top-left corner
- Floating toolbar on left edge (clone, delete, drag handle)

### Phase 5 — Update HTML Export

**Two-background rendering:**
```html
<!-- Section color: full-width row -->
<tr>
  <td style="background-color: #f5f5f5; background-image: url(...);">
    <!-- Content color: constrained to content width -->
    <table align="center" width="600" style="background-color: #ffffff;">
      <tr>
        <td style="padding: 20px;">
          <!-- Inner content blocks -->
        </td>
      </tr>
    </table>
  </td>
</tr>
```

**Mobile stacking:**
```css
@media only screen and (max-width: 640px) {
  /* Default: columns stack */
  .section-columns td { display: block !important; width: 100% !important; }

  /* noStackMobile: columns stay side-by-side */
  .section-no-stack td { display: table-cell !important; }

  /* Hide on mobile */
  .hide-mobile { display: none !important; }
}
```

**Hide on desktop:**
```html
<!--[if !mso]><!-->
<style>.hide-desktop { display: none !important; }</style>
<!--<![endif]-->
```

---

## 4. Migration Path

### Backward Compatibility

Existing saved templates use the current `SectionBlockProps` schema. We need a migration:

```typescript
function migrateDesign(design: EmailDesign): EmailDesign {
  if (design.version === 1) {
    // Wrap naked root blocks in auto-sections
    // Convert old section props to new format
    // Set defaults for new fields
    design.version = 2;
  }
  return design;
}
```

**Migration rules:**
- Old `backgroundColor` → new `contentBackgroundColor` (it was within content, not full-bleed)
- Old `borderTop`/`borderBottom` → new `border.top` / `border.bottom`
- New `backgroundColor` (section color) → default empty string
- New fields (`backgroundImage`, `columnAlignment`, `mobileStacking`, etc.) → defaults
- Naked root blocks → wrap each in an auto-section with 1 column

### Version Bump

Change `EmailDesign.version` from `1` to `2`. The `loadDesign` function should detect version and auto-migrate.

---

## 5. File Impact Summary

| File | Changes |
|------|---------|
| `lib/email-builder/types.ts` | Update `SectionBlockProps`, add `version: 1 \| 2` |
| `lib/email-builder/defaults.ts` | Update `DEFAULT_PROPS.section()`, add migration function |
| `lib/email-builder/block-renderers.tsx` | Rewrite `SectionRenderer` for two-layer backgrounds, alignment, background image |
| `lib/email-builder/html-export.ts` | Rewrite `renderSection()` for two-layer HTML, mobile stacking CSS, hide classes |
| `builder/property-panels.tsx` | Expand `SectionPanel` with all new controls, add Display tab |
| `builder/builder-canvas.tsx` | Add `+` button between sections, section selection badge, toolbar on left edge |
| `builder/use-email-builder.ts` | Add auto-wrap logic, update section operations |
| `builder/builder-sidebar.tsx` | Minor — may change how Section is presented |

---

## 6. Priority Order

1. **Data model** (types.ts, defaults.ts) — foundation for everything
2. **Property panel** (property-panels.tsx) — so you can configure sections
3. **Canvas renderer** (block-renderers.tsx) — so you can see the two backgrounds
4. **HTML export** (html-export.ts) — so emails render correctly
5. **Canvas UX** (builder-canvas.tsx) — `+` button, selection UI, toolbar
6. **Auto-wrapping & migration** (use-email-builder.ts, defaults.ts) — backward compat
7. **Column resizing by drag** — polish feature, can come later
8. **Display conditions** — advanced feature, future phase

---

## 7. Reference Screenshots

The Unlayer Section panel shows:
- **Styles tab** and **Display tab** at the top
- Background image with expandable options
- Content color with Auto/Custom/None toggle
- Section color with `+` button to add
- Border section
- Padding with desktop/mobile separate inputs
- Column content alignment (3 icon buttons: top/middle/bottom)
- Mobile stacking (3 radio options: RTL, LTR, No stacking)
- Floating toolbar on left edge: copy, star, diamond, trash icons
- Gear/drag handle icon at top-left for reordering
