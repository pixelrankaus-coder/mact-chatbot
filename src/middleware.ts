import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Task 044: Auth Middleware
 *
 * Protects routes that require authentication:
 * - /inbox
 * - /customers
 * - /settings
 * - /orders
 * - /ai-agent
 *
 * Redirects unauthenticated users to /login
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/inbox",
  "/customers",
  "/settings",
  "/orders",
  "/ai-agent",
];

// Routes that should redirect to inbox if authenticated
const AUTH_ROUTES = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a Supabase client with cookies
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get the current session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if the path is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if the path is an auth route (login)
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isAuthRoute && user) {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/inbox";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes (API endpoints)
     * - widget routes (public widget API)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api|widget).*)",
  ],
};
