import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasAnyPermission,
  hasPermission,
} from "@/services/authorization";
import { listUsers } from "@/services/users-service";
import { listRoles } from "@/services/roles-service";
import { UsersList } from "@/features/users/users-list";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage() {
  await requirePagePermission("users.view");
  const establishmentId = await requireCurrentEstablishment();

  const [users, roles, canInvite, canUpdate, canDelete] = await Promise.all([
    listUsers(),
    listRoles(establishmentId),
    hasAnyPermission(["users.create", "users.invite"]),
    hasPermission("users.update"),
    hasPermission("users.delete"),
  ]);

  return (
    <UsersList
      users={users}
      roles={roles}
      canInvite={canInvite}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}