# MACt Chatbot

AI-powered customer service chatbot for MACt (Mining & Cement Technology).

## Quick Links

- [Project Overview](./docs/PROJECT-OVERVIEW.md)
- [API Reference](./docs/API-REFERENCE.md)
- [Widget Installation](./docs/WIDGET-GUIDE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Task Template](./docs/MASTER-TASK-TEMPLATE.md)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Fill in environment variables
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the admin panel.

## Tech Stack

- **Frontend:** Next.js 16 + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** Supabase (PostgreSQL + Realtime)
- **AI:** OpenAI GPT-4o-mini
- **Hosting:** Vercel
- **Widget:** Vanilla JS with Shadow DOM

## Features

- AI-powered chat responses with knowledge base
- Human handoff to support agents
- WooCommerce order status lookup
- Embeddable widget for any website
- WordPress plugin for easy integration
- Visitor tracking and analytics
- Customizable appearance and personality

## Documentation

See the [docs/](./docs/) folder for full documentation:

| Document | Description |
|----------|-------------|
| [PROJECT-OVERVIEW.md](./docs/PROJECT-OVERVIEW.md) | Architecture, tech stack, key files |
| [API-REFERENCE.md](./docs/API-REFERENCE.md) | All API endpoints |
| [WIDGET-GUIDE.md](./docs/WIDGET-GUIDE.md) | Widget installation and customization |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Deployment and infrastructure |
| [MASTER-TASK-TEMPLATE.md](./docs/MASTER-TASK-TEMPLATE.md) | Task template for development |

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

## License

Proprietary - MACt
