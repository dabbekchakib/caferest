import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listRoles } from "@/services/roles-service";
import { RolesList } from "@/features/roles/roles-list";

export const metadata: Metadata = {
  title: "Roles",
};

export default async function RolesPage() {
  await requirePagePermission("roles.view");
  const establishmentId = await requireCurrentEstablishment();

  const [roles, canCreate, canUpdate, canDelete] = await Promise.all([
    listRoles(establishmentId),
    hasPermission("roles.create"),
    hasPermission("roles.update"),
    hasPermission("roles.delete"),
  ]);

  return (
    <RolesList
      roles={roles}
      establishmentId={establishmentId}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}