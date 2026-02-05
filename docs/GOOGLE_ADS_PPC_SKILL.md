# Google Ads PPC Integration Skill

## Overview

This skill provides integration with the Google Ads API to fetch PPC (Pay-Per-Click) campaign performance data for the MACt Chatbot dashboard.

**Current API Version:** v23 (Released January 28, 2026)
**Base URL:** `https://googleads.googleapis.com/v23`

---

## Prerequisites

### 1. Google Cloud Project Setup

1. Create a Google Cloud Project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Ads API** in APIs & Services
3. Configure OAuth Consent Screen:
   - User Type: External (or Internal for Workspace)
   - App Name: MACt PPC Integration
   - Scopes: `https://www.googleapis.com/auth/adwords`
   - **Publishing Status: Set to "In Production"** (otherwise refresh tokens expire in 7 days)

### 2. OAuth 2.0 Credentials

1. Go to APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web Application type)
3. Add Authorized Redirect URI: `{APP_URL}/api/ppc/oauth/callback`
4. Note the **Client ID** and **Client Secret**

### 3. Google Ads Developer Token

**Location:** Google Ads UI → Tools & Settings (wrench icon) → Setup → API Center

**Access Levels:**

| Level | Test Accounts | Production Accounts | Daily Operations |
|-------|--------------|---------------------|------------------|
| Test Account Access | Yes | No | 15,000 |
| Basic Access | Yes | Yes | 15,000 |
| Standard Access | Yes | Yes | Unlimited |

**How to get Basic Access:**
1. Sign up in API Center (automatic Test Account Access)
2. Complete Basic Access application form
3. Wait for approval (typically 1-3 business days)

### 4. Required Environment Variables

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_REDIRECT_URI=http://localhost:3000/api/ppc/oauth/callback  # Optional

# Security
PPC_TOKEN_ENCRYPTION_KEY=32-character-secure-key-here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Authentication Flow

### OAuth 2.0 Web Application Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User clicks   │────▶│  Google OAuth   │────▶│  Callback with  │
│ "Connect Google │     │  Consent Screen │     │  auth code      │
│     Ads"        │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Store tokens   │◀────│ Exchange code   │◀────│                 │
│  (encrypted)    │     │  for tokens     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Step 1: Generate Authorization URL

```typescript
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
authUrl.searchParams.set("access_type", "offline");  // Required for refresh token
authUrl.searchParams.set("prompt", "consent");       // Force consent to get refresh token
authUrl.searchParams.set("state", csrfToken);        // CSRF protection
```

### Step 2: Exchange Code for Tokens

```typescript
const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code: authorizationCode,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }),
});

const { access_token, refresh_token, expires_in } = await response.json();
```

### Step 3: Refresh Access Token

Access tokens expire after ~1 hour. Use refresh token to get new ones:

```typescript
const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    refresh_token: storedRefreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  }),
});

const { access_token, expires_in } = await response.json();
```

**Important:** Refresh tokens don't expire, but:
- Limit of 100 refresh tokens per Google Account per OAuth client
- If OAuth consent screen is in "Testing" mode, tokens expire in 7 days

---

## API Endpoints

### Required HTTP Headers

```http
Authorization: Bearer {ACCESS_TOKEN}
developer-token: {DEVELOPER_TOKEN}
login-customer-id: {MANAGER_CUSTOMER_ID}  # Only if using manager account
Content-Type: application/json
```

**Note:** Customer IDs must NOT contain hyphens (use `1234567890`, not `123-456-7890`)

### List Accessible Customers

**Endpoint:** `GET /v23/customers:listAccessibleCustomers`

**Special:** This endpoint does NOT require a customer ID and ignores `login-customer-id`.

```typescript
const response = await fetch(
  "https://googleads.googleapis.com/v23/customers:listAccessibleCustomers",
  {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": developerToken,
    },
  }
);

// Returns: { resourceNames: ["customers/1234567890", "customers/9876543210"] }
```

### Get Customer Details

To get account name and other details, query each customer:

```typescript
const query = `
  SELECT
    customer.id,
    customer.descriptive_name,
    customer.currency_code,
    customer.time_zone,
    customer.manager
  FROM customer
  LIMIT 1
`;

const response = await fetch(
  `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:search`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  }
);
```

### Search (Paginated) vs SearchStream

| Method | Use Case | Pagination |
|--------|----------|------------|
| `googleAds:search` | Small datasets, UI queries | 10,000 rows per page |
| `googleAds:searchStream` | Bulk data export | Single streamed response |

---

## GAQL (Google Ads Query Language)

### Query Structure

```sql
SELECT
  {resource.field},
  {metrics.field},
  {segments.field}
FROM {resource}
WHERE {conditions}
ORDER BY {field} {ASC|DESC}
LIMIT {number}
```

### Available Resources

| Resource | Description |
|----------|-------------|
| `campaign` | Campaign-level data |
| `ad_group` | Ad group-level data |
| `ad_group_ad` | Individual ad data |
| `keyword_view` | Keyword performance |
| `search_term_view` | Search term data |
| `geographic_view` | Geographic performance |
| `geo_target_constant` | Location metadata |
| `customer` | Account information |

---

## Campaign Metrics Query

### Basic Campaign Performance

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign.bidding_strategy_type,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.status != 'REMOVED'
ORDER BY metrics.cost_micros DESC
```

### Key Metrics

| Metric | Description | Type |
|--------|-------------|------|
| `metrics.impressions` | Number of impressions | Integer |
| `metrics.clicks` | Number of clicks | Integer |
| `metrics.ctr` | Click-through rate | Double (0.0-1.0) |
| `metrics.average_cpc` | Average cost per click | Micros |
| `metrics.cost_micros` | Total cost | Micros (÷1,000,000 for dollars) |
| `metrics.conversions` | Number of conversions | Double |
| `metrics.conversions_value` | Total conversion value | Double |
| `metrics.cost_per_conversion` | Cost per conversion | Micros |

### Date Range Options

```sql
-- Predefined ranges
WHERE segments.date DURING LAST_7_DAYS
WHERE segments.date DURING LAST_30_DAYS
WHERE segments.date DURING LAST_90_DAYS
WHERE segments.date DURING THIS_MONTH
WHERE segments.date DURING LAST_MONTH

-- Custom range
WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-31'
```

---

## Keyword Metrics Query

### Keyword Performance with Quality Score

```sql
SELECT
  ad_group.id,
  ad_group.name,
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.quality_info.quality_score,
  ad_group_criterion.quality_info.creative_quality_score,
  ad_group_criterion.quality_info.post_click_quality_score,
  ad_group_criterion.quality_info.search_predicted_ctr,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group_criterion.status != 'REMOVED'
ORDER BY metrics.impressions DESC
```

### Match Types

| Match Type | GAQL Value |
|------------|------------|
| Broad | `BROAD` |
| Phrase | `PHRASE` |
| Exact | `EXACT` |

### Quality Score Components

| Field | Values |
|-------|--------|
| `quality_score` | 1-10 |
| `creative_quality_score` | BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE |
| `post_click_quality_score` | BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE |
| `search_predicted_ctr` | BELOW_AVERAGE, AVERAGE, ABOVE_AVERAGE |

---

## Geographic Performance Query

### Geographic View Query

```sql
SELECT
  geographic_view.country_criterion_id,
  geographic_view.location_type,
  segments.geo_target_region,
  segments.geo_target_city,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.cost_micros,
  metrics.conversions
FROM geographic_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.impressions DESC
```

### Get Location Names

Geographic view returns criterion IDs. To get location names:

```sql
SELECT
  geo_target_constant.id,
  geo_target_constant.name,
  geo_target_constant.canonical_name,
  geo_target_constant.country_code,
  geo_target_constant.target_type,
  geo_target_constant.status
FROM geo_target_constant
WHERE geo_target_constant.id = 21167  -- Example: New York state
```

### Australian States (Criterion IDs)

| State | Criterion ID |
|-------|-------------|
| New South Wales | 20034 |
| Victoria | 20036 |
| Queensland | 20032 |
| Western Australia | 20037 |
| South Australia | 20033 |
| Tasmania | 20035 |
| Northern Territory | 20031 |
| ACT | 20030 |

---

## Conversion Reporting

### Campaign Conversions with Action Breakdown

```sql
SELECT
  campaign.name,
  segments.conversion_action,
  segments.conversion_action_name,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion,
  metrics.value_per_conversion
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.conversions DESC
```

### Calculated Metrics

**ROAS (Return on Ad Spend):**
```typescript
const roas = conversions_value / (cost_micros / 1_000_000);
```

**CPA (Cost Per Acquisition):**
```typescript
const cpa = (cost_micros / 1_000_000) / conversions;
```

**CTR (Click-Through Rate):**
```typescript
const ctr = clicks / impressions;
```

---

## Error Handling

### Common Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `AUTHENTICATION_ERROR` | Invalid/expired token | Refresh access token |
| `AUTHORIZATION_ERROR` | No access to customer | Check permissions |
| `REQUEST_ERROR` | Invalid GAQL | Check query syntax |
| `QUOTA_ERROR` | Rate limit exceeded | Implement backoff |
| `INTERNAL_ERROR` | Google server error | Retry with backoff |

### Rate Limits

- **Basic Access:** 15,000 operations/day
- **Standard Access:** Unlimited
- **Per-request:** ~10,000 rows (use pagination or streaming for more)

---

## Implementation Checklist

### Initial Setup
- [ ] Create Google Cloud Project
- [ ] Enable Google Ads API
- [ ] Configure OAuth Consent Screen (set to Production)
- [ ] Create OAuth 2.0 Credentials
- [ ] Add redirect URI
- [ ] Get Developer Token from Google Ads API Center
- [ ] Apply for Basic Access (if needed for production accounts)

### Environment Variables
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_ADS_DEVELOPER_TOKEN`
- [ ] `PPC_TOKEN_ENCRYPTION_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`

### Database Tables
- [ ] `ppc_connections` - OAuth tokens and customer ID
- [ ] `ppc_campaign_metrics` - Daily campaign data
- [ ] `ppc_keyword_metrics` - Keyword performance
- [ ] `ppc_geo_metrics` - Geographic breakdown
- [ ] `ppc_sync_log` - Sync history

### API Endpoints
- [ ] `POST /api/ppc/oauth/authorize` - Start OAuth flow
- [ ] `GET /api/ppc/oauth/callback` - Handle OAuth callback
- [ ] `GET /api/ppc/oauth/accounts` - List accessible accounts
- [ ] `POST /api/ppc/oauth/accounts` - Select account
- [ ] `GET /api/ppc/connection` - Get connection status
- [ ] `DELETE /api/ppc/connection` - Disconnect
- [ ] `POST /api/ppc/sync` - Trigger data sync
- [ ] `GET /api/ppc/metrics` - Get metrics

---

## MACt Business Context

**Client:** Mining and Cement Technology (MACt)
**Industry:** B2B GFRC (Glass Fiber Reinforced Concrete) manufacturer
**Market:** Australia-wide, primarily VIC, NSW, QLD

### Key Metrics for MACt

1. **Lead Generation Focus**
   - Track form submissions as conversions
   - Monitor cost per lead (CPL)
   - Focus on high-intent keywords

2. **Geographic Analysis**
   - Heavy focus on Australian states
   - Metro vs regional performance
   - Seasonal variations by region

3. **B2B Keywords**
   - Long-tail industrial terms
   - Technical product specifications
   - Industry-specific terminology

### Recommended Dashboard Views

1. **Executive Summary**
   - Total spend, leads, CPL, ROAS
   - Month-over-month comparison
   - Top performing campaigns

2. **Campaign Performance**
   - Campaign-level metrics table
   - Status and budget monitoring
   - Conversion tracking

3. **Keyword Analysis**
   - Quality score distribution
   - Top converting keywords
   - Negative keyword opportunities

4. **Geographic Insights**
   - State-by-state breakdown
   - Cost and conversion by region
   - Market penetration analysis

---

## References

- [Google Ads API Documentation](https://developers.google.com/google-ads/api)
- [GAQL Reference](https://developers.google.com/google-ads/api/docs/query/overview)
- [Metrics Reference (v23)](https://developers.google.com/google-ads/api/fields/v23/metrics)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Developer Token Policy](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)
- [API Release Notes](https://developers.google.com/google-ads/api/docs/release-notes)
