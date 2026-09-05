"use client";

import { createContext } from "react";
import type {
  AuthorizationContext as AuthorizationContextType,
} from "@/lib/authorization/types";

/** Safe empty snapshot while the server context hydrates or on auth failures. */
export const defaultAuthorizationContext: AuthorizationContextType = {
  userId: "",
  email: null,
  fullName: null,
  isSuperAdmin: false,
  memberships: [],
  currentEstablishmentId: null,
  roles: [],
  permissionSlugs: [],
  maxRoleLevel: 0,
};

export const AuthorizationContext = createContext<AuthorizationContextType>(
  defaultAuthorizationContext
);