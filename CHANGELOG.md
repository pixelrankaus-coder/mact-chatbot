# MACt Chatbot Changelog

## [2.3.0] - 2025-01-19

### TASK #033 — Chatbot Uses Local Supabase Cache
- **Type:** BUG FIX + ENHANCEMENT
- **Duration:** ~30 minutes
- **Description:** Chatbot was calling Cin7 API directly causing wrong/stale data (showed "Approved, no tracking" when order was "Completed" with tracking). Now uses Supabase cache for fast, accurate lookups.
- **Files Created:**
  - `src/lib/chatbot-lookup.ts` — Unified lookup functions (lookupOrderByNumber, lookupCustomerByEmail, lookupCustomerByPhone, formatOrderForChat, formatCustomerForChat) using Supabase cache
- **Files Modified:**
  - `src/app/api/widget/conversations/[id]/messages/route.ts` — Replaced Cin7 API calls with Supabase cache lookups
- **Proof:**
  - Order SO-05183: Status = COMPLETED ✓, Tracking = 8880180000518 ✓
  - Response time: ~200ms (was 3-5s with Cin7 API)
- **Outcome:** Chatbot now returns correct, up-to-date order data instantly. Tracking numbers displayed prominently.

---

## [2.2.0] - 2025-01-19

### TASK #031 — Chat Ratings & Feedback
- **Type:** FEATURE
- **Duration:** ~1 hour
- **Description:** Implemented visitor rating system to measure AI chat effectiveness. After 5 minutes of inactivity, visitors are prompted to rate their conversation (1-5 stars) with optional feedback. Ratings are visible in the inbox sidebar and help identify training gaps.
- **Files Created:**
  - `supabase/migrations/20250119_chat_ratings.sql` — Database table (chat_ratings) with conversation columns for quick access
  - `src/app/api/widget/conversations/[id]/rating/route.ts` — POST/GET rating API with CORS headers
  - `src/app/api/analytics/ratings/route.ts` — Analytics endpoint returning total, average, distribution, 7-day trend
- **Files Modified:**
  - `public/widget/chat-widget.js` — v1.4.0 with rating prompt UI (5-star selector, feedback textarea, 5-min inactivity detection)
  - `src/app/inbox/page.tsx` — Rating display in conversation list and sidebar detail view
  - `src/types/database.ts` — Added rating/rating_feedback fields to conversations type
- **Outcome:** Visitors can rate chat experience after conversation ends. Ratings visible in inbox with star visualization and feedback quotes.

---

## [2.1.0] - 2025-01-19

### TASK #032 — Cin7 Data Sync to Supabase
- **Type:** FEATURE
- **Duration:** ~2 hours
- **Description:** Implemented background sync of Cin7 orders and customers to Supabase for faster page loads. Previously, every page load hit the Cin7 API directly (3-5s latency). Now data is cached locally and served from Supabase (~200ms). Automatic sync runs every 15 minutes via Vercel cron.
- **Files Created:**
  - `supabase/migrations/20250119_cin7_sync.sql` — Database tables (cin7_orders, cin7_customers, sync_log) with indexes
  - `src/lib/cin7-sync.ts` — Sync functions with batch upsert (500 records/batch), logging, error handling
  - `src/app/api/sync/cin7/route.ts` — Manual sync trigger endpoint (GET status, POST sync)
  - `src/app/api/cron/cin7-sync/route.ts` — Vercel cron endpoint for scheduled sync
- **Files Modified:**
  - `src/lib/cin7.ts` — Added `listAllSales()` with auto-pagination and rate limiting (batches of 3 with 200ms delay)
  - `src/app/api/orders/route.ts` — Read Cin7 orders from Supabase cache instead of API
  - `src/app/api/customers/route.ts` — Read Cin7 customers from Supabase cache instead of API
  - `src/app/settings/integrations/page.tsx` — Added sync status UI with manual sync buttons, record counts, last sync time
  - `vercel.json` — Added cron job configuration (every 15 minutes)
  - `package.json` — Added date-fns dependency
- **Data Synced:**
  - 5,165 orders (28.3s sync time)
  - 2,571 customers (17.4s sync time)
- **Outcome:** Orders/Customers pages now load from local cache. Automatic refresh every 15 minutes maintains data freshness.

### TASK #031B — Hide Voided Orders Toggle
- **Type:** FIX
- **Duration:** ~15 minutes
- **Description:** Added toggle to hide voided orders by default on Orders page. Most voided orders were from 2020 and cluttered the view.
- **Files Modified:**
  - `src/app/orders/page.tsx` — Added hideVoided state (default true), filter logic in useMemo, toggle UI with count
- **Outcome:** Orders page shows relevant active/completed orders by default, with option to show voided orders

---

## [2.0.3] - 2025-01-12

### Fixed: Chunky Chat Bubbles

**Problem:** Chat message bubbles appeared too "chunky" and fat compared to professional chat widgets like Tidio, WhatsApp, and Facebook Messenger.

**Root Causes Identified:**
1. `gap: 12px` on `.mact-messages` container - too much spacing between messages
2. `line-height: 1.3` on bubbles - too much vertical space within text
3. `white-space: pre-wrap` - was adding extra whitespace
4. Missing `display: inline-block` - bubbles were stretching to fill container
5. Avatar size `28px` - slightly too large, making rows feel heavy
6. Padding `6px 12px` - horizontal padding was excessive

**Solution Applied:**

```css
/* BEFORE (chunky) */
.mact-messages {
  gap: 12px;
  padding: 16px;
}
.mact-message {
  max-width: 70%;
}
.mact-avatar {
  width: 28px;
  height: 28px;
}
.mact-bubble {
  padding: 6px 12px;
  line-height: 1.3;
  white-space: pre-wrap;
}

/* AFTER (sleek) */
.mact-messages {
  gap: 6px;           /* Reduced from 12px */
  padding: 12px;      /* Reduced from 16px */
}
.mact-message {
  margin-bottom: 6px;
  max-width: 75%;
}
.mact-avatar {
  width: 24px;        /* Reduced from 28px */
  height: 24px;
}
.mact-bubble {
  padding: 6px 10px;  /* Reduced horizontal from 12px to 10px */
  line-height: 1.2;   /* Reduced from 1.3 */
  display: inline-block;  /* Added - prevents stretch */
  box-sizing: border-box; /* Added */
  /* Removed: white-space: pre-wrap */
}
```

**Key Insight:** The "chunky" look wasn't about the bubble size itself, but the cumulative effect of:
- Extra spacing between messages (`gap`)
- Extra spacing within text (`line-height`)
- Bubbles stretching to fill container (missing `inline-block`)
- Large avatars making rows feel heavy

---

## [2.0.2] - 2025-01-12

### Changed
- Reduced `max-width` from 85% to 70%
- Reduced `line-height` from 1.4 to 1.3
- Verified CORS headers on all widget API routes

---

## [2.0.1] - 2025-01-12

### Changed
- Reduced bubble padding from `10px 14px` to `6px 12px`
- Reduced border-radius from `18px` to `16px`

---

## [2.0.0] - 2025-01-12

### Added
- **Complete V2 Widget Rebuild** using Web Components (Custom Elements + Shadow DOM)
- True CSS isolation - WordPress/host site styles cannot affect widget
- Clean architecture with `MActChatWidget extends HTMLElement`
- Asymmetric border-radius on bubbles (Messenger-style "tail" effect)
- Handoff form for "Talk to a human" functionality
- System message styling

### Architecture
```javascript
class MActChatWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });  // Shadow DOM for CSS isolation
    // ... state management
  }
}
customElements.define('mact-chat-widget', MActChatWidget);
```

### Why V2 was needed
V1 used an IIFE pattern with a Shadow DOM wrapper, but CSS isolation was incomplete. WordPress themes were still bleeding into the widget. V2 uses proper Custom Elements which provides bulletproof encapsulation.

---

## [1.2.0] - 2025-01-11

### Changed
- Attempted flexbox layout refactor based on Facebook Messenger research
- Changed from `inline-block` to flexbox with `align-self` for message alignment

### Issues
- Bubbles still appeared chunky due to CSS values, not layout approach

---

## [1.1.x] - 2025-01-11

### Various attempts
- Multiple iterations trying to fix bubble styling
- Discovered that `inline-block` + `text-align` approach was fundamentally broken
- Research into how Tidio, Intercom, WhatsApp build their chat UIs

---

## Research Notes

### How Professional Chat Widgets Style Bubbles

**Facebook Messenger (source: ishadeed.com/article/facebook-messenger-chat-component)**
- Uses flexbox on message container
- `flex-direction: column` on messages wrapper
- `align-self: flex-end/start` for sent/received alignment
- Bubbles use `max-width` constraint, not fixed width

**WhatsApp / Tidio Common Pattern**
- Padding: approximately `6px 12px` (tight vertical)
- Line-height: `1.2` - `1.3`
- Border-radius: `16px` with asymmetric corners for "tail"
- Gap between messages: `4px` - `8px`
- Avatar size: `24px` - `28px`

### Key Learning
The "chunky" feeling comes from cumulative spacing, not any single property. You need to reduce:
1. Gap between messages
2. Line-height within text
3. Padding inside bubble
4. Avatar size

All together, these small reductions compound into a sleeker look.
