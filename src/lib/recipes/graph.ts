// NOTE: relative imports keep the pure engines runnable under `node --test`
// (the test build does not resolve `@/` aliases at runtime).
import { MAX_SUBRECIPE_DEPTH } from "./constants";

/**
 * Sub-recipe directed adjacency: parent recipe -> sub-recipe ids it uses.
 * Built from the `recipe_items` rows that carry a `sub_recipe_id`.
 */
export type SubRecipeAdjacency = ReadonlyMap<string, readonly string[]>;

export function subRecipeAdjacency(
  edges: ReadonlyArray<{ recipeId: string; subRecipeId: string }>
): SubRecipeAdjacency {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.recipeId) ?? [];
    list.push(edge.subRecipeId);
    adjacency.set(edge.recipeId, list);
  }
  return adjacency;
}

/**
 * BFS reachability used for cycle detection. Answers "can `toId` be reached
 * starting from `fromId` in the sub-recipe graph?".
 *
 * Cycle-safe (visited set) and depth-capped (`MAX_SUBRECIPE_DEPTH`), so a
 * pathological deep chain can never cause unbounded work nor an infinite loop.
 */
export function isSubRecipeReachable(
  adjacency: SubRecipeAdjacency,
  fromId: string,
  toId: string,
  maxDepth: number = MAX_SUBRECIPE_DEPTH
): boolean {
  if (fromId === toId) return true;
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: fromId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    for (const next of adjacency.get(id) ?? []) {
      if (next === toId) return true;
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, depth: depth + 1 });
    }
  }

  return false;
}

/**
 * True when adding `subRecipeId` as a child of `recipeId` would create a cycle
 * (i.e. the sub-recipe already depends — transitively — on `recipeId`).
 */
export function wouldCreateSubRecipeCycle(
  adjacency: SubRecipeAdjacency,
  recipeId: string,
  subRecipeId: string
): boolean {
  return isSubRecipeReachable(adjacency, subRecipeId, recipeId);
}