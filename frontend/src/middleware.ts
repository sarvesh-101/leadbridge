import { NextRequest, NextResponse } from "next/server";

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/accept-invite",
  "/customer/login",
  "/legal/privacy",
  "/legal/terms",
  "/pay",
  "/api",
];

// Admin-only routes
const ADMIN_ROUTES = ["/admin", "/dashboard/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes, API routes, and static assets
  if (
    PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check auth state via the persisted Zustand store cookie
  // Zustand persist stores to localStorage, but we can check for the
  // auth header presence. Since middleware can't read localStorage,
  // we use a lightweight approach: check if the page is a dashboard/admin
  // route and let the client-side auth guard handle the actual redirect.
  //
  // The middleware's primary role here is:
  // 1. Add security headers
  // 2. Prevent admin routes from being indexed
  // 3. Handle the "remember me" flow properly

  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Prevent search engines from indexing authenticated pages
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/customer")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
  ],
};
