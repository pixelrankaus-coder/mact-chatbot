---
name: google-ppc
description: Google Ads PPC integration for MACt Chatbot admin dashboard. Use when implementing Google Ads API connections, syncing campaign/keyword/geo performance data, building PPC dashboards, generating AI-powered recommendations, or working with advertising metrics. Covers OAuth 2.0 authentication, reporting API patterns, metric calculations (CTR, CPC, ROAS, CPA), data sync workflows, and MACt-specific business context for GFRC manufacturer recommendations.
---

# Google PPC Integration Skill

## Overview

This skill enables Google Ads integration for the MACt Chatbot admin dashboard, providing campaign performance visibility and AI-powered recommendations tailored to MACt's GFRC (Glass Fibre Reinforced Concrete) manufacturing business.

## Architecture

```
Google Ads API → Sync Service → Supabase → Dashboard UI
                     ↓
              AI Recommendation Engine
                     ↓
              MACt Business Context
```

## Quick Reference

| Task | Approach |
|------|----------|
| OAuth Setup | See [references/api-authentication.md](references/api-authentication.md) |
| Sync Campaign Data | Use `scripts/sync_campaigns.js` |
| Calculate Metrics | See [references/metrics-glossary.md](references/metrics-glossary.md) |
| Generate AI Insights | See [references/ai-recommendation-prompts.md](references/ai-recommendation-prompts.md) |

## Database Schema

### Connection Table

```sql
CREATE TABLE ppc_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  platform TEXT DEFAULT 'google_ads',
  customer_id TEXT NOT NULL,              -- Google Ads Customer ID (XXX-XXX-XXXX)
  account_name TEXT,
  refresh_token TEXT,                     -- Encrypted
  access_token TEXT,                      -- Encrypted
  token_expires_at TIMESTAMPTZ,
  developer_token TEXT,                   -- From Google Ads API Center
  login_customer_id TEXT,                 -- For MCC accounts
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',     -- pending, syncing, success, error
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Campaign Metrics Table

```sql
CREATE TABLE ppc_campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_status TEXT,                   -- ENABLED, PAUSED, REMOVED
  campaign_type TEXT,                     -- SEARCH, DISPLAY, SHOPPING, VIDEO
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,           -- Google reports in micros (÷1,000,000 for dollars)
  conversions DECIMAL(10,2) DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  average_cpc_micros BIGINT,
  ctr DECIMAL(8,6),                       -- Calculated: clicks/impressions
  conversion_rate DECIMAL(8,6),           -- Calculated: conversions/clicks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id, date)
);

CREATE INDEX idx_ppc_campaign_date ON ppc_campaign_metrics(connection_id, date DESC);
```

### Keyword Metrics Table

```sql
CREATE TABLE ppc_keyword_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  campaign_id TEXT,
  campaign_name TEXT,
  ad_group_id TEXT,
  ad_group_name TEXT,
  keyword_id TEXT,
  keyword_text TEXT,
  match_type TEXT,                        -- EXACT, PHRASE, BROAD
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  quality_score INTEGER,                  -- 1-10
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, keyword_id, date)
);
```

### Geographic Metrics Table

```sql
CREATE TABLE ppc_geo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES ppc_connections(id) ON DELETE CASCADE,
  campaign_id TEXT,
  location_id TEXT,                       -- Google Geo Target ID
  location_name TEXT,                     -- "New South Wales, Australia"
  location_type TEXT,                     -- State, City, Region
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, campaign_id, location_id, date)
);
```

## Google Ads API Integration

### Required Scopes

```javascript
const SCOPES = ['https://www.googleapis.com/auth/adwords'];
```

### API Client Setup

```javascript
import { GoogleAdsApi } from 'google-ads-api';

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: customerIdWithoutDashes,
  refresh_token: storedRefreshToken,
  login_customer_id: mccIdIfApplicable,  // Only if using MCC
});
```

### GAQL Queries

**Campaign Performance (Last 30 Days):**

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  segments.date
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.status != 'REMOVED'
ORDER BY segments.date DESC
```

**Keyword Performance:**

```sql
SELECT
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.quality_info.quality_score,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  segments.date
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.clicks DESC
```

**Geographic Performance:**

```sql
SELECT
  campaign.id,
  geographic_view.country_criterion_id,
  geographic_view.location_type,
  user_location_view.country_criterion_id,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  segments.date
FROM geographic_view
WHERE segments.date DURING LAST_30_DAYS
```

## Metric Calculations

| Metric | Formula | Notes |
|--------|---------|-------|
| Cost | `cost_micros / 1,000,000` | Convert from micros to dollars |
| CTR | `(clicks / impressions) * 100` | Click-through rate % |
| CPC | `cost / clicks` | Cost per click |
| CPA | `cost / conversions` | Cost per acquisition |
| Conversion Rate | `(conversions / clicks) * 100` | % of clicks that convert |
| ROAS | `conversion_value / cost` | Return on ad spend |

## Sync Workflow

1. **Trigger**: Vercel cron job (daily at 6 AM AEST) or manual "Sync Now"
2. **Token Check**: Refresh access token if expired
3. **Query Execution**: Run GAQL queries for campaigns, keywords, geo
4. **Upsert Data**: Insert/update Supabase tables using unique constraints
5. **Update Status**: Set `last_sync_at` and `sync_status`
6. **Error Handling**: Log errors to `sync_error` field

## AI Recommendations

See [references/ai-recommendation-prompts.md](references/ai-recommendation-prompts.md) for prompt templates.

Recommendations combine:
- PPC performance metrics
- MACt business context (GFRC products, B2B focus, Australian market)
- WooCommerce/Cin7 data (top products, order values, customer segments)

Example recommendation types:
- Budget reallocation suggestions
- Underperforming keyword alerts
- Seasonal trend predictions
- Product-campaign alignment opportunities
- Geographic expansion recommendations

## MACt Business Context

See [references/mact-business-context.md](references/mact-business-context.md) for industry-specific guidance.

Key considerations:
- **B2B Sales Cycle**: Longer consideration period, multiple touchpoints
- **High-Value Orders**: Focus on lead quality over volume
- **Regional Focus**: Australia-centric, state-by-state targeting
- **Product Categories**: Panels, facades, custom architectural elements
- **Seasonality**: Construction industry cycles, weather impacts

## Dashboard Components

### Summary KPI Cards

Display with trend indicators (vs. previous period):
- Total Spend
- Total Clicks
- Total Conversions
- Cost per Conversion
- Average CTR
- ROAS (if conversion values tracked)

### Campaign Performance Table

Columns: Campaign Name, Status, Spend, Clicks, Conv., CPA, CTR, ROAS
Features: Sortable, filterable by date range, campaign status

### Trend Charts

- Line chart: Daily spend and conversions overlay
- Area chart: Cumulative spend over period

### Top Keywords

Table: Keyword, Match Type, Clicks, Conv., Quality Score, CPA
Highlight: Low quality scores, high-spend/low-conversion keywords

### Geographic Breakdown

- Table view: State, Clicks, Conv., CPA
- Future: Australia heatmap visualization

## Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=

# Encryption key for tokens
PPC_TOKEN_ENCRYPTION_KEY=
```

## Key Resources

- [references/api-authentication.md](references/api-authentication.md) - OAuth flow, token management
- [references/metrics-glossary.md](references/metrics-glossary.md) - Detailed metric definitions
- [references/ai-recommendation-prompts.md](references/ai-recommendation-prompts.md) - AI insight generation
- [references/mact-business-context.md](references/mact-business-context.md) - Industry-specific guidance

## Official Documentation

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [GAQL Reference](https://developers.google.com/google-ads/api/docs/query/overview)
- [google-ads-api npm package](https://www.npmjs.com/package/google-ads-api)
