// Helpdesk Module Types
// MACt Chatbot - Human Handoff & Support Ticket Management

// ============ Enums / Union Types ============

export type TicketStatus = "open" | "pending" | "snoozed" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketChannel = "webchat" | "email" | "phone" | "manual";

// ============ Core Entities ============

export interface HelpdeskTicket {
  id: string;
  conversation_id: string;
  customer_id: string | null; // woo_customers.id if linked
  cin7_customer_id: string | null;

  // Ticket metadata
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  subject: string | null;

  // Assignment
  assigned_to: string | null; // For future multi-agent support

  // Timestamps
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  snoozed_until: string | null;
  first_response_at: string | null;

  // Metrics
  response_time_seconds: number | null;
  resolution_time_seconds: number | null;

  // Internal notes (not visible to customer)
  internal_notes: string | null;
}

export interface HelpdeskTag {
  id: string;
  name: string;
  color: string; // hex color
  description: string | null;
  created_at: string;
}

export interface HelpdeskTicketTag {
  ticket_id: string;
  tag_id: string;
  created_at: string;
}

export interface HelpdeskMacro {
  id: string;
  name: string;
  content: string; // The reply text with optional {{variables}}
  shortcut: string | null; // e.g., "/refund" for quick access
  category: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface HelpdeskSettings {
  id: string;
  enabled: boolean;
  auto_create_tickets: boolean; // Auto-create ticket on handoff
  default_priority: TicketPriority;
  snooze_options: number[]; // Hours: [1, 4, 24, 48]
  working_hours: {
    enabled: boolean;
    timezone: string;
    schedule: {
      [day: string]: { start: string; end: string } | null;
    };
  };
  notifications: {
    email_on_new_ticket: boolean;
    email_on_reply: boolean;
    notification_email: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface HelpdeskCsatResponse {
  id: string;
  ticket_id: string;
  rating: number; // 1-5
  feedback: string | null;
  created_at: string;
}

// ============ Extended Types (with relations) ============

export interface HelpdeskTicketWithRelations extends HelpdeskTicket {
  tags?: HelpdeskTag[];
  conversation?: {
    id: string;
    visitor_id: string;
    visitor_name: string | null;
    visitor_email: string | null;
  };
  messages?: TicketMessage[];
  csat?: HelpdeskCsatResponse | null;
}

export interface TicketMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  created_at: string;
  // Agent-specific fields
  agent_name?: string;
  is_internal_note?: boolean;
}

// ============ Customer Context ============

export interface CustomerContext {
  // WooCommerce customer data
  woo_customer: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    company: string | null;
    phone: string | null;
    billing_address: {
      address_1: string;
      address_2: string;
      city: string;
      state: string;
      postcode: string;
      country: string;
    } | null;
    date_created: string;
    total_spent: number;
    orders_count: number;
  } | null;

  // Cin7 customer data
  cin7_customer: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone: string | null;
    price_tier: string | null;
    credit_limit: number | null;
    balance: number | null;
  } | null;

  // Recent orders
  recent_orders: Array<{
    id: string;
    order_number: string;
    status: string;
    total: number;
    currency: string;
    date_created: string;
    line_items: Array<{
      name: string;
      quantity: number;
      total: number;
    }>;
  }>;

  // Previous tickets
  previous_tickets: Array<{
    id: string;
    subject: string | null;
    status: TicketStatus;
    created_at: string;
    closed_at: string | null;
  }>;

  // Conversation history stats
  conversation_stats: {
    total_conversations: number;
    total_messages: number;
    first_contact: string | null;
    last_contact: string | null;
  };
}

// ============ API Request/Response Types ============

export interface TicketFilters {
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  channel?: TicketChannel;
  assigned_to?: string | null;
  tag_ids?: string[];
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface TicketListResponse {
  tickets: HelpdeskTicketWithRelations[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateTicketRequest {
  conversation_id: string;
  subject?: string;
  priority?: TicketPriority;
  channel?: TicketChannel;
  tag_ids?: string[];
  internal_notes?: string;
}

export interface UpdateTicketRequest {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string | null;
  subject?: string;
  internal_notes?: string;
  snoozed_until?: string | null;
}

export interface SendReplyRequest {
  ticket_id: string;
  content: string;
  is_internal_note?: boolean;
}

export interface TicketStats {
  open: number;
  pending: number;
  snoozed: number;
  closed_today: number;
  avg_response_time: number | null; // seconds
  avg_resolution_time: number | null; // seconds
}

// ============ UI State Types ============

export interface HelpdeskUIState {
  selectedTicketId: string | null;
  filters: TicketFilters;
  view: "all" | "open" | "pending" | "snoozed" | "closed";
  sortBy: "created_at" | "updated_at" | "priority";
  sortOrder: "asc" | "desc";
}
