import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  AUTH_ROUTES,
  DEFAULT_AUTHENTICATED_ROUTE,
  LOGIN_ROUTE,
  PUBLIC_ROUTES,
} from "@/lib/auth/auth-redirect";

const isInfrastructurePath = (pathname: string): boolean =>
  pathname.startsWith("/api/") || pathname.startsWith("/auth/callback");

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Authenticated users do not belong on the sign-in pages.
  if (AUTH_ROUTES.has(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(
        new URL(DEFAULT_AUTHENTICATED_ROUTE, request.url)
      );
    }
    return response;
  }

  // Never bounce API / auth callback traffic.
  if (PUBLIC_ROUTES.has(pathname) || isInfrastructurePath(pathname)) {
    return response;
  }

  // Unauthenticated visitors get pointed to the login page with a safe
  // redirect target so they land back where they meant to go.
  if (!isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    if (pathname !== "/") {
      url.search = `?redirect=${encodeURIComponent(pathname + search)}`;
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
