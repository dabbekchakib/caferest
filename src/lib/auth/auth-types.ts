/**
 * Shared authentication domain types.
 *
 * These types are intentionally *structural*: they describe the minimal
 * surface of a Supabase client that the auth layer depends on, so the service
 * layer stays testable without instantiating a real client, and so helpers
 * never have to import the full generated database schema.
 */

export type AuthErrorLike = {
  name?: string;
  message?: string;
  code?: string;
  status?: number;
};

export type AuthUserLike = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  preferred_locale: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A chainable, minimal profile query (matches PostgREST builder shape).
 *
 * `maybeSingle` returns a thenable (PostgREST builders are `PromiseLike`), so
 * real Supabase clients satisfy this structurally while test doubles can just
 * return `Promise.resolve(...)`.
 */
export interface AuthQueryLike {
  eq(column: string, value: unknown): AuthQueryLike;
  maybeSingle(): PromiseLike<{
    data: UserProfile | null;
    error: AuthErrorLike | null;
  }>;
}

export interface AuthSessionLike {
  user: AuthUserLike;
}

export interface AuthClientLike {
  auth: {
    getUser(): Promise<{
      data: { user: AuthUserLike | null };
      error: AuthErrorLike | null;
    }>;
    getSession(): Promise<{
      data: { session: AuthSessionLike | null };
      error: AuthErrorLike | null;
    }>;
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{
      data: { user: AuthUserLike | null };
      error: AuthErrorLike | null;
    }>;
    signOut(): Promise<{ error: AuthErrorLike | null }>;
    resetPasswordForEmail(
      email: string,
      options?: { redirectTo?: string }
    ): Promise<{ data: unknown; error: AuthErrorLike | null }>;
    updateUser(attributes: {
      password?: string;
      data?: Record<string, unknown>;
    }): Promise<{
      data: { user: AuthUserLike | null };
      error: AuthErrorLike | null;
    }>;
    exchangeCodeForSession(code: string): Promise<{
      data: { session: AuthSessionLike | null } | null;
      error: AuthErrorLike | null;
    }>;
  };
  from(relation: string): { select(columns?: string): AuthQueryLike };
}

export interface SignInResult {
  /** Normalized authenticated user when the credentials are valid. */
  user: AuthUserLike | null;
  /** Raw Supabase error to map when sign-in failed. */
  error: AuthErrorLike | null;
}

export interface ProfileResult {
  profile: UserProfile | null;
  error: AuthErrorLike | null;
}

export interface UserResult {
  user: AuthUserLike | null;
  error: AuthErrorLike | null;
}

export interface SignOutResult {
  error: AuthErrorLike | null;
}
