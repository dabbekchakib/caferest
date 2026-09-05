import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthorizationProvider } from "@/components/providers/authorization-provider";
import { requireAuth } from "@/lib/auth/auth-utils";
import { getAuthorizationContext } from "@/services/authorization";

/**
 * Protected layout for every private page of the application.
 * - Runs `requireAuth()` server-side (redirect → /login or /account-disabled).
 * - Computes the per-request authorization snapshot and exposes it to all
 *   client components (sidebar filtering, PermissionGate, establishment
 *   switcher) via the AuthorizationProvider.
 * - Wraps children in the application shell (sidebar, topbar, mobile drawer).
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAuth();
  const authorization = await getAuthorizationContext();

  return (
    <AuthorizationProvider value={authorization}>
      <AppShell>{children}</AppShell>
    </AuthorizationProvider>
  );
}