"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserRound, UserPlus, Trash2, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { useToast } from "@/stores/use-toast-store";
import {
  inviteUserAction,
  setUserStatusAction,
  deleteUserAction,
} from "@/features/users/actions";
import type { AdminUserView } from "@/lib/authorization/types";
import type { RoleCard } from "@/lib/authorization/types";

interface UsersListProps {
  users: AdminUserView[];
  roles: RoleCard[];
  canInvite: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function UsersList({
  users,
  roles,
  canInvite,
  canUpdate,
  canDelete,
}: UsersListProps) {
  const t = useTranslations("users");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<AdminUserView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserView | null>(null);
  const [busy, setBusy] = useState(false);

  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (r) => r.isActive && r.code !== "super_admin"
      ),
    [roles]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const haystack = `${u.email} ${u.fullName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (status === "active" && !u.isActive) return false;
      if (status === "inactive" && u.isActive) return false;
      if (roleFilter !== "all" && !u.roleCodes.includes(roleFilter)) return false;
      return true;
    });
  }, [users, query, status, roleFilter]);

  async function handleInvite(input: { email: string; roleId: string }) {
    setBusy(true);
    const result = await inviteUserAction(input);
    setBusy(false);
    if (result.ok) {
      setInviteOpen(false);
      toast.success({ title: t("invite.success"), description: result.data.email });
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  async function handleToggleStatus(user: AdminUserView) {
    setBusy(true);
    const result = await setUserStatusAction({
      userId: user.id,
      isActive: !user.isActive,
    });
    setBusy(false);
    setStatusTarget(null);
    if (result.ok) {
      toast.success({
        title: user.isActive ? t("actions.deactivate") : t("actions.activate"),
      });
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  async function handleDelete(user: AdminUserView) {
    setBusy(true);
    const result = await deleteUserAction({ userId: user.id });
    setBusy(false);
    setDeleteTarget(null);
    if (result.ok) {
      toast.success({ title: t("actions.delete") });
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  const columns: Column<AdminUserView>[] = [
    {
      key: "user",
      header: t("table.user"),
      accessor: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <UserRound className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {user.fullName || user.email}
            </span>
            <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
              {user.email}
            </span>
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (u) => u.fullName ?? u.email,
    },
    {
      key: "roles",
      header: t("table.roles"),
      accessor: (user) =>
        user.roleCodes.length === 0 ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {user.roleCodes.slice(0, 3).map((code) => (
              <Badge key={code} variant="outline" size="sm">
                {code}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (user) =>
        user.isActive ? (
          <Badge variant="success" size="sm" dot>
            {t("status.active")}
          </Badge>
        ) : user.invited ? (
          <Badge variant="warning" size="sm" dot>
            {t("status.invited")}
          </Badge>
        ) : (
          <Badge variant="danger" size="sm" dot>
            {t("status.inactive")}
          </Badge>
        ),
      sortable: true,
      sortValue: (u) => (u.isActive ? 1 : 0),
    },
    {
      key: "joined",
      header: t("table.joined"),
      accessor: (user) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
      hideOnMobile: true,
      sortable: true,
      sortValue: (u) => u.createdAt,
    },
    {
      key: "actions",
      header: t("table.actions"),
      accessor: (user) => (
        <div className="flex items-center gap-0.5">
          <Link
            href={`/users/${user.id}`}
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            aria-label={t("actions.view")}
          >
            <Eye className="size-4" aria-hidden />
          </Link>
          {canUpdate && (
            <button
              type="button"
              onClick={() => setStatusTarget(user)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={t(
                user.isActive ? "actions.deactivate" : "actions.activate"
              )}
            >
              {user.isActive ? (
                <span className="size-4 rounded-sm border-2 border-current" />
              ) : (
                <span className="size-3.5 rounded-full border-2 border-current bg-current/20" />
              )}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteTarget(user)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
              aria-label={t("actions.delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tn("users") }]}
        actions={
          canInvite ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" aria-hidden /> {t("inviteButton")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          containerClassName="lg:max-w-sm"
          onClear={() => setQuery("")}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="w-36"
            aria-label={t("filters.status")}
          >
            <option value="all">{t("filters.all")}</option>
            <option value="active">{t("filters.active")}</option>
            <option value="inactive">{t("filters.inactive")}</option>
          </Select>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-44"
            aria-label={t("filters.role")}
          >
            <option value="all">{t("filters.all")}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(u) => u.id}
        emptyState={
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium">{t("empty.title")}</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {t("empty.description")}
            </p>
          </div>
        }
      />

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={assignableRoles}
        onSubmit={(input) => void handleInvite(input)}
        busy={busy}
      />

      <Dialog
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={t(
          statusTarget?.isActive
            ? "deactivateDialog.title"
            : "activateDialog.title"
        )}
        description={t(
          statusTarget?.isActive
            ? "deactivateDialog.description"
            : "activateDialog.description"
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={statusTarget?.isActive ? "danger" : "success"}
              onClick={() => statusTarget && void handleToggleStatus(statusTarget)}
              loading={busy}
            >
              {t(
                statusTarget?.isActive
                  ? "deactivateDialog.confirm"
                  : "activateDialog.confirm"
              )}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {statusTarget?.email}
        </p>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description")}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
              loading={busy}
            >
              {t("deleteDialog.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {deleteTarget?.email}
        </p>
      </Dialog>
    </div>
  );
}

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleCard[];
  onSubmit: (input: { email: string; roleId: string }) => void;
  busy: boolean;
}

function InviteDialog({
  open,
  onOpenChange,
  roles,
  onSubmit,
  busy,
}: InviteDialogProps) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const tValidation = useTranslations("validation");

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = tValidation("required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = tValidation("invalidEmail");
    if (!roleId) errs.roleId = tValidation("required");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ email, roleId });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("invite.title")}
      description={t("invite.description")}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("common.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {busy ? t("invite.submitting") : t("invite.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label={t("invite.email")}
          htmlFor="invite-email"
          required
          error={errors.email}
        >
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("invite.emailPlaceholder")}
          />
        </Field>
        <Field label={t("invite.role")} htmlFor="invite-role" required error={errors.roleId}>
          <Select
            id="invite-role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            {roles.length === 0 ? (
              <option value="">—</option>
            ) : (
              roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))
            )}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}