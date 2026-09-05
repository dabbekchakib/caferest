"use client";

import { useMemo, type ReactNode } from "react";
import { AuthorizationContext } from "./authorization-context";
import type { AuthorizationContext as AuthorizationContextType } from "@/lib/authorization/types";

export interface AuthorizationProviderProps {
  /** Server-computed authorization snapshot. */
  value: AuthorizationContextType;
  children: ReactNode;
}

/**
 * Makes the server-computed authorization context available to every client
 * component (sidebar filtering, PermissionGate, establishment switcher).
 *
 * Permission checks must never rely on this data alone — the server always
 * re-validates with `requirePermission` before acting.
 */
export function AuthorizationProvider({
  value,
  children,
}: AuthorizationProviderProps) {
  const context = useMemo(() => value, [value]);
  return (
    <AuthorizationContext.Provider value={context}>
      {children}
    </AuthorizationContext.Provider>
  );
}