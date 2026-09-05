"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthClientLike, UserProfile } from "@/lib/auth/auth-types";
import { getCurrentProfile } from "@/lib/auth/auth-service";
import { AuthContext, type AuthContextValue } from "./auth-context";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type BrowserClient = SupabaseClient<Database>;

export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Global authentication provider.
 *
 * The Supabase session is the single source of truth. This provider exposes
 * the session, the current user, and the profile to the whole tree, and keeps
 * them in sync through `onAuthStateChange`. UI state (theme, sidebars…) stays
 * in Zustand and is deliberately NOT stored here.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthContextValue["session"]>(null);
  const [user, setUser] = useState<AuthContextValue["user"]>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<BrowserClient | null>(null);

  const fetchProfile = useCallback(async (theClient: AuthClientLike) => {
    const { profile: nextProfile } = await getCurrentProfile(theClient);
    if (nextProfile) setProfile(nextProfile);
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const client = createClient();
        clientRef.current = client;

        const {
          data: { session: initialSession },
        } = await client.auth.getSession();

        if (!active) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);
        if (initialSession?.user) {
          void fetchProfile(client as unknown as AuthClientLike);
        }

        const { data } = client.auth.onAuthStateChange(
          (_event, nextSession) => {
            if (!active) return;
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            if (nextSession?.user) {
              void fetchProfile(client as unknown as AuthClientLike);
            } else {
              setProfile(null);
            }
          }
        );
        subscription = data.subscription;
      } catch {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      subscription?.unsubscribe();
      clientRef.current = null;
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await fetchProfile(client as unknown as AuthClientLike);
    } catch {
      /* keep the current profile on transient failures */
    }
  }, [fetchProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user, profile, loading, refreshProfile }),
    [session, user, profile, loading, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
