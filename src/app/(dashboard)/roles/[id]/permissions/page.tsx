import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getRole, getRolePermissionIds } from "@/services/roles-service";
import { listAllPermissions } from "@/services/permissions-service";
import { RolePermissionsMatrix } from "@/features/roles/role-permissions";
import type { RoleCard } from "@/lib/authorization/types";

export const metadata: Metadata = {
  title: "Role permissions",
};

interface RolePermissionsPageProps {
  params: Promise<{ id: string }>;
}

export default async function RolePermissionsPage({
  params,
}: RolePermissionsPageProps) {
  const { id } = await params;
  await requirePagePermission("roles.view");
  const establishmentId = await requireCurrentEstablishment();

  const role: RoleCard | null = await getRole(establishmentId, id);
  if (!role) notFound();

  const [canUpdate, permissionIds, permissions] = await Promise.all([
    hasPermission("roles.update"),
    getRolePermissionIds(id),
    listAllPermissions(),
  ]);

  return (
    <RolePermissionsMatrix
      role={role}
      canUpdate={canUpdate}
      permissionIds={permissionIds}
      permissions={permissions}
    />
  );
}