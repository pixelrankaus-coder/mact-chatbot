# MACt Chatbot — Outreach Module

## Master Task File for Claude Code
**Date:** 2025-01-24
**Version:** 1.0
**Total Tasks:** 8
**Estimated Time:** 6-7 hours

---

## Module Overview

Build a personal email outreach system inside the MACt Chatbot admin that sends emails appearing to come directly from Chris's Outlook — NOT marketing newsletters.

### Purpose
- Send personalized win-back emails to 451 dormant customers
- Emails look like Chris typed them personally (no images, no unsubscribe footer)
- Track opens, clicks, replies, and conversions
- Full analytics dashboard modeled on Klaviyo/Mailchimp best practices

### Key Differentiator
| Klaviyo/Mailchimp | MACt Outreach |
|-------------------|---------------|
| Newsletter look | Plain text, personal email |
| "Unsubscribe" footer | No footer (1-to-1 email) |
| "via Klaviyo" headers | From your domain |
| Marketing tracking | Optional/minimal tracking |
| Customer knows it's automated | Customer thinks Chris typed it |

---

## Technical Architecture

### Tech Stack
- **Frontend:** Next.js App Router (existing admin)
- **Backend:** Next.js API routes
- **Database:** Supabase PostgreSQL
- **Email Sending:** Resend API (already integrated)
- **Email Receiving:** Resend Inbound Webhooks
- **Scheduling:** Vercel Cron or setTimeout queue

### Email Configuration
```
From Name: Chris Born
From Email: c.born@mact.au
Reply-To: replies@mact.au (Resend inbound)
```

### File Structure
```
src/
├── app/
│   └── outreach/
│       ├── page.tsx                    # Campaign list
│       ├── new/
│       │   └── page.tsx                # Create campaign wizard
│       ├── [id]/
│       │   └── page.tsx                # Campaign detail + stats
│       ├── templates/
│       │   ├── page.tsx                # Template list
│       │   ├── new/
│       │   │   └── page.tsx            # Create template
│       │   └── [id]/
│       │       └── page.tsx            # Edit template
│       └── analytics/
│           └── page.tsx                # Full analytics dashboard
├── api/
│   └── outreach/
│       ├── campaigns/
│       │   ├── route.ts                # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts            # GET, PUT, DELETE campaign
│       │       ├── send/
│       │       │   └── route.ts        # POST start sending
│       │       ├── pause/
│       │       │   └── route.ts        # POST pause campaign
│       │       └── stats/
│       │           └── route.ts        # GET campaign stats
│       ├── templates/
│       │   ├── route.ts                # GET list, POST create
│       │   └── [id]/
│       │       └── route.ts            # GET, PUT, DELETE template
│       ├── send-batch/
│       │   └── route.ts                # Internal: send next batch
│       ├── webhooks/
│       │   ├── resend/
│       │   │   └── route.ts            # Resend event webhooks
│       │   └── inbound/
│       │       └── route.ts            # Resend inbound (replies)
│       └── analytics/
│           └── route.ts                # GET analytics data
└── lib/
    └── outreach/
        ├── send.ts                     # Email sending logic
        ├── templates.ts                # Template rendering
        ├── analytics.ts                # Analytics calculations
        └── types.ts                    # TypeScript types
```

---

## Database Schema

### Table: outreach_templates
```sql
CREATE TABLE outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  -- Variables available: {{first_name}}, {{last_name}}, {{company}}, {{last_product}}, {{last_order_date}}, {{days_since_order}}, {{total_spent}}, {{order_count}}
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES team_members(id)
);

-- Example template:
-- name: "Personal Check-in"
-- subject: "Quick question about your {{last_product}} project"
-- body: "Hi {{first_name}},\n\nIt's been a while since you grabbed that {{last_product}}. I'd love to know how that project turned out!\n\nStill working with GFRC? Happy to help if you need anything.\n\nCheers,\nChris\nMACt / MFR Panels\n0400 xxx xxx"
```

### Table: outreach_campaigns
```sql
CREATE TABLE outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES outreach_templates(id) NOT NULL,
  segment VARCHAR(50) NOT NULL, -- 'dormant', 'vip', 'active', 'all', 'custom'
  segment_filter JSONB, -- Custom filter criteria if segment='custom'
  
  -- Sending configuration
  from_name VARCHAR(255) DEFAULT 'Chris Born',
  from_email VARCHAR(255) DEFAULT 'c.born@mact.au',
  reply_to VARCHAR(255) DEFAULT 'replies@mact.au',
  
  -- Throttling
  send_rate INT DEFAULT 50, -- Emails per hour
  send_delay_ms INT DEFAULT 72000, -- Delay between emails (72000ms = 50/hr)
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled'
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  
  -- Counts (denormalized for performance)
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  replied_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES team_members(id)
);

CREATE INDEX idx_outreach_campaigns_status ON outreach_campaigns(status);
```

### Table: outreach_emails
```sql
CREATE TABLE outreach_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE NOT NULL,
  
  -- Recipient info (snapshot at send time)
  customer_id UUID, -- References unified_customers if exists
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_company VARCHAR(255),
  
  -- Personalization data used
  personalization JSONB NOT NULL,
  -- Example: {"first_name": "Chad", "last_name": "Buckley", "company": "Atlas Waterscapes", "last_product": "MACt Rock Carve", "last_order_date": "2023-04-13", "days_since_order": 650, "total_spent": 36768.59}
  
  -- Rendered content (for debugging/audit)
  rendered_subject VARCHAR(500),
  rendered_body TEXT,
  
  -- Resend tracking
  resend_id VARCHAR(255), -- Resend email ID
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'
  
  -- Timestamps
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Counts
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outreach_emails_campaign ON outreach_emails(campaign_id);
CREATE INDEX idx_outreach_emails_status ON outreach_emails(status);
CREATE INDEX idx_outreach_emails_recipient ON outreach_emails(recipient_email);
CREATE INDEX idx_outreach_emails_resend ON outreach_emails(resend_id);
```

### Table: outreach_events
```sql
CREATE TABLE outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES outreach_emails(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE NOT NULL,
  
  event_type VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained'
  
  -- Event metadata
  metadata JSONB,
  -- For clicks: {"url": "https://...", "user_agent": "..."}
  -- For bounces: {"bounce_type": "hard", "reason": "..."}
  -- For replies: {"subject": "Re: ...", "body_preview": "..."}
  
  -- Resend webhook data
  resend_event_id VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outreach_events_email ON outreach_events(email_id);
CREATE INDEX idx_outreach_events_campaign ON outreach_events(campaign_id);
CREATE INDEX idx_outreach_events_type ON outreach_events(event_type);
CREATE INDEX idx_outreach_events_created ON outreach_events(created_at);
```

### Table: outreach_replies
```sql
CREATE TABLE outreach_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES outreach_emails(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  
  -- Reply content
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,
  
  -- Processing
  forwarded_to VARCHAR(255), -- Chris's email if forwarded
  forwarded_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'forwarded', 'read', 'archived'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outreach_replies_campaign ON outreach_replies(campaign_id);
CREATE INDEX idx_outreach_replies_status ON outreach_replies(status);
```

### Table: outreach_settings
```sql
CREATE TABLE outreach_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Default sending identity
  default_from_name VARCHAR(255) DEFAULT 'Chris Born',
  default_from_email VARCHAR(255) DEFAULT 'c.born@mact.au',
  default_reply_to VARCHAR(255) DEFAULT 'replies@mact.au',
  
  -- Forwarding
  forward_replies_to VARCHAR(255) DEFAULT 'c.born@mact.au',
  forward_replies BOOLEAN DEFAULT true,
  
  -- Rate limits
  max_emails_per_hour INT DEFAULT 50,
  max_emails_per_day INT DEFAULT 500,
  
  -- Tracking
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT false, -- Disabled by default for personal feel
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO outreach_settings (id) VALUES (gen_random_uuid());
```

### Supabase Counter Functions
```sql
-- Increment functions for real-time stats
CREATE OR REPLACE FUNCTION increment_campaign_sent(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET sent_count = sent_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_delivered(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET delivered_count = delivered_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_opened(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET opened_count = opened_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_clicked(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET clicked_count = clicked_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_replied(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET replied_count = replied_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_bounced(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE outreach_campaigns
  SET bounced_count = bounced_count + 1, updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;
```

---

## TypeScript Types

### File: src/types/outreach.ts
```typescript
export interface OutreachTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  template_id: string;
  segment: 'dormant' | 'vip' | 'active' | 'all' | 'custom';
  segment_filter?: Record<string, any>;
  from_name: string;
  from_email: string;
  reply_to: string;
  send_rate: number;
  send_delay_ms: number;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  bounced_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined
  template?: OutreachTemplate;
}

export interface OutreachEmail {
  id: string;
  campaign_id: string;
  customer_id?: string;
  recipient_email: string;
  recipient_name?: string;
  recipient_company?: string;
  personalization: {
    first_name?: string;
    last_name?: string;
    company?: string;
    last_product?: string;
    last_order_date?: string;
    days_since_order?: number;
    total_spent?: number;
    order_count?: number;
  };
  rendered_subject?: string;
  rendered_body?: string;
  resend_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed';
  queued_at: string;
  sent_at?: string;
  delivered_at?: string;
  first_opened_at?: string;
  last_opened_at?: string;
  first_clicked_at?: string;
  replied_at?: string;
  bounced_at?: string;
  failed_at?: string;
  open_count: number;
  click_count: number;
  error_message?: string;
  created_at: string;
}

export interface OutreachEvent {
  id: string;
  email_id: string;
  campaign_id: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complained';
  metadata?: Record<string, any>;
  resend_event_id?: string;
  created_at: string;
}

export interface OutreachReply {
  id: string;
  email_id?: string;
  campaign_id?: string;
  from_email: string;
  from_name?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  forwarded_to?: string;
  forwarded_at?: string;
  status: 'new' | 'forwarded' | 'read' | 'archived';
  created_at: string;
}

export interface OutreachSettings {
  id: string;
  default_from_name: string;
  default_from_email: string;
  default_reply_to: string;
  forward_replies_to: string;
  forward_replies: boolean;
  max_emails_per_hour: number;
  max_emails_per_day: number;
  track_opens: boolean;
  track_clicks: boolean;
  updated_at: string;
}

// API Response types
export interface CampaignStats {
  total_recipients: number;
  sent: number;
  delivered: number;
  delivery_rate: number;
  opened: number;
  open_rate: number;
  clicked: number;
  click_rate: number;
  replied: number;
  reply_rate: number;
  bounced: number;
  bounce_rate: number;
}

export interface PersonalizationData {
  first_name: string;
  last_name: string;
  company: string;
  last_product: string;
  last_order_date: string;
  days_since_order: number;
  total_spent: number;
  order_count: number;
}
```

---

## Tasks

---

### TASK #047: Database Schema + Supabase Setup
**Type:** SETUP
**Priority:** P1
**Estimated Time:** 30 minutes

#### Objective
Create all database tables, indexes, and functions for the Outreach Module in Supabase.

#### Steps
1. Run all CREATE TABLE statements in Supabase SQL Editor
2. Run all CREATE INDEX statements
3. Run all CREATE FUNCTION statements for counters
4. Insert default settings row
5. Create TypeScript types file

#### SQL to Execute (in order)
1. outreach_templates table
2. outreach_campaigns table
3. outreach_emails table
4. outreach_events table
5. outreach_replies table
6. outreach_settings table + default row
7. All increment functions

#### Files to Create
| File | Action |
|------|--------|
| `src/types/outreach.ts` | Create with all TypeScript types |

#### Verification
- [ ] All 6 tables exist in Supabase
- [ ] All indexes created
- [ ] All 6 increment functions exist
- [ ] Default settings row exists (query: `SELECT * FROM outreach_settings`)
- [ ] TypeScript types file compiles with no errors

---

### TASK #048: Templates CRUD + UI
**Type:** FEATURE
**Priority:** P1
**Estimated Time:** 45 minutes

#### Objective
Create email template management with full CRUD and variable preview.

#### Available Template Variables
| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{{first_name}}` | Customer first name | Chad |
| `{{last_name}}` | Customer last name | Buckley |
| `{{company}}` | Company name | Atlas Waterscapes |
| `{{last_product}}` | Last purchased product | MACt Rock Carve |
| `{{last_order_date}}` | Formatted date | 13 April 2023 |
| `{{days_since_order}}` | Days since last order | 650 |
| `{{total_spent}}` | Formatted currency | $36,768.59 |
| `{{order_count}}` | Number of orders | 6 |

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/outreach/templates/page.tsx` | Template list page |
| `src/app/outreach/templates/new/page.tsx` | Create new template |
| `src/app/outreach/templates/[id]/page.tsx` | Edit template |
| `src/app/api/outreach/templates/route.ts` | GET list, POST create |
| `src/app/api/outreach/templates/[id]/route.ts` | GET, PUT, DELETE single |
| `src/lib/outreach/templates.ts` | Template rendering utilities |

#### Template Rendering Logic (src/lib/outreach/templates.ts)
```typescript
export const TEMPLATE_VARIABLES = [
  { key: 'first_name', description: 'Customer first name', example: 'Chad' },
  { key: 'last_name', description: 'Customer last name', example: 'Buckley' },
  { key: 'company', description: 'Company name', example: 'Atlas Waterscapes' },
  { key: 'last_product', description: 'Last purchased product', example: 'MACt Rock Carve' },
  { key: 'last_order_date', description: 'Date of last order', example: '13 April 2023' },
  { key: 'days_since_order', description: 'Days since last order', example: '650' },
  { key: 'total_spent', description: 'Total amount spent', example: '$36,768.59' },
  { key: 'order_count', description: 'Number of orders', example: '6' },
];

export function renderTemplate(
  template: { subject: string; body: string },
  data: Record<string, any>
): { subject: string; body: string } {
  const render = (text: string) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined || value === null) return match;
      
      // Format special values
      if (key === 'total_spent' && typeof value === 'number') {
        return new Intl.NumberFormat('en-AU', { 
          style: 'currency', 
          currency: 'AUD' 
        }).format(value);
      }
      if (key === 'last_order_date' && value) {
        return new Date(value).toLocaleDateString('en-AU', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
      }
      return String(value);
    });
  };
  
  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}

export function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

export function getSampleData(): Record<string, any> {
  return {
    first_name: 'Chad',
    last_name: 'Buckley',
    company: 'Atlas Waterscapes',
    last_product: 'MACt Rock Carve',
    last_order_date: '2023-04-13',
    days_since_order: 650,
    total_spent: 36768.59,
    order_count: 6,
  };
}
```

#### Default Templates to Seed
Insert these via API or Supabase after table creation:

**Template 1: Personal Check-in**
```
Name: Personal Check-in
Subject: Quick question about your {{last_product}} project
Body:
Hi {{first_name}},

It's been a while since you grabbed that {{last_product}}. I'd love to know how that project turned out!

Still working with GFRC? Happy to help if you need anything.

Cheers,
Chris
MACt / MFR Panels
0400 xxx xxx
```

**Template 2: Win-back with Offer**
```
Name: Win-back with Offer
Subject: {{first_name}}, we've got something for you
Body:
Hi {{first_name}},

It's been {{days_since_order}} days since your last order with us. I wanted to reach out personally to see how things are going.

If you're planning any upcoming GFRC projects, I've set aside a 10% discount just for you. Just mention this email when you order.

Any questions? Just hit reply — comes straight to me.

Cheers,
Chris
MACt / MFR Panels
```

**Template 3: VIP Thank You**
```
Name: VIP Thank You
Subject: Thanks for being one of our best customers
Body:
Hi {{first_name}},

I just wanted to reach out personally to say thanks. You've spent {{total_spent}} with us over {{order_count}} orders — that makes you one of our most valued customers.

Is there anything we could be doing better? Any products you'd like us to stock? I'd love to hear your thoughts.

Cheers,
Chris
MACt / MFR Panels
```

#### UI Requirements
- Template list shows name, subject preview, variable count
- Template editor has:
  - Name field
  - Subject field (single line)
  - Body textarea (multi-line, monospace font)
  - Variable dropdown + Insert button
  - Live preview panel showing rendered template with sample data
- Can delete template (with confirmation)

#### Verification
- [ ] GET /api/outreach/templates returns empty array initially
- [ ] POST /api/outreach/templates creates template, returns it
- [ ] GET /api/outreach/templates/[id] returns single template
- [ ] PUT /api/outreach/templates/[id] updates template
- [ ] DELETE /api/outreach/templates/[id] removes template
- [ ] Template list page loads
- [ ] Can create new template with variables
- [ ] Preview shows rendered output with sample data
- [ ] Variables highlighted in editor (optional)

---

### TASK #049: Campaign Creation Wizard
**Type:** FEATURE
**Priority:** P1
**Estimated Time:** 45 minutes

#### Objective
Build a multi-step campaign creation wizard.

#### Wizard Steps
1. **Select Segment** - Choose recipient group
2. **Select Template** - Pick email template
3. **Preview & Configure** - Name campaign, preview emails
4. **Schedule & Launch** - Send now or schedule

#### Segments Available
| Segment | Filter Logic | Description |
|---------|--------------|-------------|
| dormant | last_order_date < 1 year ago | No order in 12+ months |
| vip | total_spent >= 5000 OR order_count >= 5 | Top customers |
| active | last_order_date >= 1 year ago | Ordered recently |
| all | No filter | Everyone with email |

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/outreach/page.tsx` | Campaign list page |
| `src/app/outreach/new/page.tsx` | Campaign creation wizard |
| `src/app/api/outreach/campaigns/route.ts` | GET list, POST create |
| `src/app/api/outreach/campaigns/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/outreach/campaigns/[id]/preview/route.ts` | GET recipient preview |
| `src/lib/outreach/segments.ts` | Segment query logic |

#### Segment Query Logic (src/lib/outreach/segments.ts)
```typescript
import { createClient } from '@/utils/supabase/server';

export async function getSegmentRecipients(segment: string, segmentFilter?: any) {
  const supabase = createClient();
  
  // Query unified_customers or whatever customer table exists
  // Adjust table name based on actual schema
  let query = supabase
    .from('cin7_customers') // or unified_customers
    .select(`
      id,
      email,
      name,
      company,
      total_spent,
      order_count,
      last_order_date,
      last_product
    `)
    .not('email', 'is', null)
    .neq('email', '');
  
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  
  switch (segment) {
    case 'dormant':
      query = query.lt('last_order_date', oneYearAgo.toISOString().split('T')[0]);
      break;
    case 'vip':
      query = query.or('total_spent.gte.5000,order_count.gte.5');
      break;
    case 'active':
      query = query.gte('last_order_date', oneYearAgo.toISOString().split('T')[0]);
      break;
    case 'all':
    default:
      // No additional filter
      break;
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching segment:', error);
    return [];
  }
  
  return data || [];
}

export async function getSegmentCount(segment: string): Promise<number> {
  const recipients = await getSegmentRecipients(segment);
  return recipients.length;
}

export function buildPersonalizationData(customer: any): Record<string, any> {
  const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
  const daysSinceOrder = lastOrderDate 
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  const nameParts = (customer.name || '').split(' ');
  
  return {
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    company: customer.company || '',
    last_product: customer.last_product || '',
    last_order_date: customer.last_order_date || '',
    days_since_order: daysSinceOrder,
    total_spent: customer.total_spent || 0,
    order_count: customer.order_count || 0,
  };
}
```

#### Campaign Creation API (POST /api/outreach/campaigns)
```typescript
// Request body
interface CreateCampaignRequest {
  name: string;
  template_id: string;
  segment: 'dormant' | 'vip' | 'active' | 'all' | 'custom';
  segment_filter?: Record<string, any>;
  from_name?: string; // Default: Chris Born
  from_email?: string; // Default: c.born@mact.au
  reply_to?: string; // Default: replies@mact.au
  send_rate?: number; // Default: 50
  scheduled_at?: string; // ISO date or null for draft
  start_immediately?: boolean;
}

// Response
interface CreateCampaignResponse {
  campaign: OutreachCampaign;
  total_recipients: number;
}
```

#### Preview API (GET /api/outreach/campaigns/[id]/preview)
Returns sample recipients with rendered previews:
```typescript
interface PreviewResponse {
  campaign: OutreachCampaign;
  template: OutreachTemplate;
  total_recipients: number;
  sample_recipients: Array<{
    email: string;
    name: string;
    personalization: Record<string, any>;
    preview: { subject: string; body: string };
  }>;
}
```

#### UI Requirements
- Step indicator (1/4, 2/4, etc.)
- Back/Next navigation
- Segment selector shows recipient count for each segment
- Template selector shows subject preview
- Preview step shows:
  - Campaign name input
  - From/Reply-To display (with edit option)
  - Send rate selector (25, 50, 100 per hour)
  - Estimated completion time
  - Sample of 5 recipients with preview
- Schedule step:
  - Send now toggle
  - Date/time picker for scheduled
  - Summary of all settings
  - "Save as Draft" and "Launch" buttons

#### Verification
- [ ] GET /api/outreach/campaigns returns campaigns list
- [ ] POST /api/outreach/campaigns creates campaign
- [ ] GET /api/outreach/campaigns/[id]/preview shows sample recipients
- [ ] Wizard step 1 shows segment options with counts
- [ ] Wizard step 2 shows template options
- [ ] Wizard step 3 shows preview with real data
- [ ] Wizard step 4 allows schedule/launch
- [ ] Campaign created with correct status (draft/scheduled)

---

### TASK #050: Email Sending Engine (Throttled)
**Type:** FEATURE
**Priority:** P1  
**Estimated Time:** 45 minutes

#### Objective
Build the email sending engine with rate limiting.

#### Sending Flow
```
POST /campaigns/[id]/send
  ↓
Update campaign status = 'sending'
Queue all recipients as outreach_emails (status = 'pending')
  ↓
Start send loop:
  - Get next pending email
  - Render template with personalization
  - Send via Resend API (plain text)
  - Update email status = 'sent', store resend_id
  - Increment campaign.sent_count
  - Wait send_delay_ms
  - Repeat until none pending or paused
  ↓
If all sent: status = 'completed'
If paused: status = 'paused'
```

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/api/outreach/campaigns/[id]/send/route.ts` | POST start sending |
| `src/app/api/outreach/campaigns/[id]/pause/route.ts` | POST pause |
| `src/app/api/outreach/campaigns/[id]/resume/route.ts` | POST resume |
| `src/lib/outreach/send.ts` | Email sending logic |

#### Send Logic (src/lib/outreach/send.ts)
```typescript
import { Resend } from 'resend';
import { createClient } from '@/utils/supabase/server';
import { renderTemplate } from './templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSingleEmail(emailId: string): Promise<{
  success: boolean;
  resendId?: string;
  error?: string;
}> {
  const supabase = createClient();
  
  // Get email with campaign and template
  const { data: email } = await supabase
    .from('outreach_emails')
    .select(`
      *,
      campaign:outreach_campaigns(
        *,
        template:outreach_templates(*)
      )
    `)
    .eq('id', emailId)
    .single();
  
  if (!email || !email.campaign || !email.campaign.template) {
    return { success: false, error: 'Email or campaign not found' };
  }
  
  // Render template
  const { subject, body } = renderTemplate(
    {
      subject: email.campaign.template.subject,
      body: email.campaign.template.body,
    },
    email.personalization
  );
  
  try {
    // Send via Resend - PLAIN TEXT ONLY for personal feel
    const { data, error } = await resend.emails.send({
      from: `${email.campaign.from_name} <${email.campaign.from_email}>`,
      replyTo: email.campaign.reply_to,
      to: email.recipient_email,
      subject: subject,
      text: body, // Plain text only!
      headers: {
        'X-Campaign-Id': email.campaign_id,
        'X-Email-Id': email.id,
      },
    });
    
    if (error) {
      await supabase
        .from('outreach_emails')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', emailId);
      
      return { success: false, error: error.message };
    }
    
    // Update email as sent
    await supabase
      .from('outreach_emails')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_id: data?.id,
        rendered_subject: subject,
        rendered_body: body,
      })
      .eq('id', emailId);
    
    // Log event
    await supabase.from('outreach_events').insert({
      email_id: emailId,
      campaign_id: email.campaign_id,
      event_type: 'sent',
    });
    
    // Increment counter
    await supabase.rpc('increment_campaign_sent', {
      p_campaign_id: email.campaign_id,
    });
    
    return { success: true, resendId: data?.id };
    
  } catch (err: any) {
    await supabase
      .from('outreach_emails')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error_message: err.message,
      })
      .eq('id', emailId);
    
    return { success: false, error: err.message };
  }
}

export async function processCampaignBatch(
  campaignId: string,
  batchSize: number = 10
): Promise<{ processed: number; remaining: number; completed: boolean }> {
  const supabase = createClient();
  
  // Check campaign is still sending
  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('status, send_delay_ms')
    .eq('id', campaignId)
    .single();
  
  if (!campaign || campaign.status !== 'sending') {
    return { processed: 0, remaining: 0, completed: false };
  }
  
  // Get pending emails
  const { data: pendingEmails } = await supabase
    .from('outreach_emails')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize);
  
  if (!pendingEmails || pendingEmails.length === 0) {
    // Mark campaign complete
    await supabase
      .from('outreach_campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
    
    return { processed: 0, remaining: 0, completed: true };
  }
  
  // Send each email with delay
  let processed = 0;
  for (let i = 0; i < pendingEmails.length; i++) {
    // Re-check status before each send
    const { data: currentCampaign } = await supabase
      .from('outreach_campaigns')
      .select('status')
      .eq('id', campaignId)
      .single();
    
    if (currentCampaign?.status !== 'sending') {
      break; // Paused or cancelled
    }
    
    const result = await sendSingleEmail(pendingEmails[i].id);
    if (result.success) {
      processed++;
    }
    
    // Delay before next (except last in batch)
    if (i < pendingEmails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, campaign.send_delay_ms));
    }
  }
  
  // Count remaining
  const { count } = await supabase
    .from('outreach_emails')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  
  return { processed, remaining: count || 0, completed: (count || 0) === 0 };
}
```

#### Send API (POST /api/outreach/campaigns/[id]/send)
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSegmentRecipients, buildPersonalizationData } from '@/lib/outreach/segments';
import { processCampaignBatch } from '@/lib/outreach/send';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const campaignId = params.id;
  
  // Get campaign
  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('*, template:outreach_templates(*)')
    .eq('id', campaignId)
    .single();
  
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  
  if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
    return NextResponse.json({ error: 'Campaign cannot be started' }, { status: 400 });
  }
  
  // Get recipients
  const recipients = await getSegmentRecipients(campaign.segment, campaign.segment_filter);
  
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No recipients in segment' }, { status: 400 });
  }
  
  // Queue all emails
  const emailRecords = recipients.map(recipient => ({
    campaign_id: campaignId,
    customer_id: recipient.id,
    recipient_email: recipient.email,
    recipient_name: recipient.name,
    recipient_company: recipient.company,
    personalization: buildPersonalizationData(recipient),
    status: 'pending',
  }));
  
  // Insert in batches of 100
  for (let i = 0; i < emailRecords.length; i += 100) {
    await supabase
      .from('outreach_emails')
      .insert(emailRecords.slice(i, i + 100));
  }
  
  // Update campaign
  await supabase
    .from('outreach_campaigns')
    .update({
      status: 'sending',
      started_at: new Date().toISOString(),
      total_recipients: recipients.length,
    })
    .eq('id', campaignId);
  
  // Start processing in background (don't await)
  // This will continue after response is sent
  (async () => {
    let completed = false;
    while (!completed) {
      const result = await processCampaignBatch(campaignId, 10);
      completed = result.completed || result.remaining === 0;
      
      // Small delay between batches
      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  })();
  
  return NextResponse.json({
    success: true,
    campaign_id: campaignId,
    total_recipients: recipients.length,
    message: 'Campaign sending started',
  });
}
```

#### Pause API (POST /api/outreach/campaigns/[id]/pause)
```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  
  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('status')
    .eq('id', params.id)
    .single();
  
  if (campaign?.status !== 'sending') {
    return NextResponse.json({ error: 'Campaign is not sending' }, { status: 400 });
  }
  
  await supabase
    .from('outreach_campaigns')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('id', params.id);
  
  return NextResponse.json({ success: true });
}
```

#### Verification
- [ ] POST /campaigns/[id]/send queues all recipients
- [ ] Emails sent at configured rate (check delays)
- [ ] Campaign progress updates (sent_count)
- [ ] Can pause campaign mid-send
- [ ] Can resume paused campaign
- [ ] Campaign status = 'completed' when all sent
- [ ] Failed emails logged with error_message

---

### TASK #051: Resend Webhooks (Opens, Clicks, Bounces)
**Type:** FEATURE
**Priority:** P1
**Estimated Time:** 30 minutes

#### Objective
Handle Resend webhooks for email delivery events.

#### Resend Events to Handle
| Event | Action |
|-------|--------|
| `email.delivered` | Update status, increment delivered_count |
| `email.opened` | Update opened timestamps, increment opened_count |
| `email.clicked` | Update clicked timestamps, increment clicked_count |
| `email.bounced` | Update status to bounced, increment bounced_count |
| `email.complained` | Mark as spam complaint |

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/api/outreach/webhooks/resend/route.ts` | Resend webhook handler |

#### Webhook Handler
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const payload = await request.json();
  const { type, data } = payload;
  
  const supabase = createClient();
  
  // Find email by Resend ID
  const { data: email } = await supabase
    .from('outreach_emails')
    .select('id, campaign_id, status, first_opened_at, first_clicked_at')
    .eq('resend_id', data.email_id)
    .single();
  
  if (!email) {
    // Not an outreach email, ignore
    return NextResponse.json({ received: true });
  }
  
  const now = new Date().toISOString();
  
  switch (type) {
    case 'email.delivered':
      await supabase
        .from('outreach_emails')
        .update({ status: 'delivered', delivered_at: now })
        .eq('id', email.id);
      
      await supabase.rpc('increment_campaign_delivered', { p_campaign_id: email.campaign_id });
      break;
    
    case 'email.opened':
      const isFirstOpen = !email.first_opened_at;
      
      await supabase
        .from('outreach_emails')
        .update({
          status: ['clicked', 'replied'].includes(email.status) ? email.status : 'opened',
          first_opened_at: isFirstOpen ? now : email.first_opened_at,
          last_opened_at: now,
          open_count: supabase.sql`open_count + 1`,
        })
        .eq('id', email.id);
      
      if (isFirstOpen) {
        await supabase.rpc('increment_campaign_opened', { p_campaign_id: email.campaign_id });
      }
      break;
    
    case 'email.clicked':
      const isFirstClick = !email.first_clicked_at;
      
      await supabase
        .from('outreach_emails')
        .update({
          status: email.status === 'replied' ? 'replied' : 'clicked',
          first_clicked_at: isFirstClick ? now : email.first_clicked_at,
          click_count: supabase.sql`click_count + 1`,
        })
        .eq('id', email.id);
      
      if (isFirstClick) {
        await supabase.rpc('increment_campaign_clicked', { p_campaign_id: email.campaign_id });
      }
      break;
    
    case 'email.bounced':
      await supabase
        .from('outreach_emails')
        .update({
          status: 'bounced',
          bounced_at: now,
          error_message: data.bounce?.message || 'Bounced',
        })
        .eq('id', email.id);
      
      await supabase.rpc('increment_campaign_bounced', { p_campaign_id: email.campaign_id });
      break;
    
    case 'email.complained':
      await supabase
        .from('outreach_emails')
        .update({
          status: 'bounced',
          bounced_at: now,
          error_message: 'Marked as spam',
        })
        .eq('id', email.id);
      
      await supabase.rpc('increment_campaign_bounced', { p_campaign_id: email.campaign_id });
      break;
  }
  
  // Log event
  await supabase.from('outreach_events').insert({
    email_id: email.id,
    campaign_id: email.campaign_id,
    event_type: type.replace('email.', ''),
    metadata: data,
    resend_event_id: data.event_id,
  });
  
  return NextResponse.json({ received: true });
}
```

#### Resend Dashboard Setup (Manual)
1. Go to Resend Dashboard → Webhooks
2. Add webhook URL: `https://<your-domain>/api/outreach/webhooks/resend`
3. Select events: delivered, opened, clicked, bounced, complained

#### Verification
- [ ] Webhook endpoint returns 200 for valid events
- [ ] Delivered events update email status
- [ ] Open events increment open_count and campaign opened_count
- [ ] Click events increment click_count and campaign clicked_count  
- [ ] Bounce events update status and increment bounced_count
- [ ] Events logged in outreach_events table

---

### TASK #052: Inbound Reply Handling
**Type:** FEATURE
**Priority:** P1
**Estimated Time:** 45 minutes

#### Objective
Capture customer replies via Resend inbound and forward to Chris.

#### Reply Flow
```
Customer replies to email (Reply-To: replies@mact.au)
  ↓
Resend receives email at replies@mact.au
  ↓
Resend sends webhook to /api/outreach/webhooks/inbound
  ↓
Match reply to original email by sender address
  ↓
Store reply in outreach_replies
Update email status = 'replied'
Increment campaign replied_count
  ↓
Forward reply to Chris (c.born@mact.au)
```

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/api/outreach/webhooks/inbound/route.ts` | Inbound email handler |

#### Inbound Handler
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const payload = await request.json();
  
  // Resend inbound email structure
  const {
    from,
    to,
    subject,
    text,
    html,
  } = payload.data || payload;
  
  const supabase = createClient();
  
  // Extract email address from "Name <email>" format
  const fromEmail = from.match(/<(.+)>/)?.[1] || from;
  
  // Find original email we sent to this person
  const { data: originalEmail } = await supabase
    .from('outreach_emails')
    .select('id, campaign_id, recipient_email, recipient_name')
    .eq('recipient_email', fromEmail.toLowerCase())
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();
  
  // Store reply
  const { data: reply } = await supabase
    .from('outreach_replies')
    .insert({
      email_id: originalEmail?.id || null,
      campaign_id: originalEmail?.campaign_id || null,
      from_email: fromEmail,
      from_name: from.match(/^([^<]+)/)?.[1]?.trim() || null,
      subject: subject,
      body_text: text,
      body_html: html,
      status: 'new',
    })
    .select()
    .single();
  
  // If matched to original email
  if (originalEmail) {
    // Update email status
    await supabase
      .from('outreach_emails')
      .update({
        status: 'replied',
        replied_at: new Date().toISOString(),
      })
      .eq('id', originalEmail.id);
    
    // Increment campaign counter
    await supabase.rpc('increment_campaign_replied', {
      p_campaign_id: originalEmail.campaign_id,
    });
    
    // Log event
    await supabase.from('outreach_events').insert({
      email_id: originalEmail.id,
      campaign_id: originalEmail.campaign_id,
      event_type: 'replied',
      metadata: {
        subject,
        body_preview: text?.substring(0, 200),
      },
    });
  }
  
  // Get settings for forwarding
  const { data: settings } = await supabase
    .from('outreach_settings')
    .select('forward_replies, forward_replies_to')
    .single();
  
  // Forward to Chris
  if (settings?.forward_replies && settings?.forward_replies_to) {
    try {
      await resend.emails.send({
        from: 'MACt Outreach <noreply@mact.au>',
        to: settings.forward_replies_to,
        subject: `[Customer Reply] ${subject}`,
        text: `
Reply from: ${from}
${originalEmail ? `Original campaign email to: ${originalEmail.recipient_name} (${originalEmail.recipient_email})` : 'Could not match to campaign'}

---

${text}
        `.trim(),
      });
      
      // Mark as forwarded
      if (reply) {
        await supabase
          .from('outreach_replies')
          .update({
            forwarded_to: settings.forward_replies_to,
            forwarded_at: new Date().toISOString(),
            status: 'forwarded',
          })
          .eq('id', reply.id);
      }
    } catch (err) {
      console.error('Failed to forward reply:', err);
    }
  }
  
  return NextResponse.json({ received: true });
}
```

#### Resend Inbound Setup (Manual)
1. Configure domain for receiving (MX records for mact.au or subdomain)
2. In Resend Dashboard → Receiving → Add inbound webhook
3. URL: `https://<your-domain>/api/outreach/webhooks/inbound`

#### Verification
- [ ] Webhook receives inbound emails
- [ ] Reply matched to original email by sender address
- [ ] Reply stored in outreach_replies
- [ ] Original email status updated to 'replied'
- [ ] Campaign replied_count incremented
- [ ] Reply forwarded to Chris's email
- [ ] Event logged in outreach_events

---

### TASK #053: Campaign Detail + Real-time Stats
**Type:** FEATURE
**Priority:** P1
**Estimated Time:** 45 minutes

#### Objective
Build campaign detail page with live stats and activity feed.

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/outreach/[id]/page.tsx` | Campaign detail page |
| `src/app/api/outreach/campaigns/[id]/stats/route.ts` | Real-time stats |
| `src/app/api/outreach/campaigns/[id]/activity/route.ts` | Activity feed |
| `src/app/api/outreach/campaigns/[id]/replies/route.ts` | List replies |

#### Stats API (GET /api/outreach/campaigns/[id]/stats)
```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  
  const { data: campaign } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .eq('id', params.id)
    .single();
  
  if (!campaign) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  // Calculate rates
  const stats = {
    total_recipients: campaign.total_recipients,
    sent: campaign.sent_count,
    delivered: campaign.delivered_count,
    delivery_rate: campaign.sent_count > 0 
      ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)
      : '0',
    opened: campaign.opened_count,
    open_rate: campaign.delivered_count > 0
      ? ((campaign.opened_count / campaign.delivered_count) * 100).toFixed(1)
      : '0',
    clicked: campaign.clicked_count,
    click_rate: campaign.delivered_count > 0
      ? ((campaign.clicked_count / campaign.delivered_count) * 100).toFixed(1)
      : '0',
    replied: campaign.replied_count,
    reply_rate: campaign.delivered_count > 0
      ? ((campaign.replied_count / campaign.delivered_count) * 100).toFixed(1)
      : '0',
    bounced: campaign.bounced_count,
    bounce_rate: campaign.sent_count > 0
      ? ((campaign.bounced_count / campaign.sent_count) * 100).toFixed(1)
      : '0',
  };
  
  return NextResponse.json({ campaign, stats });
}
```

#### Activity API (GET /api/outreach/campaigns/[id]/activity)
```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  
  const supabase = createClient();
  
  const { data: events } = await supabase
    .from('outreach_events')
    .select(`
      *,
      email:outreach_emails(recipient_email, recipient_name)
    `)
    .eq('campaign_id', params.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return NextResponse.json({ events: events || [] });
}
```

#### UI Layout
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back                                                      │
│                                                             │
│ Campaign Name                          ● Status (Sending)  │
│ ████████████████░░░░░ 287/451 (64%)                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Stats Cards (6 cards in grid):                              │
│ Sent | Delivered | Opened | Clicked | Replied | Bounced    │
│  287 |    245    |   156  |    12   |    32   |     3      │
│      |   85.4%   |  63.7% |   4.9%  |  13.1%  |   1.0%     │
├─────────────────────────────────────────────────────────────┤
│ Recent Activity                              [View All]     │
│ 🟢 Chad Buckley opened                      2 min ago      │
│ 💬 Sarah Jones replied                      5 min ago      │
│ ✉️ Mike Smith delivered                     8 min ago      │
├─────────────────────────────────────────────────────────────┤
│ Replies (32)                                [View All]      │
│ Sarah Jones - "Hi Chris, yes the project..." 5 min ago     │
├─────────────────────────────────────────────────────────────┤
│ Campaign Details                                            │
│ Template: Personal Check-in                                 │
│ Segment: Dormant Customers                                  │
│ Send Rate: 50/hour                                          │
│                              [Pause] [Cancel]               │
└─────────────────────────────────────────────────────────────┘
```

#### Frontend Polling
```typescript
// Poll stats every 5 seconds while sending
useEffect(() => {
  const fetchStats = async () => {
    const res = await fetch(`/api/outreach/campaigns/${id}/stats`);
    const data = await res.json();
    setStats(data);
  };
  
  fetchStats();
  
  if (campaign?.status === 'sending') {
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }
}, [id, campaign?.status]);
```

#### Verification
- [ ] Campaign detail page loads
- [ ] Stats cards show correct values
- [ ] Progress bar shows completion %
- [ ] Activity feed shows recent events
- [ ] Replies section shows customer replies
- [ ] Stats update in real-time while sending
- [ ] Pause/Cancel buttons work

---

### TASK #054: Analytics Dashboard
**Type:** FEATURE
**Priority:** P2
**Estimated Time:** 60 minutes

#### Objective
Build analytics dashboard with aggregate stats across all campaigns.

#### Files to Create
| File | Description |
|------|-------------|
| `src/app/outreach/analytics/page.tsx` | Analytics dashboard |
| `src/app/api/outreach/analytics/route.ts` | Analytics data |

#### Analytics API (GET /api/outreach/analytics)
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = searchParams.get('to') || new Date().toISOString();
  
  const supabase = createClient();
  
  // Get all campaigns in date range
  const { data: campaigns } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .gte('created_at', from)
    .lte('created_at', to);
  
  // Aggregate totals
  const overview = {
    total_sent: 0,
    total_delivered: 0,
    total_opened: 0,
    total_clicked: 0,
    total_replied: 0,
    total_bounced: 0,
  };
  
  campaigns?.forEach(c => {
    overview.total_sent += c.sent_count;
    overview.total_delivered += c.delivered_count;
    overview.total_opened += c.opened_count;
    overview.total_clicked += c.clicked_count;
    overview.total_replied += c.replied_count;
    overview.total_bounced += c.bounced_count;
  });
  
  // Calculate rates
  const rates = {
    delivery_rate: overview.total_sent > 0 
      ? ((overview.total_delivered / overview.total_sent) * 100).toFixed(1)
      : '0',
    open_rate: overview.total_delivered > 0
      ? ((overview.total_opened / overview.total_delivered) * 100).toFixed(1)
      : '0',
    click_rate: overview.total_delivered > 0
      ? ((overview.total_clicked / overview.total_delivered) * 100).toFixed(1)
      : '0',
    reply_rate: overview.total_delivered > 0
      ? ((overview.total_replied / overview.total_delivered) * 100).toFixed(1)
      : '0',
    bounce_rate: overview.total_sent > 0
      ? ((overview.total_bounced / overview.total_sent) * 100).toFixed(1)
      : '0',
  };
  
  // Campaign comparison
  const campaignComparison = campaigns?.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    sent: c.sent_count,
    open_rate: c.delivered_count > 0 
      ? ((c.opened_count / c.delivered_count) * 100).toFixed(1)
      : '0',
    reply_rate: c.delivered_count > 0
      ? ((c.replied_count / c.delivered_count) * 100).toFixed(1)
      : '0',
  }));
  
  // Industry benchmarks (for comparison)
  const benchmarks = {
    delivery_rate: { target: 95, rating: parseFloat(rates.delivery_rate) >= 95 ? 'good' : 'fair' },
    open_rate: { target: 25, rating: parseFloat(rates.open_rate) >= 40 ? 'excellent' : parseFloat(rates.open_rate) >= 25 ? 'good' : 'fair' },
    click_rate: { target: 4, rating: parseFloat(rates.click_rate) >= 10 ? 'excellent' : parseFloat(rates.click_rate) >= 4 ? 'good' : 'fair' },
    reply_rate: { target: 2, rating: parseFloat(rates.reply_rate) >= 5 ? 'excellent' : parseFloat(rates.reply_rate) >= 2 ? 'good' : 'fair' },
    bounce_rate: { target: 2, rating: parseFloat(rates.bounce_rate) <= 1 ? 'excellent' : parseFloat(rates.bounce_rate) <= 2 ? 'good' : 'poor' },
  };
  
  return NextResponse.json({
    overview,
    rates,
    campaigns: campaignComparison,
    benchmarks,
  });
}
```

#### Dashboard UI
```
┌─────────────────────────────────────────────────────────────┐
│ Outreach Analytics                                          │
│ Date Range: [Last 30 days ▼]                               │
├─────────────────────────────────────────────────────────────┤
│ Overview Cards:                                             │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │  1,247  │ │  1,089  │ │   612   │ │   127   │            │
│ │  Sent   │ │Delivered│ │ Opened  │ │ Replied │            │
│ │         │ │  87.3%  │ │  56.2%  │ │  11.7%  │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├─────────────────────────────────────────────────────────────┤
│ Campaign Comparison:                                        │
│ Name                    Sent   Open%   Reply%   Status     │
│ Dormant Win-back        451    54.4%   11.1%    Sending    │
│ VIP Thank You            17    88.2%   47.1%    Complete   │
├─────────────────────────────────────────────────────────────┤
│ Benchmarks:                                                 │
│ Open Rate:   56.2%  ✅ Excellent (Industry avg: 25%)       │
│ Reply Rate:  11.7%  ✅ Excellent (Industry avg: 2%)        │
│ Bounce Rate:  1.2%  ✅ Good (Target: <2%)                  │
└─────────────────────────────────────────────────────────────┘
```

#### Verification
- [ ] Analytics page loads
- [ ] Date range filter works
- [ ] Overview shows aggregate stats
- [ ] Rates calculated correctly
- [ ] Campaign comparison table shows all campaigns
- [ ] Benchmarks show rating vs industry averages

---

## Navigation Update

### Add to Sidebar
Update `src/components/Sidebar.tsx` (or equivalent navigation component):

```typescript
const navigation = [
  // ... existing items
  {
    name: 'Outreach',
    href: '/outreach',
    icon: EnvelopeIcon, // from @heroicons/react
    children: [
      { name: 'Campaigns', href: '/outreach' },
      { name: 'Templates', href: '/outreach/templates' },
      { name: 'Analytics', href: '/outreach/analytics' },
    ],
  },
];
```

---

## Completion Checklist

| Task | Description | Status |
|------|-------------|--------|
| #047 | Database schema + Supabase setup | pending |
| #048 | Templates CRUD + UI | pending |
| #049 | Campaign creation wizard | pending |
| #050 | Email sending engine (throttled) | pending |
| #051 | Resend webhooks (opens, clicks, bounces) | pending |
| #052 | Inbound reply handling | pending |
| #053 | Campaign detail + real-time stats | pending |
| #054 | Analytics dashboard | pending |

---

## Activity Log

<!-- Claude Code will append progress entries here -->

---

## Post-Completion Steps (Manual)

1. **DNS Configuration for mact.au:**
   - Add SPF record for Resend
   - Add DKIM record from Resend dashboard
   - Add MX record for inbound (if using replies@mact.au)

2. **Resend Dashboard Setup:**
   - Verify sending domain (mact.au)
   - Add webhook: `https://your-domain/api/outreach/webhooks/resend`
   - Enable events: delivered, opened, clicked, bounced, complained
   - Add inbound webhook: `https://your-domain/api/outreach/webhooks/inbound`

3. **Testing:**
   - Create test template
   - Create test campaign with 1 recipient (your email)
   - Verify email received, looks personal
   - Reply to email, verify captured and forwarded
   - Check analytics

4. **Deployment:**
   - Deploy to Vercel
   - Verify all API routes work
   - Update Resend webhooks to production URLs

---

## Success Criteria

- [ ] All 8 tasks completed
- [ ] No TypeScript/build errors (`npm run build` passes)
- [ ] Can create templates with variables
- [ ] Can create and launch campaigns
- [ ] Emails sent at throttled rate
- [ ] Opens/clicks/bounces tracked via webhooks
- [ ] Replies captured and forwarded to Chris
- [ ] Analytics dashboard shows aggregate data
- [ ] Navigation includes Outreach section

When all complete, output: **COMPLETE**

---

## Version

Update version to **v2.11.0** in changelog when complete.
