"use client";

import { createContext, useContext } from "react";
import type {
  AuthSessionLike,
  AuthUserLike,
  UserProfile,
} from "@/lib/auth/auth-types";

export interface AuthContextValue {
  /** Current Supabase session (source of truth for auth state). */
  session: AuthSessionLike | null;
  /** Authenticated user derived from the session. */
  user: AuthUserLike | null;
  /** The user's profile row, or null while unknown. */
  profile: UserProfile | null;
  /** True until the initial session/profile has been resolved. */
  loading: boolean;
  /** Re-fetch the profile from Supabase (e.g. after an update). */
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within <AuthProvider>");
  }
  return ctx;
}
