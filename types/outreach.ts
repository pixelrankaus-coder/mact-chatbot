// MACt Outreach Module - TypeScript Types

export interface OutreachSignature {
  id: string;
  name: string;
  signature_html: string;
  signature_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

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
  segment: "dormant" | "vip" | "active" | "all" | "custom";
  segment_filter?: Record<string, unknown>;
  from_name: string;
  from_email: string;
  reply_to: string;
  send_rate: number;
  send_delay_ms: number;
  status:
    | "draft"
    | "scheduled"
    | "sending"
    | "paused"
    | "completed"
    | "cancelled";
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
  is_dry_run?: boolean;
  // Auto-resend to non-openers
  auto_resend_enabled?: boolean;
  resend_delay_hours?: number;
  resend_subject?: string;
  resend_campaign_id?: string;
  parent_campaign_id?: string;
  signature_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined
  template?: OutreachTemplate;
  signature?: OutreachSignature;
}

export interface OutreachEmail {
  id: string;
  campaign_id: string;
  customer_id?: string;
  recipient_email: string;
  recipient_name?: string;
  recipient_company?: string;
  personalization: PersonalizationData;
  rendered_subject?: string;
  rendered_body?: string;
  resend_id?: string;
  status:
    | "pending"
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "replied"
    | "bounced"
    | "failed";
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
  event_type:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "replied"
    | "bounced"
    | "complained";
  metadata?: Record<string, unknown>;
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
  status: "new" | "forwarded" | "read" | "archived";
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
  send_window_start: string;
  send_window_end: string;
  timezone: string;
  track_opens: boolean;
  track_clicks: boolean;
  signature_json: Record<string, unknown> | null;
  signature_html: string;
  automation_signature_json: Record<string, unknown> | null;
  automation_signature_html: string;
  default_signature_id?: string | null;
  automation_signature_id?: string | null;
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
  first_name?: string;
  last_name?: string;
  company?: string;
  last_product?: string;
  last_order_date?: string;
  days_since_order?: number;
  total_spent?: number;
  order_count?: number;
  product_mentioned?: string;
  chat_summary?: string;
  discount_code?: string;
  product_url?: string;
}

// Create/Update request types
export interface CreateCampaignRequest {
  name: string;
  template_id: string;
  segment: "dormant" | "vip" | "active" | "all" | "custom";
  segment_filter?: Record<string, unknown>;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  send_rate?: number;
  scheduled_at?: string;
  start_immediately?: boolean;
  is_dry_run?: boolean;
  auto_resend_enabled?: boolean;
  resend_delay_hours?: number;
  resend_subject?: string;
}

export interface CreateTemplateRequest {
  name: string;
  subject: string;
  body: string;
}

export interface PreviewResponse {
  campaign: OutreachCampaign;
  template: OutreachTemplate;
  total_recipients: number;
  sample_recipients: Array<{
    email: string;
    name: string;
    personalization: PersonalizationData;
    preview: { subject: string; body: string };
  }>;
}

export interface AnalyticsOverview {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
}

export interface AnalyticsRates {
  delivery_rate: string;
  open_rate: string;
  click_rate: string;
  reply_rate: string;
  bounce_rate: string;
}

export interface CampaignComparison {
  id: string;
  name: string;
  status: string;
  sent: number;
  open_rate: string;
  reply_rate: string;
}

export interface AnalyticsBenchmark {
  target: number;
  rating: "excellent" | "good" | "fair" | "poor";
}

export interface AnalyticsResponse {
  overview: AnalyticsOverview;
  rates: AnalyticsRates;
  campaigns: CampaignComparison[];
  benchmarks: {
    delivery_rate: AnalyticsBenchmark;
    open_rate: AnalyticsBenchmark;
    click_rate: AnalyticsBenchmark;
    reply_rate: AnalyticsBenchmark;
    bounce_rate: AnalyticsBenchmark;
  };
}
