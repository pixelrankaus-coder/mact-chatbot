# MACt Chatbot - Deployment Guide

## Prerequisites

- Node.js 18+
- npm 9+
- GitHub account
- Vercel account
- Supabase account
- OpenAI API key

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/mact-chatbot.git
cd mact-chatbot
npm install
```

### 2. Supabase Setup

1. Create new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the schema file: `supabase/schema.sql`
4. (Optional) Run seed data: `supabase/seed-conversations.sql`
5. Create storage bucket:
   - Go to Storage → New Bucket
   - Name: `knowledge-base`
   - Public: No
6. Copy API keys from Settings → API:
   - Project URL
   - Anon/Public key
   - Service Role key (keep secret!)

### 3. Environment Variables

Create `.env.local` in project root:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (Required)
OPENAI_API_KEY=sk-...

# WooCommerce (Optional - for order lookup)
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

### 4. Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Vercel Setup

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your repository
4. Add environment variables (same as `.env.local`)
5. Deploy

---

## Deploying Updates

### Standard Deployment

```bash
# 1. Make your changes
# 2. Test locally
npm run build

# 3. Commit
git add .
git commit -m "feat(scope): description"

# 4. Push (triggers auto-deploy)
git push origin main
```

Vercel automatically deploys on push to `main` branch.

### Preview Deployments

Push to any non-main branch for a preview deployment:

```bash
git checkout -b feature/my-feature
git push origin feature/my-feature
```

Vercel creates a unique preview URL for each branch/PR.

---

## Verifying Deployment

### Check Widget Version

```bash
curl -s https://mact-chatbot.vercel.app/widget/chat-widget-v2.js | grep WIDGET_VERSION
```

### Check API Health

```bash
curl -s https://mact-chatbot.vercel.app/api/widget/settings | jq .
```

### Check in Browser

1. Open admin panel: `https://mact-chatbot.vercel.app`
2. Check dashboard loads
3. Check inbox shows conversations
4. Test widget on `/widget-test` page

---

## Rollback

### Quick Rollback (Git)

```bash
git revert HEAD
git push origin main
```

### Vercel Dashboard Rollback

1. Go to Vercel Dashboard → Your Project
2. Click "Deployments"
3. Find the previous working deployment
4. Click "..." → "Promote to Production"

---

## Database Migrations

### Adding New Tables/Columns

1. Write migration SQL in `supabase/migrations/`
2. Test locally or on staging project
3. Run on production Supabase:
   - Go to SQL Editor
   - Paste and run migration

### Backup Before Major Changes

```bash
# Export via Supabase dashboard or CLI
supabase db dump -f backup.sql
```

---

## Environment-Specific Configuration

### Development

- Uses `.env.local`
- Hot reloading enabled
- Debug logging verbose

### Staging (Preview Deployments)

- Uses Vercel environment variables
- Separate Supabase project recommended
- Test with staging WooCommerce

### Production

- Uses Vercel environment variables (Production)
- Production Supabase project
- Production WooCommerce credentials
- Custom domain configured

---

## Production Checklist

Before deploying to production (mact.au):

### Code Ready
- [ ] All features tested on staging
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors

### Data Ready
- [ ] Knowledge base populated with MACt content
- [ ] AI agent settings configured
- [ ] Welcome message customized
- [ ] Operating hours set correctly

### Integrations Ready
- [ ] WooCommerce connected to production store
- [ ] OpenAI API key has sufficient quota
- [ ] Supabase on appropriate plan

### Infrastructure Ready
- [ ] Custom domain added in Vercel
- [ ] DNS configured (A/CNAME records)
- [ ] SSL certificate provisioned (automatic with Vercel)

### WordPress Ready
- [ ] Plugin installed on mact.au
- [ ] Widget URL pointing to production
- [ ] Tested on staging WordPress first

---

## Monitoring

### Vercel Dashboard

- View deployment logs
- Monitor function invocations
- Check error rates

### Supabase Dashboard

- Monitor database connections
- Check storage usage
- Review realtime connections

### OpenAI Dashboard

- Monitor API usage
- Check rate limits
- Review costs

---

## Troubleshooting Deployments

### Build Fails

1. Check Vercel build logs
2. Run `npm run build` locally
3. Fix TypeScript/ESLint errors
4. Verify all dependencies installed

### Environment Variable Issues

1. Check variable names match exactly
2. Ensure no trailing spaces
3. Verify values are correct
4. Redeploy after changing env vars

### API Returns 500 Errors

1. Check Vercel function logs
2. Verify Supabase connection
3. Check OpenAI API key validity
4. Review recent code changes

### Widget Not Loading

1. Check CORS configuration
2. Verify widget script URL
3. Check browser console for errors
4. Ensure API base URL is correct
