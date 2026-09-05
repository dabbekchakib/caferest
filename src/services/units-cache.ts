import { createClient } from "@/lib/supabase/server";
import type {
  Unit,
  UnitConversion,
  UnitCatalog,
} from "@/lib/units/types";

const TTL_MS = 60_000;

interface ScopeCache {
  units: { data: Unit[]; expiry: number } | null;
  conversions: { data: UnitConversion[]; expiry: number } | null;
}

const cache = new Map<string, ScopeCache>();

function fresh<T>(entry: { data: T; expiry: number } | null): entry is {
  data: T;
  expiry: number;
} {
  return entry !== null && entry.expiry > Date.now();
}

/**
 * Lightweight in-memory catalog cache keyed by establishment scope.
 * Invalidation is explicit on every mutation; a single process instance serves
 * one request/response cycle, so Map mutations never cross user sessions in a
 * way that leaks data (an establishment key can only be resolved through RLS).
 */
export async function getUnitsCached(
  establishmentId: string
): Promise<Unit[]> {
  const entry = cache.get(establishmentId);
  if (entry && fresh(entry.units)) return entry.units.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  const units = (data ?? []) as Unit[];
  cache.set(establishmentId, {
    units: { data: units, expiry: Date.now() + TTL_MS },
    conversions: cache.get(establishmentId)?.conversions ?? null,
  });
  return units;
}

export async function getConversionsCached(
  establishmentId: string
): Promise<UnitConversion[]> {
  const entry = cache.get(establishmentId);
  if (entry && fresh(entry.conversions)) return entry.conversions.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_conversions")
    .select("*")
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`);

  if (error) throw error;
  const conversions = (data ?? []) as UnitConversion[];
  cache.set(establishmentId, {
    units: cache.get(establishmentId)?.units ?? null,
    conversions: { data: conversions, expiry: Date.now() + TTL_MS },
  });
  return conversions;
}

export async function getCatalogCached(
  establishmentId: string
): Promise<UnitCatalog> {
  const [units, conversions] = await Promise.all([
    getUnitsCached(establishmentId),
    getConversionsCached(establishmentId),
  ]);
  return { units, conversions };
}

/** Call after any unit/conversion mutation so consumers see fresh data. */
export function invalidateUnitsCache(establishmentId: string): void {
  cache.delete(establishmentId);
}