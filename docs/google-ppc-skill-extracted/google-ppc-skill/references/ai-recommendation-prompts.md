# AI Recommendation Prompts for PPC

## System Context

```
You are a PPC optimization specialist for MACt, a B2B GFRC (Glass Fibre Reinforced Concrete) manufacturer in Australia. Your recommendations should:

1. Account for B2B sales cycles (longer than B2C)
2. Prioritize lead quality over volume
3. Consider Australian market geography
4. Reference actual product/order data when available
5. Be specific and actionable with dollar amounts
6. Acknowledge seasonality in construction industry
```

## Recommendation Types

### 1. Budget Reallocation

**Prompt Template:**
```
Analyze the following campaign performance data for the last 30 days:
{campaign_metrics_json}

Identify:
1. Campaigns with ROAS > 2.0 that have budget headroom
2. Campaigns with ROAS < 1.0 that are consuming significant budget
3. Recommended budget shifts with specific dollar amounts

Consider that MACt is a B2B GFRC manufacturer where:
- Average order value is $15,000-50,000
- Sales cycle is 2-8 weeks
- Lead quality matters more than volume

Format as actionable recommendations with rationale.
```

### 2. Underperforming Keywords

**Prompt Template:**
```
Review these keyword metrics for the last 30 days:
{keyword_metrics_json}

Flag keywords that:
1. Have spend > $100 but zero conversions
2. Have Quality Score < 5
3. Have CTR < 1% (below industry average)
4. Show declining performance trend

For MACt (GFRC manufacturer), consider:
- Technical terms may have lower search volume but higher intent
- Brand misspellings should be captured
- Negative keyword opportunities

Provide specific recommendations: pause, reduce bid, or improve landing page.
```

### 3. Geographic Opportunities

**Prompt Template:**
```
Analyze geographic performance data:
{geo_metrics_json}

Cross-reference with:
- WooCommerce order locations: {woo_geo_data}
- Cin7 customer distribution: {cin7_geo_data}

Identify:
1. Regions with orders but low PPC presence
2. High-spend regions with poor conversion rates
3. Expansion opportunities based on customer data

MACt services all of Australia but focuses on NSW, VIC, QLD.
```

### 4. Product-Campaign Alignment

**Prompt Template:**
```
Compare PPC campaign focus with actual sales data:

Top PPC keywords by spend:
{top_keywords}

Top selling products (Cin7/WooCommerce):
{top_products}

Recent enquiries (chatbot/helpdesk):
{recent_enquiries}

Identify misalignments:
1. High-selling products not featured in ads
2. Ad spend on products with low actual demand
3. Customer enquiry themes not captured in keywords

Recommend campaign adjustments to align marketing with demand.
```

### 5. Seasonal Trend Analysis

**Prompt Template:**
```
Historical performance data (last 12 months):
{monthly_metrics}

Current month: {current_month}
Construction industry seasonal patterns in Australia:
- Q1: Planning phase, moderate activity
- Q2-Q3: Peak construction season
- Q4: Holiday slowdown

Based on patterns, recommend:
1. Budget adjustments for upcoming month
2. Campaign pauses or activations
3. Messaging changes for seasonal relevance
```

### 6. Competitor Response

**Prompt Template:**
```
Observed metric changes:
- CPC increased {cpc_change}% week-over-week
- Impression share dropped to {impression_share}%
- Average position changed from {old_pos} to {new_pos}

For MACt in the GFRC market, this may indicate:
1. New competitor entering auction
2. Competitor budget increase
3. Seasonal demand surge

Recommend response strategy:
- Bid adjustments
- Budget reallocation
- Alternative keyword targeting
```

## Response Format

All recommendations should follow this structure:

```json
{
  "recommendation_type": "budget_reallocation",
  "priority": "high|medium|low",
  "title": "Brief actionable title",
  "insight": "What the data shows",
  "recommendation": "Specific action to take",
  "expected_impact": "Projected outcome",
  "confidence": "high|medium|low",
  "data_points": ["Supporting metrics"]
}
```

## Display Guidelines

- Show max 5 recommendations at a time
- Prioritize by potential impact
- Include "Dismiss" option for each
- Track which recommendations are actioned
- Refresh recommendations weekly or on sync
