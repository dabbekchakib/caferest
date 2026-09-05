"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, ShieldCheck, Copy, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/stores/use-toast-store";
import {
  createRoleAction,
  updateRoleAction,
  duplicateRoleAction,
  setRoleStatusAction,
  deleteRoleAction,
} from "@/features/roles/actions";
import type { RoleCard } from "@/lib/authorization/types";

interface RolesListProps {
  roles: RoleCard[];
  establishmentId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

type EditorMode = "create" | "edit" | "duplicate";

interface EditorState {
  mode: EditorMode;
  role: RoleCard | null;
}

export function RolesList({
  roles,
  canCreate,
  canUpdate,
  canDelete,
}: RolesListProps) {
  const t = useTranslations("roles");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [statusTarget, setStatusTarget] = useState<RoleCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleCard | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(
    action: () => Promise<unknown>,
    successTitle: string
  ) {
    setBusy(true);
    const result = (await action()) as
      | { ok: true }
      | { ok: false; key: string };
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setEditor(null);
      setStatusTarget(null);
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  const columns: Column<RoleCard>[] = [
    {
      key: "role",
      header: t("table.role"),
      accessor: (role) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {role.name}
          </span>
          <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
            {role.description}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.name,
    },
    {
      key: "code",
      header: t("table.code"),
      accessor: (role) => (
        <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs">
          {role.code}
        </code>
      ),
    },
    {
      key: "type",
      header: "",
      accessor: (role) =>
        role.isSystem ? (
          <Badge variant="primary" size="sm">
            {t("badges.system")}
          </Badge>
        ) : (
          <Badge variant="accent" size="sm">
            {t("badges.custom")}
          </Badge>
        ),
    },
    {
      key: "level",
      header: t("table.level"),
      accessor: (role) => (
        <span className="text-sm font-medium">{role.level}</span>
      ),
      sortable: true,
      sortValue: (r) => r.level,
    },
    {
      key: "permissions",
      header: t("table.permissions"),
      accessor: (role) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {t("permissionsCount", { count: role.permissionCount })}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "users",
      header: t("table.users"),
      accessor: (role) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {t("usersCount", { count: role.userCount })}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (role) =>
        role.isActive ? (
          <Badge variant="success" size="sm" dot>
            {t("badges.active")}
          </Badge>
        ) : (
          <Badge variant="danger" size="sm" dot>
            {t("badges.inactive")}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: t("table.actions"),
      accessor: (role) => (
        <div className="flex items-center gap-0.5">
          <Link
            href={`/roles/${role.id}/permissions`}
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            aria-label={t("actions.permissions")}
          >
            <ShieldCheck className="size-4" aria-hidden />
          </Link>
          {canUpdate && !role.isSystem && (
            <button
              type="button"
              onClick={() => setEditor({ mode: "edit", role })}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={t("actions.edit")}
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setEditor({ mode: "duplicate", role })}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={t("actions.duplicate")}
            >
              <Copy className="size-4" aria-hidden />
            </button>
          )}
          {canDelete && !role.isSystem && (
            <button
              type="button"
              onClick={() => setDeleteTarget(role)}
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
        breadcrumbs={[{ label: tn("roles") }]}
        actions={
          canCreate ? (
            <Button onClick={() => setEditor({ mode: "create", role: null })}>
              <Plus className="size-4" aria-hidden /> {t("createButton")}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={roles}
        rowKey={(r) => r.id}
        striped
      />

      {editor && (
        <RoleFormDialog
          mode={editor.mode}
          role={editor.role}
          busy={busy}
          onClose={() => !busy && setEditor(null)}
          onSubmit={(input) => {
            if (!editor) return;
            const mode = editor.mode;
            const role = editor.role;
            if (mode === "create") {
              return run(
                () =>
                  createRoleAction({
                    name: input.name,
                    code: input.code,
                    description: input.description ?? undefined,
                    level: input.level,
                  }),
                t("createSuccess")
              );
            }
            if (mode === "edit" && role) {
              return run(
                () =>
                  updateRoleAction({
                    roleId: role.id,
                    name: input.name,
                    description: input.description ?? undefined,
                    level: input.level,
                    isActive: input.isActive,
                  }),
                t("updateSuccess")
              );
            }
            if (mode === "duplicate" && role) {
              return run(
                () =>
                  duplicateRoleAction({
                    sourceRoleId: role.id,
                    name: input.name,
                    code: input.code,
                  }),
                t("createSuccess")
              );
            }
          }}
        />
      )}

      <Dialog
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={t(
          statusTarget?.isActive
            ? "toggleDialog.deactivateTitle"
            : "toggleDialog.activateTitle"
        )}
        description={
          statusTarget?.isActive
            ? t("toggleDialog.deactivateDescription")
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={statusTarget?.isActive ? "danger" : "success"}
              loading={busy}
              onClick={() =>
                statusTarget &&
                void run(
                  () =>
                    setRoleStatusAction({
                      roleId: statusTarget.id,
                      isActive: !statusTarget.isActive,
                    }),
                  t(
                    statusTarget.isActive
                      ? "toggleDialog.deactivateTitle"
                      : "toggleDialog.activateTitle"
                  )
                )
              }
            >
              {t("toggleDialog.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {statusTarget?.name}
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
              loading={busy}
              onClick={() =>
                deleteTarget &&
                void run(
                  () => deleteRoleAction({ roleId: deleteTarget.id }),
                  t("actions.delete")
                )
              }
            >
              {t("deleteDialog.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {deleteTarget?.name}
        </p>
      </Dialog>
    </div>
  );
}

interface RoleFormDialogProps {
  mode: EditorMode;
  role: RoleCard | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: RoleFormInput) => void;
}

export interface RoleFormInput {
  name: string;
  code: string;
  description?: string | null;
  level?: number;
  isActive?: boolean;
}

function RoleFormDialog({
  mode,
  role,
  busy,
  onClose,
  onSubmit,
}: RoleFormDialogProps) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");

  const [name, setName] = useState(role?.name ?? "");
  const [code, setCode] = useState(role?.code.slice(0, 30) ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [level, setLevel] = useState(String(role?.level ?? 10));
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const title =
    mode === "create"
      ? t("createTitle")
      : mode === "duplicate"
      ? t("duplicateTitle")
      : t("editTitle");

  function submit() {
    const errs: Record<string, string> = {};
    if (mode !== "edit" && !name.trim()) errs.name = tc("common.required");
    if (mode !== "edit" && !/^[a-z][a-z0-9_]*$/.test(code)) errs.code = tc("common.invalid");
    const levelNum = Number(level);
    if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 99)
      errs.level = tc("common.invalid");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      name: name.trim(),
      code: code.trim(),
      description: description.trim() === "" ? null : description.trim(),
      ...(mode !== "duplicate" ? { level: levelNum } : {}),
      ...(mode === "edit" ? { isActive } : {}),
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("common.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {tc("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("fields.name")} htmlFor="role-name" required error={errors.name}>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fields.namePlaceholder")}
          />
        </Field>
        <Field
          label={t("fields.code")}
          htmlFor="role-code"
          required
          error={errors.code}
          helpText={t("fields.codeHint")}
        >
          <Input
            id="role-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("fields.codePlaceholder")}
          />
        </Field>
        <Field
          label={t("fields.level")}
          htmlFor="role-level"
          required
          error={errors.level}
          helpText={t("fields.levelHint")}
        >
          <Input
            id="role-level"
            type="number"
            min={1}
            max={99}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </Field>
        <Field label={t("fields.description")} htmlFor="role-description">
          <Textarea
            id="role-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("fields.descriptionPlaceholder")}
            rows={3}
          />
        </Field>
        {mode === "edit" && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("fields.isActive")}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        )}
      </div>
    </Dialog>
  );
}