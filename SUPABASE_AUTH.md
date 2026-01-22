# Supabase Authentication - Best Practices Guide

This document outlines the official best practices for Supabase authentication with Next.js App Router.

## Package Requirements

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Note:** The `@supabase/auth-helpers` packages are deprecated. Use `@supabase/ssr` instead.

---

## Project Structure

```
/src/utils/supabase/
  - client.ts      # Browser client for Client Components
  - server.ts      # Server client for Server Components, Actions, Route Handlers
  - middleware.ts  # Middleware helper for session refresh

/src/middleware.ts # Root middleware file

/src/app/
  - auth/
    - callback/route.ts   # OAuth callback handler
    - confirm/route.ts    # Email confirmation handler
  - login/
    - page.tsx            # Login form (can be simple, no client JS needed)
    - actions.ts          # Server actions for login/signup
```

---

## 1. Browser Client (`utils/supabase/client.ts`)

Used in **Client Components** that run in the browser:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Note:** `createBrowserClient` uses a singleton pattern - repeated calls are efficient.

---

## 2. Server Client (`utils/supabase/server.ts`)

Used in **Server Components**, **Server Actions**, and **Route Handlers**:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot write cookies
            // This is handled by middleware instead
          }
        },
      },
    }
  )
}
```

**Key Point:** The `try/catch` in `setAll` is intentional - Server Components cannot write cookies, so this safely ignores the error while middleware handles session refresh.

---

## 3. Middleware Helper (`utils/supabase/middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very
  // hard to debug issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { user, supabaseResponse }
}
```

---

## 4. Root Middleware (`middleware.ts`)

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

const PROTECTED_ROUTES = ['/inbox', '/customers', '/settings', '/orders', '/ai-agent']
const PUBLIC_ROUTES = ['/login', '/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check if protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  // Update session and check auth
  const { user, supabaseResponse } = await updateSession(request)

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api|widget).*)',
  ],
}
```

---

## 5. Server Actions for Login (`login/actions.ts`)

**This is the recommended approach** - more reliable than client-side auth:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/inbox')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Check your email to confirm your account')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

---

## 6. Login Page (`login/page.tsx`)

Simple form using server actions - no client-side JavaScript needed for auth:

```typescript
import { login } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string; redirect?: string }
}) {
  return (
    <form action={login}>
      {searchParams?.error && (
        <div className="text-red-500">{searchParams.error}</div>
      )}

      <input name="email" type="email" required />
      <input name="password" type="password" required />

      <button type="submit">Sign In</button>
    </form>
  )
}
```

---

## 7. Auth Callback Route (`auth/callback/route.ts`)

For OAuth providers:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/inbox'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
}
```

---

## Key Best Practices

1. **Use `@supabase/ssr`** - The auth-helpers packages are deprecated

2. **Create separate clients** - Browser client for Client Components, Server client for Server Components

3. **Implement middleware** - Required for token refresh since Server Components cannot write cookies

4. **Use `getUser()` not `getSession()`** - Always validate server-side with `getUser()`
   ```typescript
   // WRONG - can be spoofed
   const { data: { session } } = await supabase.auth.getSession()

   // CORRECT - validates with Supabase Auth server
   const { data: { user } } = await supabase.auth.getUser()
   ```

5. **Prefer server actions for auth** - More reliable than client-side auth flows

6. **Use `revalidatePath`** - After successful auth to refresh cached data

7. **Handle redirect parameter** - Pass intended destination through login flow

---

## Common Issues

### Login Hanging
- Usually caused by client-side auth with race conditions
- Solution: Use server actions instead

### Random Logouts
- Usually caused by code running between `createServerClient` and `getUser()`
- Solution: Call `getUser()` immediately after creating the client

### Cookies Not Setting
- Server Components cannot write cookies
- Solution: Use middleware to handle token refresh

---

## Migration from Old Patterns

If using the old `@supabase/auth-helpers-nextjs`:

1. Uninstall: `npm uninstall @supabase/auth-helpers-nextjs`
2. Install: `npm install @supabase/ssr`
3. Replace `createClientComponentClient()` with `createBrowserClient()`
4. Replace `createServerComponentClient()` with `createServerClient()`
5. Update cookie handling to use `getAll`/`setAll` pattern
