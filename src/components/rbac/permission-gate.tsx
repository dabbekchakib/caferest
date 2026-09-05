"use client";

import type { ReactNode } from "react";
import { useAuthorization } from "@/hooks/use-authorization";

export interface PermissionGateProps {
  /** Single permission slug that gates the children. */
  permission: string;
  /** Rendered instead of children when the permission is missing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders children only when the current user holds the permission. */
export function PermissionGate({
  permission,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can } = useAuthorization();
  if (!can(permission)) return fallback;
  return children;
}

export interface AnyPermissionGateProps {
  permissions: readonly string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function AnyPermissionGate({
  permissions,
  fallback = null,
  children,
}: AnyPermissionGateProps) {
  const { canAny } = useAuthorization();
  if (!canAny(permissions)) return fallback;
  return children;
}