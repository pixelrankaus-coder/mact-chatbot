# MACt Chatbot V2 - Project Rules

## CRITICAL RULES - READ BEFORE EVERY TASK

### 1. UI Components
- ONLY use components from this project's /components/ui/ folder
- NEVER create new UI components from scratch
- NEVER install additional UI libraries (no Material UI, no Chakra, etc.)
- If a component is missing, check if it exists first before saying it doesn't

### 2. Styling
- ONLY use Tailwind CSS classes
- ONLY use CSS variables defined in globals.css and themes.css
- NEVER use inline styles
- NEVER create new CSS files

### 3. File Structure
- Keep the existing folder structure
- API routes go in /app/api/
- Pages go in /app/
- Shared components go in /components/
- Hooks go in /hooks/
- Types go in /types/
- Utilities go in /lib/

### 4. Authentication
- Use Supabase Auth (already configured)
- Auth hooks are in /hooks/
- Supabase client is in /lib/supabase/

### 5. Database
- Supabase Postgres (already configured)
- Types are in /types/database.ts
- NEVER modify database schema without explicit approval

### 6. When Making Changes
- Show the file you're about to change BEFORE changing it
- Make minimal changes - don't refactor unrelated code
- Test with `npm run build` after changes
- If build fails, show the FULL error message

### 7. When Something Doesn't Work
- Do NOT keep trying the same approach
- Show me the error and ask for guidance
- Check if the component/function exists in the project first

### 8. Imports
- Use @/ path alias for imports (e.g., @/components/ui/button)
- Check tsconfig.json for path mappings if imports fail

## Project Structure

```
mact-chatbot-v2/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── (auth)/            # Auth pages (login, etc.)
│   └── (dashboard)/       # Dashboard pages
├── components/
│   ├── ui/                # UI Kit components (DO NOT MODIFY)
│   ├── layout/            # Layout components (sidebar, header)
│   ├── dashboard/         # Dashboard-specific components
│   └── providers/         # Context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configurations
│   └── supabase/         # Supabase client
├── types/                 # TypeScript types
└── public/               # Static assets
```

## Tech Stack
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI Kit (Bundui)
- Supabase (Auth + Database)
- Resend (Email)
