# PPC Metrics Glossary

## Core Metrics

### Impressions
**Definition**: Number of times your ad was shown on a search results page or Google Network site.
**Google Ads Field**: `metrics.impressions`
**Use Case**: Measures reach and visibility.
**MACt Context**: Lower impressions expected (niche B2B market) but higher quality.

### Clicks
**Definition**: Number of times users clicked your ad.
**Google Ads Field**: `metrics.clicks`
**Use Case**: Measures engagement and traffic volume.
**MACt Context**: Each click is a potential high-value lead.

### Cost (Spend)
**Definition**: Total amount spent on ads.
**Google Ads Field**: `metrics.cost_micros` (divide by 1,000,000)
**Calculation**: `cost_micros / 1,000,000`
**Currency**: AUD (Australian Dollars)

### Conversions
**Definition**: Actions defined as valuable (form submissions, calls, etc.).
**Google Ads Field**: `metrics.conversions`
**MACt Conversion Types**:
- Quote request form submissions
- Phone calls (if tracked)
- Contact form submissions
- Brochure downloads (secondary)

### Conversion Value
**Definition**: Total value of conversions (if values assigned).
**Google Ads Field**: `metrics.conversions_value`
**MACt Context**: May not be set if conversion values aren't tracked.

## Calculated Metrics

### CTR (Click-Through Rate)
**Formula**: `(clicks / impressions) * 100`
**Display**: Percentage with 2 decimal places
**Benchmarks**:
- Search ads: 2-5% is good
- Display ads: 0.5-1% is good
- B2B industrial: 2-3% is typical
**MACt Target**: > 3% for branded, > 2% for generic

### CPC (Cost Per Click)
**Formula**: `cost / clicks`
**Display**: Currency with 2 decimal places
**Context**: High CPC acceptable if lead quality is high.
**MACt Context**: $5-15 CPC is typical for B2B construction.

### CPA (Cost Per Acquisition)
**Formula**: `cost / conversions`
**Display**: Currency with 2 decimal places
**Also Known As**: Cost Per Conversion, Cost Per Lead
**MACt Target**: Depends on customer lifetime value. $100-300 CPA acceptable for $20,000+ orders.

### Conversion Rate
**Formula**: `(conversions / clicks) * 100`
**Display**: Percentage with 2 decimal places
**Benchmarks**: 2-5% for B2B lead gen
**MACt Target**: > 3% indicates good landing page alignment

### ROAS (Return On Ad Spend)
**Formula**: `conversion_value / cost`
**Display**: Decimal (e.g., 3.5x) or percentage (350%)
**Requirement**: Conversion values must be tracked
**Interpretation**:
- < 1.0: Losing money on ads
- 1.0-2.0: Break-even to marginal
- > 2.0: Profitable
- > 4.0: Highly profitable
**MACt Note**: May not be calculable if conversion values not set.

### Impression Share
**Google Ads Field**: `metrics.search_impression_share`
**Definition**: % of impressions received vs. total available
**Use Case**: Identifies growth opportunity
**Calculation**: Done by Google, not calculable from raw data

### Quality Score
**Google Ads Field**: `ad_group_criterion.quality_info.quality_score`
**Range**: 1-10 (10 is best)
**Components**:
- Expected CTR
- Ad relevance
- Landing page experience
**Impact**: Higher score = lower CPC, better positions
**MACt Target**: > 6 for all keywords, > 8 for top performers

## Time Period Calculations

### Period-over-Period Change
**Formula**: `((current - previous) / previous) * 100`
**Display**: Percentage with arrow indicator (↑ green, ↓ red)
**Reverse for CPA**: Lower CPA is better (↓ green, ↑ red)

### Moving Averages
**7-Day Average**: Sum of last 7 days / 7
**30-Day Average**: Sum of last 30 days / 30
**Use Case**: Smooths daily fluctuations for trend analysis

## Aggregation Rules

### Summing Metrics
These metrics sum across dimensions:
- Impressions
- Clicks
- Cost
- Conversions
- Conversion Value

### Calculating Ratios
Always calculate from aggregated sums:
```javascript
// CORRECT: Calculate from totals
const ctr = (totalClicks / totalImpressions) * 100;

// WRONG: Don't average individual CTRs
const avgCtr = ctrs.reduce((a, b) => a + b) / ctrs.length; // Bad!
```

### Weighted Averages
For metrics like CPC across campaigns:
```javascript
// Weighted average CPC
const weightedCpc = totalCost / totalClicks;

// Not simple average of CPCs
```

## Display Formatting

| Metric | Format | Example |
|--------|--------|---------|
| Impressions | Number with commas | 12,345 |
| Clicks | Number with commas | 1,234 |
| Cost | Currency, 2 decimals | $1,234.56 |
| CTR | Percentage, 2 decimals | 3.45% |
| CPC | Currency, 2 decimals | $2.34 |
| CPA | Currency, 2 decimals | $156.78 |
| Conversions | Number, 1 decimal | 45.5 |
| ROAS | Decimal with 'x' | 3.5x |
| Quality Score | Integer | 7 |
| Change | Percentage with arrow | ↑ 12.3% |

## MACt-Specific Benchmarks

| Metric | Poor | Acceptable | Good | Excellent |
|--------|------|------------|------|-----------|
| CTR | < 1% | 1-2% | 2-4% | > 4% |
| CPC | > $20 | $10-20 | $5-10 | < $5 |
| CPA | > $500 | $200-500 | $100-200 | < $100 |
| Conv. Rate | < 1% | 1-2% | 2-4% | > 4% |
| Quality Score | 1-4 | 5-6 | 7-8 | 9-10 |

*Note: These are indicative for B2B GFRC market. Actual targets should be refined based on historical data.*
