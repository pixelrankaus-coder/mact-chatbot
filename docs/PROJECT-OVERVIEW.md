# MACt Chatbot - Project Overview

## Tech Stack

- **Frontend:** Next.js 16.1.1 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix UI)
- **Database:** Supabase (PostgreSQL + Realtime + Auth + Storage)
- **AI:** OpenAI GPT-4o-mini
- **Hosting:** Vercel
- **Widget:** Vanilla JS with Shadow DOM (v2.0.3)
- **CMS Integration:** WordPress/WooCommerce

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WordPress     │     │    Vercel       │     │    Supabase     │
│   (pix1.dev)    │────▶│   (Next.js)     │────▶│   (Database)    │
│                 │     │                 │     │                 │
│  chat-widget.js │     │  /api/widget/*  │     │  conversations  │
│                 │     │  /api/chat      │     │  messages       │
└─────────────────┘     │  Admin Panel    │     │  settings       │
                        └─────────────────┘     │  knowledge_base │
                                                └─────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `/src/app/page.tsx` | Admin Dashboard |
| `/src/app/inbox/page.tsx` | Conversation Inbox |
| `/src/app/ai-agent/page.tsx` | AI Settings + Knowledge Base |
| `/src/app/settings/appearance/page.tsx` | Widget Appearance Settings |
| `/src/app/settings/installation/page.tsx` | Installation Guide |
| `/src/app/settings/operating-hours/page.tsx` | Business Hours Config |
| `/src/app/settings/integrations/page.tsx` | Third-party Integrations |
| `/src/app/settings/team/page.tsx` | Team Management |
| `/src/app/api/widget/*` | Widget API endpoints |
| `/src/app/api/chat/route.ts` | AI chat endpoint |
| `/src/lib/ai.ts` | OpenAI integration |
| `/src/lib/supabase.ts` | Supabase client |
| `/src/lib/woocommerce.ts` | WooCommerce integration |
| `/public/widget/chat-widget-v2.js` | Embeddable widget |
| `/wordpress-plugin/` | WordPress plugin |
| `/supabase/schema.sql` | Database schema |

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `conversations` | Visitor chat sessions with metadata |
| `messages` | Individual messages (visitor/ai/agent/system) |
| `settings` | Key-value configuration store |
| `knowledge_base` | Uploaded documents for AI training |
| `users` | Team members with roles |

### Key Enums

- **conversation_status:** `active`, `pending`, `resolved`
- **message_sender_type:** `visitor`, `ai`, `agent`, `system`
- **user_role:** `owner`, `admin`, `agent`
- **knowledge_base_status:** `processing`, `ready`, `error`

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# WooCommerce (Optional)
WOOCOMMERCE_URL=https://pix1.dev/mact
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

## URLs

| Environment | URL |
|-------------|-----|
| Admin Panel | https://mact-chatbot.vercel.app |
| Widget Script | https://mact-chatbot.vercel.app/widget/chat-widget-v2.js |
| Staging Site | https://pix1.dev/mact |
| Production | https://mact.au (future) |

## Directory Structure

```
mact-chatbot/
├── docs/                    # Project documentation
├── public/
│   └── widget/              # Embeddable chat widget
├── scripts/                 # Utility scripts
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   ├── inbox/           # Conversation management
│   │   ├── ai-agent/        # AI settings
│   │   ├── settings/        # Configuration pages
│   │   └── widget-test/     # Widget testing page
│   ├── components/          # React components
│   │   ├── layout/          # Layout components
│   │   ├── settings/        # Settings components
│   │   └── ui/              # shadcn/ui components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core utilities
│   └── types/               # TypeScript types
├── supabase/                # Database schema & migrations
└── wordpress-plugin/        # WordPress integration
```

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| AI Chat | Complete | OpenAI-powered responses with context |
| Conversation Inbox | Complete | Filter, assign, manage conversations |
| Human Handoff | Complete | Transfer from AI to human agent |
| Knowledge Base | Complete | Upload docs to train AI |
| Order Lookup | Complete | WooCommerce order status |
| Visitor Tracking | Complete | Browser, device, location, pages |
| Widget Customization | Complete | Colors, position, messages |
| WordPress Plugin | Complete | Easy WP integration |
| Operating Hours | Partial | Schema ready, UI exists |
| Team Management | Partial | Roles defined, basic UI |
