import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthClientLike, AuthUserLike, UserProfile } from "./auth-types";
import { ACCOUNT_DISABLED_ROUTE, LOGIN_ROUTE } from "./auth-redirect";
import { getCurrentProfile, isProfileActive } from "./auth-service";

export interface ServerAuthContext {
  /** Authenticated Supabase user (never null when the guard passes). */
  user: AuthUserLike;
  /** The user's profile row, or null when it has not been created yet. */
  profile: UserProfile | null;
}

/**
 * Server-side route guard. Must run inside a Server Component (or Server
 * Action / Route Handler). Redirects to the auth flow when there is no valid
 * session and to the disabled-compte page when the profile is inactive.
 *
 * Never trusts a client-provided user id: the identity always comes from the
 * refreshed session cookie.
 */
export async function requireAuth(): Promise<ServerAuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(LOGIN_ROUTE);
  }

  const { profile } = await getCurrentProfile(
    supabase as unknown as AuthClientLike
  );

  if (profile && !isProfileActive(profile)) {
    redirect(ACCOUNT_DISABLED_ROUTE);
  }

  return { user, profile };
}

/** Resolve the server-side user without enforcing any guard. */
export async function getServerUser(): Promise<AuthUserLike | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
