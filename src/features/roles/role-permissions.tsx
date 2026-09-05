"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/search-bar";
import { useToast } from "@/stores/use-toast-store";
import { saveRolePermissionsAction } from "@/features/roles/actions";
import {
  PERMISSIONS_BY_MODULE,
  PERMISSION_MODULES,
} from "@/lib/authorization/permissions";
import type { PermissionInfo } from "@/services/permissions-service";
import type { RoleCard } from "@/lib/authorization/types";

interface RolePermissionsMatrixProps {
  role: RoleCard;
  canUpdate: boolean;
  permissionIds: string[];
  permissions: PermissionInfo[];
}

/** Slugs whose token differs from the catalog module name (audit module). */
const MODULE_ALIAS: Record<string, string> = {
  audit_logs: "audit",
};

export function RolePermissionsMatrix({
  role,
  canUpdate,
  permissionIds,
  permissions,
}: RolePermissionsMatrixProps) {
  const t = useTranslations("permissions");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const slugToId = useMemo(
    () => new Map(permissions.map((p) => [p.slug, p.id])),
    [permissions]
  );

  const initial = useMemo(() => new Set(permissionIds), [permissionIds]);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty =
    selected.size !== initial.size ||
    [...selected].some((id) => !initial.has(id));

  const orphanSlugs = useMemo(
    () =>
      permissions
        .filter(
          (p) =>
            !PERMISSION_MODULES.some((m) =>
              (PERMISSIONS_BY_MODULE[m] as readonly string[]).includes(p.slug)
            )
        )
        .map((p) => p.slug),
    [permissions]
  );

  function slugsFor(module: string): string[] {
    const moduleKey = module as keyof typeof PERMISSIONS_BY_MODULE;
    const base = [...(PERMISSIONS_BY_MODULE[moduleKey] as readonly string[])];
    for (const slug of orphanSlugs) {
      if (MODULE_ALIAS[slug.split(".")[0]] === module && !base.includes(slug)) {
        base.push(slug);
      }
    }
    return base;
  }

  function toggle(slug: string) {
    const id = slugToId.get(slug);
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(module: string) {
    setSelected((prev) => {
      const slugs = slugsFor(module);
      const ids = slugs
        .map((s) => slugToId.get(s))
        .filter((id): id is string => Boolean(id));
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function reset() {
    setSelected(new Set(initial));
  }

  async function save() {
    setBusy(true);
    const result = await saveRolePermissionsAction({
      roleId: role.id,
      permissionIds: [...selected],
    });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("saved") });
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  function matchesQuery(slug: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return slug.toLowerCase().includes(q);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[
          { label: tn("roles"), href: "/roles" },
          { label: role.name },
          { label: t("breadcrumb") },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-sm font-medium text-[var(--color-warning)]">
                {t("unsaved")}
              </span>
            )}
            {canUpdate && (
              <>
                <Button variant="outline" onClick={reset} disabled={!dirty}>
                  {tc("common.cancel")}
                </Button>
                <Button onClick={() => void save()} loading={busy} disabled={!dirty}>
                  {busy ? t("saving") : t("save")}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/roles"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <ShieldCheck className="size-4" aria-hidden />
            {role.name}
          </Link>
          <Badge variant="outline">{role.code}</Badge>
        </div>
        <SearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          containerClassName="sm:w-64"
          onClear={() => setQuery("")}
        />
      </div>

      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t("selectedCount", { count: selected.size })}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {PERMISSION_MODULES.map((module) => {
          const slugs = slugsFor(module);
          const visible = slugs.filter(matchesQuery);
          if (visible.length === 0) return null;

          const ids = slugs
            .map((s) => slugToId.get(s))
            .filter((id): id is string => Boolean(id));
          const allOn = ids.length > 0 && ids.every((id) => selected.has(id));

          return (
            <Card key={module} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--color-border)]">
                <CardTitle className="text-base">{t(`moduleGroups.${module}`)}</CardTitle>
                {canUpdate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleModule(module)}
                  >
                    {allOn ? t("clearAll") : t("selectAll")}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-[var(--color-border)]">
                  {visible.map((slug) => {
                    const id = slugToId.get(slug);
                    const checked = id ? selected.has(id) : false;
                    return (
                      <li key={slug}>
                        <button
                          type="button"
                          disabled={!canUpdate}
                          onClick={() => toggle(slug)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-muted)]/60 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span
                            className={`inline-flex size-4 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                                : "border-[var(--color-border)] bg-transparent"
                            }`}
                            aria-hidden
                          >
                            {checked && <Check className="size-3" />}
                          </span>
                          <span
                            className={`flex-1 text-sm ${
                              checked
                                ? "text-[var(--color-foreground)]"
                                : "text-[var(--color-muted-foreground)]"
                            }`}
                          >
                            {t(`slugs.${slug}`)}
                          </span>
                          <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                            {slug}
                          </code>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}