/**
 * Serialization-friendly authorization shapes shared between the server
 * authorization service and the client provider/components.
 *
 * Everything here must be JSON-safe (the server → client boundary).
 */

export interface AuthorizationEstablishment {
  id: string;
  name: string;
  isActive: boolean;
}

export interface AuthorizationRole {
  id: string;
  code: string;
  name: string;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  establishmentId: string | null;
}

export interface AuthorizationContext {
  /** Authenticated user (id is always present when the context exists). */
  userId: string;
  email: string | null;
  fullName: string | null;
  /** Super admin flag (global, cross-establishment capability). */
  isSuperAdmin: boolean;
  /** Establishments the user belongs to (memberships). */
  memberships: AuthorizationEstablishment[];
  /** Explicitly-selected establishment id (validated membership). */
  currentEstablishmentId: string | null;
  /** Roles held in the current establishment (any, for badges/UI). */
  roles: AuthorizationRole[];
  /** Effective permission slugs for the current establishment. */
  permissionSlugs: string[];
  /** Highest role level in the current establishment (0 = none). */
  maxRoleLevel: number;
}

/** View of a member for the users administration screens. */
export interface AdminUserView {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  isActive: boolean;
  confirmed: boolean;
  invited: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  roleCodes: string[];
  establishmentIds: string[];
}

export interface RoleCard {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  level: number;
  establishmentId: string | null;
  permissionCount: number;
  userCount: number;
}

export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  establishmentId: string;
  roleCode: string;
  roleName: string;
  roleLevel: number;
  establishmentName: string | null;
  createdAt: string;
}