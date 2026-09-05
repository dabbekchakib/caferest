import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export interface SessionUpdateResult {
  /**
   * Response to return when no redirect is needed. Carry its cookies — they
   * hold the session refresh.
   */
  response: NextResponse;
  /** True when the request cookie contains a valid, usable session. */
  isAuthenticated: boolean;
}

/**
 * Refresh the Supabase session when the access token is close to expiry and
 * report whether the visitor has a valid session.
 *
 * Never redirects: callers (src/middleware.ts) apply the route protection.
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionUpdateResult> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { response: supabaseResponse, isAuthenticated: false };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session if expired - required for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, isAuthenticated: Boolean(user) };
}
