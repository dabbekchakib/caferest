import type {
  AuthClientLike,
  AuthErrorLike,
  AuthSessionLike,
  ProfileResult,
  SignInResult,
  SignOutResult,
  UserProfile,
  UserResult,
} from "./auth-types";

export interface SpecifyRedirectTo {
  redirectTo?: string;
}

/**
 * Sign in with email + password.
 * Supabase returns a user even when the profile is later found disabled, so the
 * caller must also verify `isProfileActive()` before granting access.
 */
export async function signInWithPassword(
  client: AuthClientLike,
  credentials: { email: string; password: string }
): Promise<SignInResult> {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) return { user: null, error };
  return { user: data.user, error: null };
}

/** Destroy the current session (also revokes the token server-side). */
export async function signOut(client: AuthClientLike): Promise<SignOutResult> {
  const { error } = await client.auth.signOut();
  return { error };
}

/** Resolve the authenticated user from the session/token (server-safe). */
export async function getCurrentUser(
  client: AuthClientLike
): Promise<UserResult> {
  const { data, error } = await client.auth.getUser();
  return { user: data.user, error };
}

/** Manual password reset request (email with a reset link). */
export async function resetPasswordForEmail(
  client: AuthClientLike,
  email: string,
  options: SpecifyRedirectTo
): Promise<{ data: unknown; error: AuthErrorLike | null }> {
  const { data, error } = await client.auth.resetPasswordForEmail(
    email,
    options
  );
  return { data, error };
}

/** Set a new password using the recovery session/auth flow. */
export async function updatePassword(
  client: AuthClientLike,
  password: string
): Promise<UserResult> {
  const { data, error } = await client.auth.updateUser({ password });
  return { user: data.user, error };
}

/** Exchange a PKCE recovery code for a session (password-recovery links). */
export async function exchangeCodeForSession(
  client: AuthClientLike,
  code: string
): Promise<{ session: AuthSessionLike | null; error: AuthErrorLike | null }> {
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  return { session: data?.session ?? null, error };
}

/** Fetch the current user's profile row (RLS-restricted to the own row). */
export async function getCurrentProfile(
  client: AuthClientLike
): Promise<ProfileResult> {
  const { user } = await getCurrentUser(client);
  if (!user) return { profile: null, error: null };

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { profile: data, error };
}

/** A user may use the app only when an active profile exists. */
export function isProfileActive(
  profile: UserProfile | null | undefined
): boolean {
  return Boolean(profile && profile.is_active);
}
