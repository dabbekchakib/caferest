"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserRound, Plus, X, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/stores/use-toast-store";
import {
  assignRoleAction,
  removeRoleAction,
  setUserStatusAction,
} from "@/features/users/actions";
import type { AdminUserView, RoleCard, UserRoleAssignment } from "@/lib/authorization/types";

interface UserDetailProps {
  user: AdminUserView;
  establishmentId: string;
  roles: RoleCard[];
  assignments: UserRoleAssignment[];
  permissionSlugs: string[];
  canUpdate: boolean;
  isSelf: boolean;
  actorMaxLevel: number;
  actorIsSuperAdmin: boolean;
}

export function UserDetail({
  user,
  establishmentId,
  roles,
  assignments,
  permissionSlugs,
  canUpdate,
  isSelf,
  actorMaxLevel,
  actorIsSuperAdmin,
}: UserDetailProps) {
  const t = useTranslations("users");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tPermissions = useTranslations("permissions");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState("");
  const [busy, setBusy] = useState(false);

  const currentAssignments = assignments.filter(
    (a) => a.establishmentId === establishmentId
  );

  const alreadyAssigned = new Set(currentAssignments.map((a) => a.roleId));

  const assignableRoles = roles.filter(
    (r) =>
      r.isActive &&
      !alreadyAssigned.has(r.id) &&
      (actorIsSuperAdmin || r.level < actorMaxLevel)
  );

  async function handleAssign() {
    if (!selectedRole) return;
    setBusy(true);
    const result = await assignRoleAction({
      userId: user.id,
      roleId: selectedRole,
    });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("detail.addRole") });
      setSelectedRole("");
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  async function handleRemove(roleId: string) {
    setBusy(true);
    const result = await removeRoleAction({ userId: user.id, roleId });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("detail.removeRole") });
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  async function handleToggleStatus() {
    setBusy(true);
    const result = await setUserStatusAction({
      userId: user.id,
      isActive: !user.isActive,
    });
    setBusy(false);
    if (result.ok) {
      toast.success({
        title: user.isActive ? t("actions.deactivate") : t("actions.activate"),
      });
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={user.fullName || user.email}
        breadcrumbs={[
          { label: tn("users"), href: "/users" },
          { label: user.email },
        ]}
        actions={
          canUpdate && !isSelf && !user.isActive ? (
            <Button variant="success" onClick={() => void handleToggleStatus()} loading={busy}>
              {t("actions.activate")}
            </Button>
          ) : canUpdate && !isSelf ? (
            <Button variant="danger" onClick={() => void handleToggleStatus()} loading={busy}>
              {t("actions.deactivate")}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.personal")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                <UserRound className="size-6" aria-hidden />
              </div>
              <div>
                <p className="font-medium">{user.fullName || "—"}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-[var(--color-muted-foreground)]">{t("detail.status")}</span>
              {user.isActive ? (
                <Badge variant="success" dot>{t("status.active")}</Badge>
              ) : user.invited ? (
                <Badge variant="warning" dot>{t("status.invited")}</Badge>
              ) : (
                <Badge variant="danger" dot>{t("status.inactive")}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.roles")}</CardTitle>
            <CardDescription>{t("detail.rolesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentAssignments.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t("detail.noRoles")}
              </p>
            ) : (
              currentAssignments.map((a) => {
                const role = roles.find((r) => r.id === a.roleId);
                return (
                  <div
                    key={a.roleId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.roleName}</Badge>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        L{a.roleLevel}
                      </span>
                    </div>
                    {canUpdate &&
                      !isSelf &&
                      role &&
                      !role.isSystem &&
                      (actorIsSuperAdmin || role.level < actorMaxLevel) && (
                        <button
                          type="button"
                          onClick={() => void handleRemove(a.roleId)}
                          className="rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
                          aria-label={t("detail.removeRole")}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      )}
                  </div>
                );
              })
            )}

            {canUpdate && assignableRoles.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  aria-label={t("detail.addRole")}
                >
                  <option value="">{t("detail.addRole")}…</option>
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="icon-sm"
                  onClick={() => void handleAssign()}
                  disabled={!selectedRole}
                  aria-label={t("detail.addRole")}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden />
                {t("detail.permissionsTitle")}
              </div>
            </CardTitle>
            <CardDescription>{t("detail.permissionsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {permissionSlugs.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t("detail.noRoles")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {permissionSlugs.map((slug) => (
                  <Badge key={slug} variant="muted" size="sm">
                    {tPermissions(`slugs.${slug}`)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}