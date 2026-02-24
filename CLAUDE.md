# MACt Platform — Claude Code Project Guide

## Quick Start
- **Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase, Resend
- **Deploy**: Vercel (`vercel --prod`)
- **Build**: `npm run build`
- **DB**: Supabase PostgreSQL (service client in `lib/supabase.ts`)
- **Rules**: See `RULES.md` for UI/styling constraints

## Key Architecture

### Data Sources
| Source | Table Prefix | Sync Frequency | Records |
|--------|-------------|----------------|---------|
| Cin7 (ERP) | `cin7_` | Every 15min via `/api/cron/data-sync` | ~5,200 orders, ~2,600 customers |
| WooCommerce | `woo_` | Every 15min via `/api/cron/data-sync` | ~3,000 orders |

### Cin7 Integration

**API Base**: `https://inventory.dearsystems.com/ExternalApi/v2`
**Auth Headers**: `api-auth-accountid` + `api-auth-applicationkey`
**Client**: `lib/cin7.ts`
**Sync**: `lib/cin7-sync.ts` (env-based) / `lib/cin7-sync-db.ts` (DB-based with logging)

**Sale Status Lifecycle**:
```
DRAFT → ESTIMATED → ESTIMATING → ORDERING → ORDERED → APPROVED
  → PICKING → PACKED → SHIPPED → INVOICED → COMPLETED → CLOSED
                                                    ↘ CREDITED
  (any) → CANCELLED / VOID / VOIDED
```

**Status Categories**:
- **Quote/New**: DRAFT, ESTIMATED, ESTIMATING
- **In Progress**: ORDERING, ORDERED, APPROVED, PICKING, PACKED, BACKORDERED, INVOICING
- **Completed**: SHIPPED, INVOICED, COMPLETED, CLOSED, CREDITED
- **Cancelled**: CANCELLED, VOID, VOIDED

**Key API Endpoints**:
- `GET /saleList` — List sales (paginated, max 250/page)
- `GET /sale?ID={id}` — Full sale details (includes Invoices[], Fulfilments[])
- `GET /customer` — List customers (paginated)
- `GET /customer?ID={id}` — Customer details

**Invoice Data** (from `GET /sale`):
```typescript
Invoices[]: {
  InvoiceNumber, Status, InvoiceDate,
  Lines[]: { ProductID, SKU, Name, Quantity, Price, Total },
  Total: number,  // Invoice total
  Paid: number    // Amount paid (key for payment tracking!)
}
```

**Customer Payment Fields**:
- `PaymentTerm`: "COD", "NET 30", "NET 14", etc.
- `CreditLimit`: number
- `AccountReceivable`: number

**Rate Limiting**: 250 items/page, batch 3-5 concurrent, 200-500ms delays between batches.

**Gotchas**:
- Cin7 returns HTTP 200 with errors in body — always check `data.Errors`
- Email only available from full `/sale` endpoint, NOT from `/saleList`
- Line items require full sale details fetch (separate API call per order)
- Order number format: `SO-#####`

### WooCommerce Integration
- **API Client**: `lib/woo-sync.ts`
- **Store URL**: `https://mact.au` (configured in `integration_settings` table)
- **Statuses**: pending, processing, on-hold, completed, cancelled, refunded, failed

### Email System (Resend)
- **Transactional**: `lib/email.ts` (alerts, notifications)
- **Campaigns**: `lib/outreach/send.ts` (batch sending with rate limiting)
- **Templates**: `lib/outreach/templates.ts` ({{variable}} syntax)
- **Segments**: `lib/outreach/segments.ts` (dormant, vip, active, all, custom)

**Template Variables**: `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{last_product}}`, `{{last_order_date}}`, `{{days_since_order}}`, `{{total_spent}}`, `{{order_count}}`, `{{coupon_code}}`

### Cron Jobs (Vercel Cron, every 15min)
| Path | Purpose |
|------|---------|
| `/api/cron/data-sync` | Cin7 + WooCommerce order/customer sync |
| `/api/cron/auto-resend` | Follow-up campaigns to non-openers |
| `/api/cron/chat-followup` | Auto follow-up emails for idle chat conversations |

**Auth**: `Authorization: Bearer {CRON_SECRET}` (bypassed in development)

### Campaign Creation Pattern (Programmatic)
```typescript
// 1. Create campaign
const { data: campaign } = await supabase
  .from("outreach_campaigns")
  .insert({ name, template_id, segment: "custom", status: "sending", ... })
  .select("id").single();

// 2. Queue emails
await supabase.from("outreach_emails").insert(emailRecords);

// 3. Send immediately
await processCampaignBatch(campaign.id, batchSize);
```

**Naming convention**: `YYMMDD_description_type` (e.g., `260224_quote-followup_automation`)

## Key Tables
- `cin7_orders` (cin7_id PK) — synced Cin7 sales
- `cin7_customers` (cin7_id PK) — synced Cin7 customers, includes payment_term
- `cin7_order_items` — denormalized line items
- `woo_orders` / `woo_customers` / `woo_products` — synced WooCommerce data
- `outreach_campaigns` / `outreach_emails` / `outreach_templates` — email system
- `conversations` / `messages` — chat system
- `integration_settings` — API credentials and sync config
- `sync_log` / `system_logs` — audit trail
