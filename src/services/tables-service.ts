import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import type { Database } from "@/types/database";
import type {
  DiningArea,
  DiningAreaCreateInput,
  DiningAreaFilters,
  DiningAreaLocale,
  DiningAreaPageResult,
  DiningAreaTranslation,
  DiningAreaTranslationInput,
  DiningAreaUpdateInput,
  DiningAreaWithTranslations,
  DiningTable,
  DiningTableCreateInput,
  DiningTableFilters,
  DiningTableFloorPatch,
  DiningTableListItem,
  DiningTablePageResult,
  DiningTableStatus,
  DiningTableUpdateInput,
} from "@/lib/tables/types";
import { DEFAULT_TABLE_STATUS } from "@/lib/tables/status";
import {
  normalizeFloorPatches,
  tableBox,
} from "@/lib/floor-plan/geometry";

type DbClient = SupabaseClient<Database>;

export type { DiningAreaTranslationInput } from "@/lib/tables/types";

/** Pagination cap used by both list endpoints. */
const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

export function groupAreaTranslations(
  rows: DiningAreaTranslation[]
): DiningAreaWithTranslations["translations"] {
  const grouped: DiningAreaWithTranslations["translations"] = {};
  for (const row of rows) {
    const locale = row.locale as DiningAreaLocale;
    if (!["fr", "en", "ar"].includes(row.locale)) continue;
    grouped[locale] = {
      name: row.name,
      description: row.description,
    };
  }
  return grouped;
}

async function fetchAreaTranslationsFor(
  ids: string[]
): Promise<Record<string, DiningAreaWithTranslations["translations"]>> {
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_area_translations")
    .select("*")
    .in("dining_area_id", ids);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  const grouped: Record<string, DiningAreaWithTranslations["translations"]> = {};
  for (const row of data ?? []) {
    grouped[row.dining_area_id] ??= {};
    const locale = row.locale as DiningAreaLocale;
    grouped[row.dining_area_id][locale] = {
      name: row.name,
      description: row.description,
    };
  }
  return grouped;
}

async function upsertAreaTranslations(
  supabase: DbClient,
  areaId: string,
  translations: DiningAreaTranslationInput[]
): Promise<void> {
  for (const entry of translations) {
    if (!entry.name) {
      if (entry.name === "") {
        const { error: delError } = await supabase
          .from("dining_area_translations")
          .delete()
          .eq("dining_area_id", areaId)
          .eq("locale", entry.locale);
        if (delError)
          throw new AuthorizationError("GENERIC", delError.message);
      }
      continue;
    }
    const { error } = await supabase
      .from("dining_area_translations")
      .upsert(
        {
          dining_area_id: areaId,
          locale: entry.locale,
          name: entry.name.trim(),
          description: entry.description?.trim() || null,
        },
        { onConflict: "dining_area_id,locale" }
      );
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }
}

// ---------------------------------------------------------------------------
// Dining areas — reads
// ---------------------------------------------------------------------------

export async function listDiningAreas(
  establishmentId: string
): Promise<DiningAreaWithTranslations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_areas")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as DiningArea[];
  const grouped = await fetchAreaTranslationsFor(rows.map((a) => a.id));
  return rows.map((area) => ({
    ...area,
    translations: grouped[area.id] ?? {},
  }));
}

export async function getDiningArea(
  establishmentId: string,
  areaId: string
): Promise<DiningAreaWithTranslations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_areas")
    .select("*")
    .eq("id", areaId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const grouped = await fetchAreaTranslationsFor([data.id]);
  return { ...(data as DiningArea), translations: grouped[data.id] ?? {} };
}

export async function getDiningAreasPage(
  establishmentId: string,
  filters: DiningAreaFilters = {}
): Promise<DiningAreaPageResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? PAGE_SIZE), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("dining_areas")
    .select("*", { count: "exact" })
    .eq("establishment_id", establishmentId);

  if (filters.isActive !== null && filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }
  if (filters.query?.trim()) {
    query = query.ilike("name", `%${filters.query.trim()}%`);
  }

  const { data, error, count } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as DiningArea[];
  const grouped = await fetchAreaTranslationsFor(rows.map((a) => a.id));
  const total = count ?? rows.length;
  return {
    items: rows.map((area) => ({
      ...area,
      translations: grouped[area.id] ?? {},
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Dining areas — writes
// ---------------------------------------------------------------------------

async function assertAreaSlugAvailable(
  establishmentId: string,
  slug: string,
  excludingId?: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_areas")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.id !== excludingId) {
    throw new AuthorizationError("DUPLICATE_DINING_SLUG", "duplicate_slug");
  }
}

export async function createDiningArea(
  establishmentId: string,
  input: DiningAreaCreateInput
): Promise<DiningArea> {
  const slug = input.slug.trim();
  await assertAreaSlugAvailable(establishmentId, slug);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_areas")
    .insert({
      establishment_id: establishmentId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      color: input.color?.trim() || null,
      icon: input.icon?.trim() || null,
      sort_order: input.sortOrder ?? 10,
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();
  if (error) throw new AuthorizationError("GENERIC", error.message);

  await upsertAreaTranslations(supabase, data.id, input.translations ?? []);
  return data as DiningArea;
}

export async function updateDiningArea(
  establishmentId: string,
  areaId: string,
  input: DiningAreaUpdateInput
): Promise<DiningAreaWithTranslations> {
  const existing = await getDiningArea(establishmentId, areaId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");

  if (input.slug !== undefined && input.slug !== existing.slug) {
    await assertAreaSlugAvailable(establishmentId, input.slug, areaId);
  }

  const supabase = await createClient();
  const patch: Record<string, string | boolean | number | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.color !== undefined) patch.color = input.color?.trim() || null;
  if (input.icon !== undefined) patch.icon = input.icon?.trim() || null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await supabase
    .from("dining_areas")
    .update(patch)
    .eq("id", areaId)
    .eq("establishment_id", establishmentId)
    .select("*")
    .single();
  if (error) throw new AuthorizationError("GENERIC", error.message);

  await upsertAreaTranslations(supabase, areaId, input.translations ?? []);

  const fetchGrouped = await fetchAreaTranslationsFor([areaId]);
  return {
    ...(data as DiningArea),
    translations: fetchGrouped[areaId] ?? {},
  };
}

export async function deleteDiningArea(
  establishmentId: string,
  areaId: string
): Promise<void> {
  const existing = await getDiningArea(establishmentId, areaId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");

  const supabase = await createClient();
  const { count, error: refError } = await supabase
    .from("tables")
    .select("id", { count: "exact", head: true })
    .eq("area_id", areaId);
  if (refError) throw new AuthorizationError("GENERIC", refError.message);

  const { error } = await supabase
    .from("dining_areas")
    .delete()
    .eq("id", areaId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  // Translations cascade; FK on tables is ON DELETE SET NULL so the tables
  // keep their geometry but become unassigned.
  if ((count ?? 0) > 0) {
    const { error: nullError } = await supabase
      .from("tables")
      .update({ area_id: null })
      .eq("area_id", areaId);
    if (nullError) throw new AuthorizationError("GENERIC", nullError.message);
  }
}

export async function reorderDiningAreas(
  establishmentId: string,
  orderedIds: string[]
): Promise<void> {
  const areas = await listDiningAreas(establishmentId);
  const missing = orderedIds.filter(
    (id) => !areas.some((area) => area.id === id)
  );
  if (missing.length > 0) throw new AuthorizationError("RESOURCE_NOT_FOUND");

  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const nextOrder = (i + 1) * 10;
    const current = areas.find((area) => area.id === orderedIds[i]);
    if (current && current.sort_order === nextOrder) continue;
    const { error } = await supabase
      .from("dining_areas")
      .update({ sort_order: nextOrder })
      .eq("id", orderedIds[i])
      .eq("establishment_id", establishmentId);
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }
}

export async function setDiningAreaStatus(
  establishmentId: string,
  areaId: string,
  isActive: boolean
): Promise<void> {
  const existing = await getDiningArea(establishmentId, areaId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");

  const supabase = await createClient();
  const { error } = await supabase
    .from("dining_areas")
    .update({ is_active: isActive })
    .eq("id", areaId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

// ---------------------------------------------------------------------------
// Tables — reads
// ---------------------------------------------------------------------------

async function assertTableBelongsToEstablishment(
  establishmentId: string,
  tableId: string
): Promise<DiningTable> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("id", tableId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  return data as DiningTable;
}

async function assertTableNumberAvailable(
  establishmentId: string,
  tableNumber: string,
  excludingId?: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("table_number", tableNumber)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.id !== excludingId) {
    throw new AuthorizationError(
      "DUPLICATE_TABLE_NUMBER",
      "duplicate_table_number"
    );
  }
}

async function assertAreaExists(
  establishmentId: string,
  areaId: string | null | undefined
): Promise<void> {
  if (!areaId) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_areas")
    .select("id")
    .eq("id", areaId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) throw new AuthorizationError("DINING_AREA_NOT_FOUND");
}

export async function listTables(
  establishmentId: string
): Promise<DiningTableListItem[]> {
  const supabase = await createClient();
  const [tableResult, areaResult] = await Promise.all([
    supabase
      .from("tables")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("dining_areas")
      .select("id, name, slug, color")
      .eq("establishment_id", establishmentId),
  ]);
  if (tableResult.error) throw new AuthorizationError("GENERIC", tableResult.error.message);
  if (areaResult.error) throw new AuthorizationError("GENERIC", areaResult.error.message);

  const areaMap = new Map(
    (areaResult.data ?? []).map((area) => [
      area.id,
      { name: area.name, slug: area.slug, color: area.color },
    ])
  );

  return (tableResult.data ?? []).map((row) => {
    const area = row.area_id ? areaMap.get(row.area_id) : undefined;
    return {
      ...(row as DiningTable),
      areaName: area?.name ?? null,
      areaSlug: area?.slug ?? null,
      areaColor: area?.color ?? null,
    };
  });
}

export async function getTable(
  establishmentId: string,
  tableId: string
): Promise<DiningTableListItem | null> {
  const supabase = await createClient();
  const [tableResult, areaResult] = await Promise.all([
    supabase
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .eq("establishment_id", establishmentId)
      .maybeSingle(),
    supabase
      .from("dining_areas")
      .select("id, name, slug, color")
      .eq("establishment_id", establishmentId),
  ]);
  if (tableResult.error) throw new AuthorizationError("GENERIC", tableResult.error.message);
  if (areaResult.error) throw new AuthorizationError("GENERIC", areaResult.error.message);
  if (!tableResult.data) return null;

  const area = tableResult.data.area_id
    ? (areaResult.data ?? []).find((a) => a.id === tableResult.data.area_id)
    : undefined;
  return {
    ...(tableResult.data as DiningTable),
    areaName: area?.name ?? null,
    areaSlug: area?.slug ?? null,
    areaColor: area?.color ?? null,
  };
}

export async function getTablesPage(
  establishmentId: string,
  filters: DiningTableFilters = {}
): Promise<DiningTablePageResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? PAGE_SIZE), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tables")
    .select("*", { count: "exact" })
    .eq("establishment_id", establishmentId);

  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.isActive !== null && filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }
  if (filters.query?.trim()) {
    query = query.or(
      `name.ilike.%${filters.query.trim()}%,table_number.ilike.%${filters.query.trim()}%`
    );
  }

  const { data, error, count } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(from, to);

  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = (data ?? []) as DiningTable[];
  const areaIds = Array.from(
    new Set(rows.map((r) => r.area_id).filter((id): id is string => Boolean(id)))
  );
  const areaMap = new Map<string, { name: string; slug: string; color: string | null }>();
  if (areaIds.length > 0) {
    const { data: areas, error: areaError } = await supabase
      .from("dining_areas")
      .select("id, name, slug, color")
      .in("id", areaIds);
    if (areaError) throw new AuthorizationError("GENERIC", areaError.message);
    for (const area of areas ?? []) {
      areaMap.set(area.id, { name: area.name, slug: area.slug, color: area.color });
    }
  }

  const total = count ?? rows.length;
  return {
    items: rows.map((row) => {
      const area = row.area_id ? areaMap.get(row.area_id) : undefined;
      return {
        ...row,
        areaName: area?.name ?? null,
        areaSlug: area?.slug ?? null,
        areaColor: area?.color ?? null,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Tables — writes
// ---------------------------------------------------------------------------

export async function createTable(
  establishmentId: string,
  input: DiningTableCreateInput
): Promise<DiningTable> {
  const slug = input.slug.trim();
  const tableNumber = input.tableNumber?.trim() || null;
  if (tableNumber) {
    await assertTableNumberAvailable(establishmentId, tableNumber);
  }
  await assertAreaExists(establishmentId, input.areaId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .insert({
      establishment_id: establishmentId,
      area_id: input.areaId ?? null,
      name: input.name.trim(),
      slug,
      table_number: tableNumber,
      capacity: input.capacity ?? 1,
      shape: input.shape ?? "round",
      position_x: input.positionX ?? 0,
      position_y: input.positionY ?? 0,
      width: input.width ?? null,
      height: input.height ?? null,
      rotation: input.rotation ?? 0,
      color: input.color?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      status: input.status ?? DEFAULT_TABLE_STATUS,
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return data as DiningTable;
}

export async function updateTable(
  establishmentId: string,
  tableId: string,
  input: DiningTableUpdateInput
): Promise<DiningTable> {
  await assertTableBelongsToEstablishment(establishmentId, tableId);

  if (
    input.tableNumber != null &&
    input.tableNumber.trim() !== ""
  ) {
    await assertTableNumberAvailable(
      establishmentId,
      input.tableNumber.trim(),
      tableId
    );
  }
  await assertAreaExists(establishmentId, input.areaId);

  const supabase = await createClient();
  const patch: Record<string, string | boolean | number | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.tableNumber !== undefined)
    patch.table_number = input.tableNumber?.trim() || null;
  if (input.areaId !== undefined) patch.area_id = input.areaId ?? null;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.shape !== undefined) patch.shape = input.shape;
  if (input.positionX !== undefined) patch.position_x = input.positionX;
  if (input.positionY !== undefined) patch.position_y = input.positionY;
  if (input.width !== undefined) patch.width = input.width;
  if (input.height !== undefined) patch.height = input.height;
  if (input.rotation !== undefined) patch.rotation = input.rotation;
  if (input.color !== undefined) patch.color = input.color?.trim() || null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.status !== undefined) patch.status = input.status;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await supabase
    .from("tables")
    .update(patch)
    .eq("id", tableId)
    .eq("establishment_id", establishmentId)
    .select("*")
    .single();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return data as DiningTable;
}

export async function deleteTable(
  establishmentId: string,
  tableId: string
): Promise<void> {
  await assertTableBelongsToEstablishment(establishmentId, tableId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .delete()
    .eq("id", tableId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

export async function setTableStatus(
  establishmentId: string,
  tableId: string,
  status: DiningTableStatus
): Promise<void> {
  await assertTableBelongsToEstablishment(establishmentId, tableId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ status })
    .eq("id", tableId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

export async function duplicateTable(
  establishmentId: string,
  tableId: string
): Promise<DiningTable> {
  const existing = await assertTableBelongsToEstablishment(
    establishmentId,
    tableId
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .insert({
      establishment_id: establishmentId,
      area_id: existing.area_id,
      name: `${existing.name} (2)`,
      slug: `${existing.slug}-2`,
      table_number: existing.table_number
        ? `${existing.table_number}-2`
        : null,
      capacity: existing.capacity,
      shape: existing.shape,
      position_x: (existing.position_x ?? 0) + 30,
      position_y: (existing.position_y ?? 0) + 30,
      width: existing.width,
      height: existing.height,
      rotation: existing.rotation ?? 0,
      color: existing.color,
      sort_order: existing.sort_order + 1,
      status: existing.status,
      is_active: existing.is_active,
    })
    .select("*")
    .single();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return data as DiningTable;
}

/**
 * Apply one or several geometry/placement patches from the floor plan editor.
 * The pure validation (size / rotation / bounds) lives in the lib so the
 * exact same rules are covered by unit tests and by the server action.
 */
export async function applyTableFloorPatches(
  establishmentId: string,
  patches: DiningTableFloorPatch[]
): Promise<void> {
  const { valid, reason, patches: normalized } =
    normalizeFloorPatches(patches);
  if (!valid) {
    throw new AuthorizationError(
      reason === "rotation"
        ? "TABLE_ROTATION_INVALID"
        : reason === "bounds"
          ? "TABLE_POSITION_INVALID"
          : "TABLE_SIZE_INVALID"
    );
  }
  if (normalized.length === 0) return;

  const tables = await listTables(establishmentId);
  const tableById = new Map(tables.map((table) => [table.id, table]));

  for (const patch of normalized) {
    const existing = tableById.get(patch.tableId);
    if (!existing) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND");
    }
    if (patch.areaId && patch.areaId !== existing.area_id) {
      const exists = await areaExists(establishmentId, patch.areaId);
      if (!exists) throw new AuthorizationError("DINING_AREA_NOT_FOUND");
    }

    const box = tableBox(existing);
    const supabase = await createClient();
    const { error } = await supabase
      .from("tables")
      .update({
        area_id: patch.areaId ?? existing.area_id,
        position_x: patch.positionX ?? box.x,
        position_y: patch.positionY ?? box.y,
        width: patch.width ?? box.width,
        height: patch.height ?? box.height,
        rotation: patch.rotation ?? box.rotation,
      })
      .eq("id", patch.tableId)
      .eq("establishment_id", establishmentId);
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }
}

async function areaExists(
  establishmentId: string,
  areaId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dining_areas")
    .select("id")
    .eq("id", areaId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return Boolean(data);
}