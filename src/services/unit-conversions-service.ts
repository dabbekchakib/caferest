import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import type {
  Unit,
  UnitConversion,
} from "@/lib/units/types";
import { hasConversion } from "@/lib/units/conversions";
import { invalidateUnitsCache } from "./units-cache";

interface UnitRef {
  id: string;
  establishment_id: string | null;
}

export interface UnitConversionCreateInput {
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  offset?: number;
}

export interface UnitConversionUpdateInput {
  from_unit_id?: string;
  to_unit_id?: string;
  factor?: number;
  offset?: number;
  is_active?: boolean;
}

/** Conversions and the units they reference, for an establishment scope. */
interface ConversionWithUnits extends UnitConversion {
  fromUnit?: Pick<Unit, "id" | "symbol" | "name" | "type"> | null;
  toUnit?: Pick<Unit, "id" | "symbol" | "name" | "type"> | null;
}

export async function listConversions(
  establishmentId: string
): Promise<ConversionWithUnits[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_conversions")
    .select(
      `id, establishment_id, from_unit_id, to_unit_id, factor, offset_value, is_system, is_active, created_at, updated_at,
       fromUnit:units!unit_conversions_from_unit_id_fkey(id, symbol, name, type),
       toUnit:units!unit_conversions_to_unit_id_fkey(id, symbol, name, type)`
    )
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`)
    .order("created_at", { ascending: true });

  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as unknown as ConversionWithUnits[];
}

async function resolveUnitRefs(
  establishmentId: string,
  fromUnitId: string,
  toUnitId: string
): Promise<{ from: UnitRef; to: UnitRef }> {
  const supabase = await createClient();
  const ids = [fromUnitId, toUnitId];

  const { data, error } = await supabase
    .from("units")
    .select("id, establishment_id")
    .in("id", ids)
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`);

  if (error) throw new AuthorizationError("GENERIC", error.message);
  const rows = (data ?? []) as UnitRef[];
  const from = rows.find((r) => r.id === fromUnitId);
  const to = rows.find((r) => r.id === toUnitId);

  if (!from || !to) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
  }
  return { from, to };
}

async function assertScopes(
  establishmentId: string,
  from: UnitRef,
  to: UnitRef
): Promise<void> {
  const validFrom = from.establishment_id === null || from.establishment_id === establishmentId;
  const validTo = to.establishment_id === null || to.establishment_id === establishmentId;
  if (!validFrom || !validTo) {
    throw new AuthorizationError("UNIT_SCOPE", "unit_conversion_scope_mismatch");
  }
}

export async function createConversion(
  establishmentId: string,
  input: UnitConversionCreateInput
): Promise<UnitConversion> {
  if (input.from_unit_id === input.to_unit_id) {
    throw new AuthorizationError("GENERIC", "unit_conversion_same_unit");
  }

  const { from, to } = await resolveUnitRefs(
    establishmentId,
    input.from_unit_id,
    input.to_unit_id
  );
  await assertScopes(establishmentId, from, to);

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("unit_conversions")
    .select("id, from_unit_id, to_unit_id, is_system")
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`);

  if (existingError) throw new AuthorizationError("GENERIC", existingError.message);
  const existingRows = (existing ?? []) as unknown as Array<
    Pick<UnitConversion, "id" | "from_unit_id" | "to_unit_id" | "is_system">
  >;
  if (hasConversion(input.from_unit_id, input.to_unit_id, existingRows)) {
    throw new AuthorizationError("GENERIC", "unit_conversion_exists");
  }

  const factor = Number(input.factor);
  const offsetValue = Number(input.offset ?? 0);

  const { data, error } = await supabase
    .from("unit_conversions")
    .insert({
      establishment_id: establishmentId,
      from_unit_id: input.from_unit_id,
      to_unit_id: input.to_unit_id,
      factor,
      offset_value: offsetValue,
      is_system: false,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  invalidateUnitsCache(establishmentId);
  return data as UnitConversion;
}

export async function updateConversion(
  establishmentId: string,
  conversionId: string,
  input: UnitConversionUpdateInput
): Promise<UnitConversion> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("unit_conversions")
    .select("*")
    .eq("id", conversionId)
    .maybeSingle();

  if (existingError) throw new AuthorizationError("GENERIC", existingError.message);
  const current = existing as UnitConversion | null;
  if (!current) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_conversion_not_found");
  }
  if (current.is_system) {
    throw new AuthorizationError(
      "SYSTEM_UNIT_PROTECTED",
      "system_unit_protected"
    );
  }

  const fromId = input.from_unit_id ?? current.from_unit_id;
  const toId = input.to_unit_id ?? current.to_unit_id;
  if (fromId === toId) {
    throw new AuthorizationError("GENERIC", "unit_conversion_same_unit");
  }

  const { from, to } = await resolveUnitRefs(establishmentId, fromId, toId);
  await assertScopes(establishmentId, from, to);

  const patch: Record<string, string | number | boolean> = {};
  if (input.from_unit_id !== undefined) patch.from_unit_id = fromId;
  if (input.to_unit_id !== undefined) patch.to_unit_id = toId;
  if (input.factor !== undefined) patch.factor = Number(input.factor);
  if (input.offset !== undefined) patch.offset_value = Number(input.offset);
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const { data, error } = await supabase
    .from("unit_conversions")
    .update(patch)
    .eq("id", conversionId)
    .select("*")
    .single();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  invalidateUnitsCache(establishmentId);
  return data as UnitConversion;
}

export async function deleteConversion(
  establishmentId: string,
  conversionId: string
): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("unit_conversions")
    .select("*")
    .eq("id", conversionId)
    .maybeSingle();

  if (existingError) throw new AuthorizationError("GENERIC", existingError.message);
  const current = existing as UnitConversion | null;
  if (!current) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_conversion_not_found");
  }
  if (current.is_system) {
    throw new AuthorizationError(
      "SYSTEM_UNIT_PROTECTED",
      "system_unit_protected"
    );
  }

  const { error } = await supabase
    .from("unit_conversions")
    .delete()
    .eq("id", conversionId)
    .eq("is_system", false);

  if (error) throw new AuthorizationError("GENERIC", error.message);
  invalidateUnitsCache(establishmentId);
}

export async function setConversionStatus(
  establishmentId: string,
  conversionId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("unit_conversions")
    .select("id, is_system")
    .eq("id", conversionId)
    .maybeSingle();

  if (existingError) throw new AuthorizationError("GENERIC", existingError.message);
  const current = existing as Pick<UnitConversion, "id" | "is_system"> | null;
  if (!current) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_conversion_not_found");
  }
  if (current.is_system) {
    throw new AuthorizationError(
      "SYSTEM_UNIT_PROTECTED",
      "system_unit_protected"
    );
  }

  await updateConversion(establishmentId, conversionId, { is_active: isActive });
}