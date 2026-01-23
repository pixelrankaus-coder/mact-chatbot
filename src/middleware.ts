import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Auth Middleware
 *
 * Protects routes that require authentication and handles session refresh.
 * Uses the official @supabase/ssr pattern for reliable auth.
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/",
  "/inbox",
  "/customers",
  "/settings",
  "/orders",
  "/ai-agent",
];

// Routes that are always public
const PUBLIC_ROUTES = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if the path is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  // For non-protected routes, just pass through
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Update session and check auth for protected routes
  const { user, supabaseResponse } = await updateSession(request);

  // Redirect unauthenticated users to login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
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
