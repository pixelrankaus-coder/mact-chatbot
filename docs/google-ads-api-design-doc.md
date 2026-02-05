# MACt PPC Dashboard - Design Document

## About This Project

We're building a reporting dashboard for our client MACt (Mining and Cement Technology), a B2B manufacturer based in Australia. The goal is pretty simple - give them a way to see how their Google Ads campaigns are performing without having to log into the Google Ads interface themselves.

**Who we are:** Pixel Rank - we're a small SEM agency based in Australia. I'm Drew, the lead developer on this project.
**Contact:** drew@pixelrank.com.au

## What the Dashboard Does

At its core, this is a read-only reporting tool. We pull campaign data from the Google Ads API and display it in a clean dashboard that our client can access anytime.

The main things we're showing:
- Campaign performance (impressions, clicks, cost, conversions)
- Keyword data with quality scores
- Geographic breakdown by Australian state (MACt sells nationwide so this is important for them)

We sync the data once a day automatically, and users can also hit a refresh button if they want the latest numbers.

**Important note:** We're not making any changes to the ads account through the API. No bid adjustments, no campaign edits, nothing like that. This is purely for viewing reports.

## How It Works

The tech stack is pretty straightforward:

1. User logs into our dashboard (built with Next.js)
2. They connect their Google Ads account via OAuth
3. We store their tokens securely (encrypted with AES-256-GCM)
4. Our server pulls their campaign data using the Google Ads API
5. Data gets cached in our PostgreSQL database (hosted on Supabase)
6. Dashboard displays the metrics

For the API calls, we're using the `googleAds:search` endpoint with GAQL queries. Typical day would be maybe 500-1000 API operations total across all users - nothing crazy.

## Security & Data Handling

A few things worth mentioning:
- All OAuth tokens are encrypted before we store them
- Users can only see their own account data (enforced at the database level)
- We don't share any data with third parties
- We follow Australian Privacy Principles since we're based here

## API Usage

Here's what we're actually calling:

| What | How often |
|------|-----------|
| List accounts (to let user pick which one to connect) | Once when they first connect |
| Campaign metrics | Daily + when user refreshes |
| Keyword performance | Daily + when user refreshes |
| Geographic data | Daily + when user refreshes |

If we hit rate limits, we back off and retry - standard exponential backoff pattern.

## Contact

If you need to reach us:
- Drew @ Pixel Rank
- drew@pixelrank.com.au
- https://www.pixelrank.com.au
- Based in Australia
