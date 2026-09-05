import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/auth-utils";

/**
 * Protected layout for every private page of the application.
 * - Runs `requireAuth()` server-side (redirect → /login or /account-disabled).
 * - Wraps children in the application shell (sidebar, topbar, mobile drawer).
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAuth();

  return <AppShell>{children}</AppShell>;
}
