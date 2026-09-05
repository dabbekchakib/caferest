import { slugify, isValidSlug } from "../categories/slug";

export { slugify, isValidSlug };

/**
 * Returns `base` when it is free, otherwise `base-2`, `base-3`, …
 * Deterministic collision policy for ingredient slugs (multi-establishment
 * aware: callers check availability within one establishment).
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set<string>();
  for (const s of taken) set.add(s.trim().toLowerCase());
  if (!set.has(base)) return base;

  let n = 2;
  while (set.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}