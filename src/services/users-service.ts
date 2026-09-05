import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import type { AdminUserView } from "@/lib/authorization/types";

type AdminClient = SupabaseClient<Database>;

export interface ListUsersParams {
  query?: string;
  roleCode?: string;
  establishmentId?: string;
  isActive?: boolean;
}

interface DatabaseUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface MappedUser extends DatabaseUser {
  confirmed: boolean;
  invited: boolean;
  last_sign_in_at: string | null;
  roleCodes: string[];
  establishmentIds: string[];
}

/**
 * List users with their roles and memberships.
 *
 * Runs on the service-role client (bypasses RLS on purpose): the caller must
 * gate access with `requirePermission("users.view")` first. Individual rows
 * only expose the fields the UI needs (no auth secrets).
 */
export async function listUsers(
  params: ListUsersParams = {}
): Promise<AdminUserView[]> {
  const admin = await createAdminClient();

  const { data: authUsers, error } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) {
    throw new AuthorizationError("GENERIC", error.message);
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, phone, is_active");
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("user_id, establishment_id, roles(code)");
  const roleByUser = new Map<string, Set<string>>();
  const estByUser = new Map<string, Set<string>>();
  for (const row of roleRows ?? []) {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    if (!role) continue;
    const codes = roleByUser.get(row.user_id) ?? new Set<string>();
    codes.add(role.code);
    roleByUser.set(row.user_id, codes);
    const ests = estByUser.get(row.user_id) ?? new Set<string>();
    ests.add(row.establishment_id);
    estByUser.set(row.user_id, ests);
  }

  const mapped: MappedUser[] = authUsers.users.map((u) => {
    const profile = profileById.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      is_active: profile?.is_active ?? false,
      created_at: u.created_at,
      confirmed: Boolean(u.email_confirmed_at),
      invited: Boolean(u.invited_at),
      last_sign_in_at: u.last_sign_in_at ?? null,
      roleCodes: [...(roleByUser.get(u.id) ?? [])],
      establishmentIds: [...(estByUser.get(u.id) ?? [])],
    } satisfies MappedUser;
  });

  let users = mapped;

  if (params.query) {
    const q = params.query.trim().toLowerCase();
    users = users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
    );
  }
  if (params.roleCode) {
    users = users.filter((u) => u.roleCodes.includes(params.roleCode!));
  }
  if (params.establishmentId) {
    users = users.filter((u) =>
      u.establishmentIds.includes(params.establishmentId!)
    );
  }
  if (params.isActive === true) users = users.filter((u) => u.is_active);
  if (params.isActive === false) users = users.filter((u) => !u.is_active);

  return users
    .sort((a, b) => a.email.localeCompare(b.email))
    .map(toView);
}

function toView(user: MappedUser): AdminUserView {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    isActive: user.is_active,
    confirmed: user.confirmed,
    invited: user.invited,
    lastSignInAt: user.last_sign_in_at,
    createdAt: user.created_at,
    roleCodes: user.roleCodes,
    establishmentIds: user.establishmentIds,
  };
}

/** Full view of a single user (null when the user does not exist). */
export async function getUser(userId: string): Promise<AdminUserView | null> {
  const list = await listUsers();
  return list.find((u) => u.id === userId) ?? null;
}

/**
 * Invite a user by email and bootstrap their ownership of the target
 * establishment (profile + membership + role assignment).
 *
 * Requires (caller-side) `users.invite`/`users.create` + hierarchy checks; the
 * membership and role-insert statements also pass through the user's own
 * session RLS as defense in depth.
 */
export async function inviteUser(input: {
  email: string;
  establishmentId: string;
  roleId: string;
  redirectTo?: string;
}): Promise<AdminUserView> {
  const admin = await createAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data: created, error } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: input.redirectTo,
      data: {},
    }
  );

  if (error) {
    if (
      error.message?.toLowerCase().includes("already been registered") ||
      error.status === 422 ||
      error.status === 409
    ) {
      const existing = await findUserByEmail(admin, email);
      if (existing) {
        await upsertProfile(admin, existing.id, null, null);
        await ensureMembershipAndRole({
          userId: existing.id,
          establishmentId: input.establishmentId,
          roleId: input.roleId,
        });
        return toView(await toMappedUser(admin, existing.id));
      }
    }
    throw new AuthorizationError("GENERIC", error.message);
  }

  await upsertProfile(admin, created.user.id, null, null);
  await ensureMembershipAndRole({
    userId: created.user.id,
    establishmentId: input.establishmentId,
    roleId: input.roleId,
  });

  return toView(await toMappedUser(admin, created.user.id));
}

async function findUserByEmail(
  admin: AdminClient,
  email: string
) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
}

async function upsertProfile(
  admin: AdminClient,
  userId: string,
  fullName: string | null,
  phone: string | null
): Promise<void> {
  const { error } = await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    phone,
  });
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

async function ensureMembershipAndRole(input: {
  userId: string;
  establishmentId: string;
  roleId: string;
}): Promise<void> {
  const client = await createClient();

  const { error: memberError } = await client.from("establishment_members").upsert(
    {
      user_id: input.userId,
      establishment_id: input.establishmentId,
      is_active: true,
    },
    { onConflict: "user_id,establishment_id" }
  );
  if (memberError) {
    throw new AuthorizationError("GENERIC", memberError.message);
  }

  const { error: roleError } = await client.from("user_roles").insert({
    user_id: input.userId,
    role_id: input.roleId,
    establishment_id: input.establishmentId,
  });
  if (roleError) {
    throw new AuthorizationError("GENERIC", roleError.message);
  }
}

async function toMappedUser(
  admin: AdminClient,
  userId: string
): Promise<MappedUser> {
  const { data: authUsers } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  const user = authUsers.users.find((u) => u.id === userId);
  if (!user) throw new AuthorizationError("RESOURCE_NOT_FOUND");

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone, is_active")
    .eq("id", userId)
    .maybeSingle();

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("establishment_id, roles(code)")
    .eq("user_id", userId);

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    is_active: profile?.is_active ?? false,
    created_at: user.created_at,
    confirmed: Boolean(user.email_confirmed_at),
    invited: !user.role && Boolean(user.invited_at),
    last_sign_in_at: user.last_sign_in_at ?? null,
    roleCodes: [
      ...new Set(
        (roleRows ?? []).flatMap((r) => {
          const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
          return role ? [role.code] : [];
        })
      ),
    ],
    establishmentIds: [...new Set((roleRows ?? []).map((r) => r.establishment_id))],
  };
}

/** Activate / deactivate a profile (service-role: RLS-free on purpose). */
export async function updateUserStatus(
  userId: string,
  isActive: boolean
): Promise<void> {
  const admin = await createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Remove the user entirely (cascades profile, memberships and roles). */
export async function deleteUser(userId: string): Promise<void> {
  const admin = await createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId, true);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}