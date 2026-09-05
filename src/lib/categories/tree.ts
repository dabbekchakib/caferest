import type { CategoryLike } from "./types";

/**
 * Pure tree helpers for the category hierarchy (no I/O, unit-testable).
 *
 * A category tree is built from a flat, per-establishment list. Cycles are
 * impossible in practice (DB trigger + service pre-check), so builds/descendant
 * scans terminate on `parent_id = null` or a missing parent.
 */

/**
 * Build a forest from a flat list, children sorted by (sort_order, name).
 */
export function buildTree<T extends CategoryLike>(
  categories: T[]
): Array<
  { node: T; children: ReturnType<typeof buildTree<T>> }
> {
  const byId = new Map<string, T>();
  for (const c of categories) byId.set(c.id, c);

  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const c of categories) {
    if (c.parent_id && byId.has(c.parent_id)) {
      const list = childrenOf.get(c.parent_id) ?? [];
      list.push(c);
      childrenOf.set(c.parent_id, list);
    } else {
      roots.push(c);
    }
  }

  const bySort = (a: T, b: T) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name);

  const walk = (parentId: string | null): ReturnType<typeof buildTree<T>> => {
    const list = parentId === null ? roots : childrenOf.get(parentId) ?? [];
    return [...list].sort(bySort).map((c) => ({
      node: c,
      children: walk(c.id),
    }));
  };

  return walk(null);
}

/**
 * Flatten a forest in reading order, with depth and a breadcrumb `path`
 * (names joined with the separator), e.g. for the parent picker or table view.
 */
export function flattenTree<T extends CategoryLike>(
  nodes: Array<{ node: T; children: ReturnType<typeof buildTree<T>> }>,
  separator = " / "
): Array<{ node: T; depth: number; path: string }> {
  const out: Array<{ node: T; depth: number; path: string }> = [];
  const walk = (
    list: Array<{ node: T; children: ReturnType<typeof buildTree<T>> }>,
    depth: number,
    prefix: string
  ) => {
    for (const branch of list) {
      const path =
        prefix === "" ? branch.node.name : `${prefix}${separator}${branch.node.name}`;
      out.push({ node: branch.node, depth, path });
      walk(branch.children, depth + 1, path);
    }
  };
  walk(nodes, 0, "");
  return out;
}

/**
 * All ids of the subtree rooted at `categoryId` (including itself).
 * Returns the ids when found, otherwise an empty set (safe default).
 */
export function collectSubtreeIds<T extends CategoryLike>(
  categories: T[],
  categoryId: string
): Set<string> {
  const byId = new Map<string, T>();
  for (const c of categories) byId.set(c.id, c);

  const ids = new Set<string>();
  const visit = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const c of categories) {
      if (c.parent_id === id) visit(c.id);
    }
  };
  if (byId.has(categoryId)) visit(categoryId);
  return ids;
}

/** All direct child ids of a category (empty when none). */
export function findChildren<T extends CategoryLike>(
  categories: T[],
  categoryId: string
): T[] {
  return categories.filter((c) => c.parent_id === categoryId);
}

/**
 * True when `newParentId` sits inside the subtree rooted at `categoryId`
 * (or equals it) — i.e. assigning it as parent would create a cycle.
 */
export function wouldCreateCycle<T extends CategoryLike>(
  categories: T[],
  categoryId: string,
  newParentId: string | null
): boolean {
  if (!newParentId) return false;
  if (newParentId === categoryId) return true;
  return collectSubtreeIds(categories, categoryId).has(newParentId);
}

/**
 * The breadcrumb path of a category within the forest (for messages/reviews).
 */
export function pathOfCategory<T extends CategoryLike>(
  categories: T[],
  categoryId: string,
  separator = " / "
): string | null {
  const byId = new Map<string, T>();
  for (const c of categories) byId.set(c.id, c);
  if (!byId.has(categoryId)) return null;

  const chain: T[] = [];
  let current: T | undefined = byId.get(categoryId);
  while (current) {
    if (chain.some((c) => c.id === current!.id)) break; // safety (no trusted cycles)
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return chain.map((c) => c.name).join(separator);
}

/**
 * Next sort step for a new/inserted category inside a sibling group:
 * max(sort_order) + 10, or 10 for an empty group.
 */
export function nextSortOrder<T extends CategoryLike>(
  categories: T[],
  parentId: string | null
): number {
  const siblings = categories.filter((c) => c.parent_id === parentId);
  const max = siblings.reduce((m, c) => Math.max(m, c.sort_order), 0);
  return max + 10;
}