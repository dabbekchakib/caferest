import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
  getAuthorizationContext,
} from "@/services/authorization";
import { getUser } from "@/services/users-service";
import { listRoles, getUserRoleAssignments } from "@/services/roles-service";
import { UserDetail } from "@/features/users/user-detail";

export const metadata: Metadata = {
  title: "User",
};

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;
  await requirePagePermission("users.view");
  const establishmentId = await requireCurrentEstablishment();

  const user = await getUser(id);
  if (!user) notFound();

  const supabase = await createClient();
  const [assignments, roles, permissionsResult, canUpdate, context] =
    await Promise.all([
      getUserRoleAssignments(id),
      listRoles(establishmentId),
      supabase.rpc("user_get_permissions", {
        p_user_id: id,
        p_est_id: establishmentId,
      }),
      hasPermission("users.update"),
      getAuthorizationContext().catch(() => null),
    ]);

  const permissionSlugs = permissionsResult.data ?? [];

  return (
    <UserDetail
      user={user}
      establishmentId={establishmentId}
      roles={roles}
      assignments={assignments}
      permissionSlugs={permissionSlugs}
      canUpdate={canUpdate}
      isSelf={id === context?.userId}
      actorMaxLevel={context?.maxRoleLevel ?? 0}
      actorIsSuperAdmin={context?.isSuperAdmin ?? false}
    />
  );
}