"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Pencil,
  Power,
  Trash2,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  deleteCategoryAction,
  moveCategoryAction,
  reorderCategoriesAction,
  setCategoryStatusAction,
} from "@/features/categories/actions";
import {
  CategoryParentSelect,
  toParentPickerEntries,
} from "./category-parent-select";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import { resolveCategoryName } from "@/lib/categories/translations";
import { getCategoryIcon } from "@/lib/categories/icons";
import { collectSubtreeIds } from "@/lib/categories/tree";

interface CategoryListProps {
  categories: CategoryWithTranslations[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReorder: boolean;
}

interface FlatEntry {
  node: CategoryWithTranslations;
  depth: number;
  path: string;
}

function bySort(a: CategoryWithTranslations, b: CategoryWithTranslations) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

function buildFlat(
  categories: CategoryWithTranslations[],
  locale: string
): FlatEntry[] {
  const out: FlatEntry[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    const children = categories
      .filter((c) => c.parent_id === parentId)
      .sort(bySort);
    for (const c of children) {
      const label = resolveCategoryName(c.name, c.translations, locale);
      const path = prefix === "" ? label : `${prefix} / ${label}`;
      out.push({ node: c, depth, path });
      walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

function resolveAllNames(c: CategoryWithTranslations): string[] {
  const names = [c.name];
  for (const locale of ["fr", "en", "ar"] as const) {
    const name = c.translations[locale]?.name;
    if (name) names.push(name);
  }
  return names;
}

export function CategoryList({
  categories,
  canCreate,
  canUpdate,
  canDelete,
  canReorder,
}: CategoryListProps) {
  const t = useTranslations("categories");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithTranslations | null>(null);
  const [moveTarget, setMoveTarget] = useState<CategoryWithTranslations | null>(null);
  const [moveParent, setMoveParent] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<CategoryWithTranslations | null>(null);
  const [busy, setBusy] = useState(false);

  const flat = useMemo(
    () => buildFlat(categories, locale),
    [categories, locale]
  );

  const parentEntries = useMemo(
    () => toParentPickerEntries(categories, locale),
    [categories, locale]
  );

  const moveExcludeIds = useMemo(() => {
    if (!moveTarget) return new Set<string>();
    return collectSubtreeIds(categories, moveTarget.id);
  }, [categories, moveTarget]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flat.filter((entry) => {
      if (statusFilter === "active" && !entry.node.is_active) return false;
      if (statusFilter === "inactive" && entry.node.is_active) return false;
      if (!q) return true;
      const hay = [
        ...resolveAllNames(entry.node),
        entry.node.slug,
        entry.path,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [flat, query, statusFilter]);

  const siblingIds = (node: CategoryWithTranslations) =>
    categories
      .filter((c) => c.parent_id === node.parent_id)
      .sort(bySort)
      .map((c) => c.id);

  async function run(action: () => Promise<unknown>, successTitle: string) {
    setBusy(true);
    const result = (await action()) as { ok: boolean; key?: string };
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setDeleteTarget(null);
      setMoveTarget(null);
      setStatusTarget(null);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  const treeRows = (() => {
    const renderNode = (
      node: CategoryWithTranslations,
      depth: number
    ): ReactNode[] => {
      const children = categories
        .filter((c) => c.parent_id === node.id)
        .sort(bySort);
      const hasChildren = children.length > 0;
      const isOpen = expanded[node.id] ?? false;
      const Icon = getCategoryIcon(node.icon);
      const siblings = siblingIds(node);
      const index = siblings.indexOf(node.id);
      const label = resolveCategoryName(node.name, node.translations, locale);

      return [
        <div
          key={node.id}
          className="group flex items-center gap-2 border-b border-[var(--color-border)] py-2.5 last:border-0"
          style={{ paddingInlineStart: depth * 28 + 4 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [node.id]: !prev[node.id] }))
              }
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-expanded={isOpen}
              aria-label={isOpen ? t("tree.collapse") : t("tree.expand")}
            >
              {isOpen ? (
                <ChevronDown className="size-4" aria-hidden />
              ) : (
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              )}
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden />
          )}
          <Icon
            className="size-4 shrink-0"
            style={node.color ? { color: node.color } : undefined}
            aria-hidden
          />
          <div className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{label}</span>
              {node.is_system && (
                <Badge variant="primary" size="sm">
                  {t("badges.system")}
                </Badge>
              )}
              {!node.is_active && (
                <Badge variant="danger" size="sm" dot>
                  {t("badges.inactive")}
                </Badge>
              )}
              {hasChildren && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {t("tree.children", { count: children.length })}
                </span>
              )}
            </span>
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              {node.slug}
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {canReorder && siblings.length > 1 && !node.is_system && (
              <>
                <button
                  type="button"
                  aria-label={t("actions.moveUp")}
                  disabled={index === 0}
                  onClick={() => {
                    const ids = siblings.slice();
                    const target = ids[index];
                    ids[index] = ids[index - 1];
                    ids[index - 1] = target;
                    void run(
                      () =>
                        reorderCategoriesAction({
                          parentId: node.parent_id,
                          orderedIds: ids,
                        }),
                      t("updateSuccess")
                    );
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("actions.moveDown")}
                  disabled={index === siblings.length - 1}
                  onClick={() => {
                    const ids = siblings.slice();
                    const target = ids[index];
                    ids[index] = ids[index + 1];
                    ids[index + 1] = target;
                    void run(
                      () =>
                        reorderCategoriesAction({
                          parentId: node.parent_id,
                          orderedIds: ids,
                        }),
                      t("updateSuccess")
                    );
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </>
            )}
            {canCreate && (
              <Link
                href={`/categories/create?parentId=${node.id}`}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("actions.addSubcategory")}
              >
                <FolderPlus className="size-4" aria-hidden />
              </Link>
            )}
            {canUpdate && !node.is_system && (
              <>
                <button
                  type="button"
                  onClick={() => setStatusTarget(node)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("actions.toggleStatus")}
                >
                  <Power className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoveParent(node.parent_id);
                    setMoveTarget(node);
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("actions.move")}
                >
                  <ArrowRightLeft className="size-4" aria-hidden />
                </button>
                <Link
                  href={`/categories/${node.id}/edit`}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("actions.edit")}
                >
                  <Pencil className="size-4" aria-hidden />
                </Link>
              </>
            )}
            {canDelete && !node.is_system && (
              <button
                type="button"
                onClick={() => setDeleteTarget(node)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
                aria-label={t("actions.delete")}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>,
        ...(isOpen ? children.map((c) => renderNode(c, depth + 1)) : []),
      ];
    };

    return categories
      .filter((c) => c.parent_id === null)
      .sort(bySort)
      .map((root) => renderNode(root, 0));
  })();

  const columns: Column<FlatEntry>[] = [
    {
      key: "category",
      header: t("table.category"),
      accessor: (entry) => {
        const Icon = getCategoryIcon(entry.node.icon);
        const label = resolveCategoryName(
          entry.node.name,
          entry.node.translations,
          locale
        );
        return (
          <div className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon
                className="size-4"
                style={entry.node.color ? { color: entry.node.color } : undefined}
                aria-hidden
              />
              <span className="truncate">{label}</span>
              {entry.node.is_system && (
                <Badge variant="primary" size="sm">
                  {t("badges.system")}
                </Badge>
              )}
            </span>
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              {entry.node.slug}
            </span>
          </div>
        );
      },
      sortable: true,
      sortValue: (e) => e.path,
    },
    {
      key: "parent",
      header: t("table.parent"),
      accessor: (entry) =>
        entry.depth === 0 ? (
          <span className="text-sm text-[var(--color-muted-foreground)]">—</span>
        ) : (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {entry.path.split(" / ").slice(0, -1).join(" / ")}
          </span>
        ),
      hideOnMobile: true,
    },
    {
      key: "children",
      header: t("table.children"),
      accessor: (entry) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {categories.filter((c) => c.parent_id === entry.node.id).length}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (entry) =>
        entry.node.is_active ? (
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
      accessor: (entry) => {
        const node = entry.node;
        return (
          <div className="flex items-center gap-0.5">
            {canUpdate && !node.is_system && (
              <>
                <button
                  type="button"
                  onClick={() => setStatusTarget(node)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("actions.toggleStatus")}
                >
                  <Power className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoveParent(node.parent_id);
                    setMoveTarget(node);
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("actions.move")}
                >
                  <ArrowRightLeft className="size-4" aria-hidden />
                </button>
                <Link
                  href={`/categories/${node.id}/edit`}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("actions.edit")}
                >
                  <Pencil className="size-4" aria-hidden />
                </Link>
              </>
            )}
            {canDelete && !node.is_system && (
              <button
                type="button"
                onClick={() => setDeleteTarget(node)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
                aria-label={t("actions.delete")}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const hasSearch = query.trim() !== "";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tn("categories") }]}
        actions={
          canCreate ? (
            <Link href="/categories/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("createButton")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title={t("noCategories")}
          action={
            canCreate ? (
              <Link href="/categories/create">
                <Button>
                  <Plus className="size-4" aria-hidden /> {t("createButton")}
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <SearchBar
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery("")}
                placeholder={t("searchPlaceholder")}
                className="sm:max-w-sm"
              />
              <Select
                aria-label={t("table.status")}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "active" | "inactive")
                }
                className="sm:w-40"
              >
                <option value="all">{t("statusFilterAll")}</option>
                <option value="active">{t("statusActive")}</option>
                <option value="inactive">{t("statusInactive")}</option>
              </Select>
            </div>
            <span className="text-sm text-[var(--color-muted-foreground)]">
              {t("totalCount", { count: categories.length })}
            </span>
          </div>

          <Tabs defaultValue="tree">
            <TabsList>
              <TabsTrigger value="tree">{t("viewTree")}</TabsTrigger>
              <TabsTrigger value="table">{t("viewTable")}</TabsTrigger>
            </TabsList>
            <TabsContent value="tree">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
                  {t("noResults")}
                </div>
              ) : hasSearch ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shadow-sm">
                  {filtered.map((entry) => (
                    <div
                      key={entry.node.id}
                      className="flex items-center gap-2 border-b border-[var(--color-border)] py-2.5 last:border-0"
                      style={{ paddingInlineStart: entry.depth * 28 + 4 }}
                    >
                      <span className="text-sm text-[var(--color-muted-foreground)]">
                        {entry.path}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shadow-sm">
                  {treeRows}
                </div>
              )}
            </TabsContent>
            <TabsContent value="table">
              <DataTable
                columns={columns}
                data={filtered}
                rowKey={(e) => e.node.id}
                striped
                emptyState={
                  <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                    {t("noResults")}
                  </div>
                }
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={t(
          statusTarget?.is_active ? "actions.deactivate" : "actions.activate"
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={statusTarget?.is_active ? "danger" : "success"}
              loading={busy}
              onClick={() =>
                statusTarget &&
                void run(
                  () =>
                    setCategoryStatusAction({
                      categoryId: statusTarget.id,
                      isActive: !statusTarget.is_active,
                    }),
                  t("updateSuccess")
                )
              }
            >
              {t("confirmDelete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {statusTarget &&
            resolveCategoryName(
              statusTarget.name,
              statusTarget.translations,
              locale
            )}
        </p>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
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
                  () => deleteCategoryAction({ categoryId: deleteTarget.id }),
                  t("deleteSuccess")
                )
              }
            >
              {t("deleteButton")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {deleteTarget &&
            resolveCategoryName(
              deleteTarget.name,
              deleteTarget.translations,
              locale
            )}
        </p>
      </Dialog>

      <Dialog
        open={moveTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setMoveTarget(null);
            setMoveParent(null);
          }
        }}
        title={t("moveDialog.title")}
        description={t("moveDialog.description")}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setMoveTarget(null);
                setMoveParent(null);
              }}
            >
              {tc("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                moveTarget &&
                void run(
                  () =>
                    moveCategoryAction({
                      categoryId: moveTarget.id,
                      parentId: moveParent,
                    }),
                  t("updateSuccess")
                )
              }
            >
              {t("confirmMove")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {moveTarget &&
              resolveCategoryName(
                moveTarget.name,
                moveTarget.translations,
                locale
              )}
          </p>
          <CategoryParentSelect
            entries={parentEntries}
            value={moveParent}
            onChange={setMoveParent}
            excludeIds={moveExcludeIds}
          />
        </div>
      </Dialog>
    </div>
  );
}