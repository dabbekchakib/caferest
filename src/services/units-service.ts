import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import type { Unit } from "@/lib/units/types";
import { invalidateUnitsCache } from "./units-cache";

export interface UnitCreateInput {
  name: string;
  symbol: string;
  type: Unit["type"];
  description?: string | null;
  precision?: number;
  isBase?: boolean;
}

export interface UnitUpdateInput {
  name?: string;
  symbol?: string;
  type?: Unit["type"];
  description?: string | null;
  precision?: number;
  isBase?: boolean;
  isActive?: boolean;
}

/** Units visible in an establishment scope (system + own). */
export async function listUnits(
  establishmentId: string
): Promise<Unit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Unit[];
}

export async function getUnit(
  establishmentId: string,
  unitId: string
): Promise<Unit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`)
    .maybeSingle();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data as Unit | null) ?? null;
}

async function assertSymbolAvailable(
  establishmentId: string,
  symbol: string,
  excludingId?: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id")
    .eq("symbol", symbol.trim())
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.id !== excludingId) {
    throw new AuthorizationError("DUPLICATE_UNIT", "duplicate_unit_symbol");
  }
}

export async function createUnit(
  establishmentId: string,
  input: UnitCreateInput
): Promise<Unit> {
  const symbol = input.symbol.trim();
  await assertSymbolAvailable(establishmentId, symbol);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .insert({
      establishment_id: establishmentId,
      name: input.name.trim(),
      symbol,
      slug: slugify(input.name),
      type: input.type,
      description: input.description?.trim() || null,
      precision: input.precision ?? 2,
      is_base: input.isBase ?? false,
      is_system: false,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  invalidateUnitsCache(establishmentId);
  return data as Unit;
}

export async function updateUnit(
  establishmentId: string,
  unitId: string,
  input: UnitUpdateInput
): Promise<Unit> {
  const existing = await getUnit(establishmentId, unitId);
  if (!existing) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
  }
  if (existing.is_system) {
    throw new AuthorizationError(
      "SYSTEM_UNIT_PROTECTED",
      "system_unit_protected"
    );
  }

  if (input.symbol !== undefined) {
    await assertSymbolAvailable(establishmentId, input.symbol, unitId);
  }

  const supabase = await createClient();
  const patch: Record<string, string | number | boolean | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.symbol !== undefined) patch.symbol = input.symbol.trim();
  if (input.type !== undefined) patch.type = input.type;
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.precision !== undefined) patch.precision = input.precision;
  if (input.isBase !== undefined) patch.is_base = input.isBase;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await supabase
    .from("units")
    .update(patch)
    .eq("id", unitId)
    .select("*")
    .single();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  invalidateUnitsCache(establishmentId);
  return data as Unit;
}

export async function deleteUnit(
  establishmentId: string,
  unitId: string
): Promise<void> {
  const existing = await getUnit(establishmentId, unitId);
  if (!existing) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
  }
  if (existing.is_system) {
    throw new AuthorizationError(
      "SYSTEM_UNIT_PROTECTED",
      "system_unit_protected"
    );
  }

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("unit_conversions")
    .select("id", { count: "exact", head: true })
    .or(`from_unit_id.eq.${unitId},to_unit_id.eq.${unitId}`);

  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  if ((count ?? 0) > 0) {
    throw new AuthorizationError("UNIT_IN_USE", "unit_in_use");
  }

  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", unitId)
    .eq("is_system", false);

  if (error) throw new AuthorizationError("GENERIC", error.message);
  invalidateUnitsCache(establishmentId);
}

export async function setUnitStatus(
  establishmentId: string,
  unitId: string,
  isActive: boolean
): Promise<void> {
  const existing = await getUnit(establishmentId, unitId);
  if (!existing) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
  }
  if (existing.is_system) {
    throw new AuthorizationError(
      "SYSTEM_UNIT_PROTECTED",
      "system_unit_protected"
    );
  }
  await updateUnit(establishmentId, unitId, { isActive });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}