import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import {
  calculateNormalizedPurchaseCost,
} from "@/lib/suppliers/calculations";
import type {
  Supplier,
  SupplierContact,
  IngredientSupplier,
  SupplierWithRelations,
  SupplierCatalogItem,
  SupplierPriceHistoryEntry,
  SupplierPageResult,
  SupplierCounts,
  SupplierComparisonEntry,
} from "@/lib/suppliers/types";
import { getCatalogCached } from "@/services/units-cache";
import { getAuthorizationContext } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSupplier(
  establishmentId: string,
  supplierId: string
): Promise<SupplierWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;
  return enrichSupplier([data]).then(([supplier]) => supplier ?? null);
}

export async function getSuppliersPage(
  establishmentId: string,
  options: {
    page?: number;
    pageSize?: number;
    activeOnly?: boolean;
    inactiveOnly?: boolean;
    preferredOnly?: boolean;
    query?: string;
  } = {}
): Promise<SupplierPageResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 20)));

  const supabase = await createClient();
  const base = () =>
    supabase
      .from("suppliers")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("is_preferred", { ascending: false })
      .order("name", { ascending: true });

  const baseCount = () =>
    supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId)
      .order("is_preferred", { ascending: false })
      .order("name", { ascending: true });

  const applyFilters = (query: ReturnType<typeof base>) => {
    if (options.activeOnly) query = query.eq("is_active", true);
    if (options.inactiveOnly) query = query.eq("is_active", false);
    if (options.preferredOnly) query = query.eq("is_preferred", true);
    const text = options.query?.trim();
    if (text) {
      const like = `%${text}%`;
      query = query.or(
        `name.ilike.${like},code.ilike.${like},email.ilike.${like},city.ilike.${like}`
      );
    }
    return query;
  };

  const { count, error: countError } = await applyFilters(baseCount());
  if (countError) throw new AuthorizationError("GENERIC", countError.message);
  const total = count ?? 0;

  const { data, error } = await applyFilters(base())
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const items = await enrichSupplier(data ?? []);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Unpaged, lightweight supplier list for selectors and quick forms. */
export async function listSuppliers(
  establishmentId: string,
  options: { activeOnly?: boolean } = {}
): Promise<Supplier[]> {
  const supabase = await createClient();
  let query = supabase
    .from("suppliers")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("is_preferred", { ascending: false })
    .order("name", { ascending: true })
    .limit(500);
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as Supplier[];
}

export async function getSupplierContacts(
  establishmentId: string,
  supplierId: string
): Promise<SupplierContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_contacts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as SupplierContact[];
}

/** Active supplier-catalog entries for ONE ingredient (ingredient page tab). */
export async function getIngredientSuppliers(
  establishmentId: string,
  ingredientId: string
): Promise<SupplierCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredient_suppliers")
    .select("*, suppliers(name, code), ingredients(name, slug, base_unit_id), units(symbol)")
    .eq("establishment_id", establishmentId)
    .eq("ingredient_id", ingredientId)
    .eq("is_active", true)
    .order("is_preferred", { ascending: false })
    .order("purchase_price", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return enrichCatalogItems(data ?? [], establishmentId);
}

/** Full catalog offered by ONE supplier (supplier detail page). */
export async function getSupplierCatalog(
  establishmentId: string,
  supplierId: string
): Promise<SupplierCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredient_suppliers")
    .select("*, ingredients(name, slug, base_unit_id), units(symbol)")
    .eq("establishment_id", establishmentId)
    .eq("supplier_id", supplierId)
    .order("is_preferred", { ascending: false })
    .order("purchase_price", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return enrichCatalogItems(data ?? [], establishmentId);
}

/** Cross-supplier offers for a set of ingredients (comparison tab). */
export async function getSupplierComparison(
  establishmentId: string,
  ingredientIds: string[]
): Promise<SupplierComparisonEntry[]> {
  const supabase = await createClient();
  if (ingredientIds.length === 0) return [];

  const { data, error } = await supabase
    .from("ingredient_suppliers")
    .select(
      "*, suppliers(name, code), ingredients(name, slug, base_unit_id), units(symbol)"
    )
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .in("ingredient_id", ingredientIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const purchaseUnitIds = new Set<string>();
  const baseUnitIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.purchase_unit_id) purchaseUnitIds.add(row.purchase_unit_id);
    const ingredient = (Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients) as { base_unit_id?: string | null } | null;
    const baseUnitId = ingredient?.base_unit_id ?? null;
    if (baseUnitId) baseUnitIds.add(baseUnitId);
  }
  const unitsById = await unitSymbolMap([
    ...purchaseUnitIds,
    ...baseUnitIds,
  ]);
  const { conversions } = await getCatalogCached(establishmentId);

  const map = new Map<string, NonNullable<SupplierComparisonEntry>>();
  for (const row of data ?? []) {
    const ingredientId = row.ingredient_id as string;
    const ingredient = (Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients) as {
      name: string;
      slug: string;
      base_unit_id: string | null;
    } | null;
    const supplier = (Array.isArray(row.suppliers)
      ? row.suppliers[0]
      : row.suppliers) as { name: string; code: string | null } | null;
    const purchaseUnit = (Array.isArray(row.units)
      ? row.units[0]
      : row.units) as { symbol: string } | null;
    const baseUnitId = ingredient?.base_unit_id ?? null;

    const normalizedCost = calculateNormalizedPurchaseCost({
      purchasePrice: Number(row.purchase_price),
      purchaseQuantity: Number(row.purchase_quantity),
      purchaseUnitId: row.purchase_unit_id ?? "",
      baseUnitId,
      conversions,
      baseUnitSymbol: baseUnitId ? unitsById.get(baseUnitId) ?? null : null,
    });

    const entry = map.get(ingredientId) ?? {
      ingredientId,
      ingredientName: ingredient?.name ?? "",
      baseUnitSymbol: baseUnitId ? unitsById.get(baseUnitId) ?? null : null,
      offers: [] as NonNullable<SupplierComparisonEntry>["offers"],
    };
    entry.offers.push({
      supplierId: row.supplier_id as string,
      supplierName: supplier?.name ?? "",
      supplierCode: supplier?.code ?? null,
      purchasePrice: Number(row.purchase_price),
      purchaseQuantity: Number(row.purchase_quantity),
      purchaseUnitId: row.purchase_unit_id as string | null,
      purchaseUnitSymbol: purchaseUnit?.symbol ?? null,
      currencyCode: row.currency_code as string,
      normalizedCost,
      isPreferred: row.is_preferred as boolean,
    });
    map.set(ingredientId, entry);
  }

  return [...map.values()].map((entry) => ({
    ...entry,
    offers: entry.offers.sort((a, b) => {
      const an = a.normalizedCost?.amount ?? Number.POSITIVE_INFINITY;
      const bn = b.normalizedCost?.amount ?? Number.POSITIVE_INFINITY;
      return an - bn;
    }),
  }));
}

export async function getIngredientSupplierById(
  establishmentId: string,
  ingredientSupplierId: string
): Promise<IngredientSupplier | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredient_suppliers")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientSupplierId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data as IngredientSupplier | null) ?? null;
}

export type PaymentMethodRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

/** Active payment methods available in an establishment scope. */
export async function listPaymentMethods(
  establishmentId: string
): Promise<PaymentMethodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, code, is_active")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []) as PaymentMethodRow[];
}

/** Price history for every catalog entry of ONE supplier (pricing tab). */
export async function getSupplierPriceHistoryBySupplier(
  establishmentId: string,
  supplierId: string
): Promise<SupplierPriceHistoryEntry[]> {
  const supabase = await createClient();
  const { data: itemRows, error: itemError } = await supabase
    .from("ingredient_suppliers")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("supplier_id", supplierId);
  if (itemError) throw new AuthorizationError("GENERIC", itemError.message);
  const itemIds = (itemRows ?? []).map((row) => row.id);
  if (itemIds.length === 0) return [];

  const { data, error } = await supabase
    .from("supplier_price_history")
    .select("*, units(symbol), ingredient_suppliers(ingredient_id, ingredients(name, slug))")
    .eq("establishment_id", establishmentId)
    .in("ingredient_supplier_id", itemIds)
    .order("valid_from", { ascending: false });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  return (data ?? []).map((row) => {
    const unit = (Array.isArray(row.units) ? row.units[0] : row.units) ?? null;
    const ref = (Array.isArray(row.ingredient_suppliers)
      ? row.ingredient_suppliers[0]
      : row.ingredient_suppliers) as
      | { ingredients?: unknown }
      | null;
    const ingredient = (ref?.ingredients
      ? Array.isArray(ref.ingredients)
        ? ref.ingredients[0]
        : ref.ingredients
      : null) as { name?: string } | null;
    return {
      ...row,
      purchase_unit_id: row.purchase_unit_id as string | null,
      purchaseUnitSymbol: unit?.symbol ?? null,
      ingredientName: ingredient?.name ?? "",
    } as SupplierPriceHistoryEntry;
  });
}

export async function getSupplierPriceHistory(
  establishmentId: string,
  ingredientSupplierId: string
): Promise<SupplierPriceHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_price_history")
    .select("*, units(symbol)")
    .eq("establishment_id", establishmentId)
    .eq("ingredient_supplier_id", ingredientSupplierId)
    .order("valid_from", { ascending: false });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []).map((row) => {
    const unit = (Array.isArray(row.units) ? row.units[0] : row.units) ?? null;
    return {
      ...row,
      purchase_unit_id: row.purchase_unit_id as string | null,
      purchaseUnitSymbol: unit?.symbol ?? null,
    };
  }) as SupplierPriceHistoryEntry[];
}

export async function getSupplierCounts(
  establishmentId: string
): Promise<SupplierCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, is_active, is_preferred")
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
    preferred: rows.filter((row) => row.is_preferred).length,
  };
}

/** Next sequential supplier code (SUP-0001…) via the DB generator. */
export async function nextSupplierCode(
  establishmentId: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("next_supplier_code", {
    p_est: establishmentId,
  });
  if (error) throw toAuthorizationError(error);
  return (data ?? "SUP-0001") as string;
}

// ---------------------------------------------------------------------------
// Supplier writes
// ---------------------------------------------------------------------------

export interface SupplierCreateInput {
  name: string;
  code?: string | null;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxIdentifier?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  paymentTerms?: string | null;
  defaultPaymentMethodId?: string | null;
  deliveryLeadTimeDays?: number | null;
  minimumOrderAmount?: number | null;
  notes?: string | null;
  isActive?: boolean;
  contacts?: SupplierContactInput[];
}

export interface SupplierContactInput {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
}

export async function createSupplier(
  establishmentId: string,
  userId: string,
  input: SupplierCreateInput
): Promise<Supplier> {
  const supabase = await createClient();
  await assertReferences(establishmentId, input);

  let code = input.code?.trim() || null;
  if (!code) {
    code = await nextSupplierCode(establishmentId);
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      establishment_id: establishmentId,
      name: input.name.trim(),
      code,
      legal_name: input.legalName ?? null,
      registration_number: input.registrationNumber ?? null,
      tax_identifier: input.taxIdentifier ?? null,
      phone: input.phone?.trim() ? input.phone.trim() : null,
      mobile: input.mobile?.trim() ? input.mobile.trim() : null,
      email: input.email?.trim() ? input.email.trim().toLowerCase() : null,
      website: input.website?.trim() || null,
      address_line_1: input.addressLine1 ?? null,
      address_line_2: input.addressLine2 ?? null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      contact_person: input.contactPerson ?? null,
      contact_email: input.contactEmail?.trim()
        ? input.contactEmail.trim().toLowerCase()
        : null,
      contact_phone: input.contactPhone?.trim() ? input.contactPhone.trim() : null,
      payment_terms: input.paymentTerms ?? null,
      default_payment_method_id: input.defaultPaymentMethodId ?? null,
      delivery_lead_time_days: input.deliveryLeadTimeDays ?? null,
      minimum_order_amount: input.minimumOrderAmount ?? null,
      notes: input.notes ?? null,
      is_active: input.isActive ?? true,
      is_preferred: false,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();
  if (error) throw toAuthorizationError(error);

  const created = data as Supplier;
  if (input.contacts && input.contacts.length > 0) {
    await replaceContacts(supabase, created.id, userId, input.contacts);
  }
  return created;
}

export async function updateSupplier(
  establishmentId: string,
  supplierId: string,
  userId: string,
  input: SupplierCreateInput
): Promise<Supplier> {
  const supabase = await createClient();
  await assertReferences(establishmentId, input);

  const patch: Record<string, unknown> = {
    updated_by: userId,
  };
  const set = (field: string, value: unknown) => {
    if (value !== undefined) patch[field] = value;
  };
  set("name", input.name?.trim());
  set("legal_name", input.legalName ?? null);
  set("registration_number", input.registrationNumber ?? null);
  set("tax_identifier", input.taxIdentifier ?? null);
  set("phone", input.phone?.trim() ? input.phone.trim() : null);
  set("mobile", input.mobile?.trim() ? input.mobile.trim() : null);
  set(
    "email",
    input.email?.trim() ? input.email.trim().toLowerCase() : null
  );
  set("website", input.website?.trim() || null);
  set("address_line_1", input.addressLine1 ?? null);
  set("address_line_2", input.addressLine2 ?? null);
  set("postal_code", input.postalCode ?? null);
  set("city", input.city ?? null);
  set("state", input.state ?? null);
  set("country", input.country ?? null);
  set("contact_person", input.contactPerson ?? null);
  set(
    "contact_email",
    input.contactEmail?.trim() ? input.contactEmail.trim().toLowerCase() : null
  );
  set("contact_phone", input.contactPhone?.trim() ? input.contactPhone.trim() : null);
  set("payment_terms", input.paymentTerms ?? null);
  set("default_payment_method_id", input.defaultPaymentMethodId ?? null);
  set("delivery_lead_time_days", input.deliveryLeadTimeDays ?? null);
  set("minimum_order_amount", input.minimumOrderAmount ?? null);
  set("notes", input.notes ?? null);

  const { error } = await supabase
    .from("suppliers")
    .update(patch)
    .eq("establishment_id", establishmentId)
    .eq("id", supplierId)
    .select()
    .single();
  if (error) throw toAuthorizationError(error);

  if (input.contacts) {
    await replaceContacts(supabase, supplierId, userId, input.contacts);
  }

  const enriched = await getSupplier(establishmentId, supplierId);
  return (
    enriched ??
    (() => {
      throw new AuthorizationError("SUPPLIER_NOT_FOUND", "supplier_not_found");
    })()
  );
}

export async function setSupplierStatus(
  establishmentId: string,
  supplierId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createClient();
  await getSupplierRow(establishmentId, supplierId);
  const { error } = await supabase
    .from("suppliers")
    .update({
      is_active: isActive,
      updated_by: (await getActorUserId()) ?? undefined,
    })
    .eq("establishment_id", establishmentId)
    .eq("id", supplierId);
  if (error) throw toAuthorizationError(error);
}

/** Soft-delete when referenced by the catalog; physical delete otherwise. */
export async function deleteSupplier(
  establishmentId: string,
  supplierId: string
): Promise<{ softDeleted: boolean }> {
  const supabase = await createClient();
  await getSupplierRow(establishmentId, supplierId);

  const { count } = await supabase
    .from("ingredient_suppliers")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", establishmentId)
    .eq("supplier_id", supplierId);
  if (count && count > 0) {
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: false, is_preferred: false })
      .eq("establishment_id", establishmentId)
      .eq("id", supplierId);
    if (error) throw toAuthorizationError(error);
    return { softDeleted: true };
  }

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("establishment_id", establishmentId)
    .eq("id", supplierId);
  if (error) throw toAuthorizationError(error);
  return { softDeleted: false };
}

// ---------------------------------------------------------------------------
// Catalog writes (atomic through RPCs)
// ---------------------------------------------------------------------------

export interface IngredientSupplierInput {
  ingredientId: string;
  supplierId: string;
  purchaseUnitId: string;
  purchaseQuantity: number;
  purchasePrice: number;
  currencyCode: string;
  minimumOrderQuantity?: number | null;
  leadTimeDays?: number | null;
  supplierSku?: string | null;
  supplierBarcode?: string | null;
  isPreferred?: boolean;
  notes?: string | null;
}

export async function addIngredientSupplier(
  establishmentId: string,
  input: IngredientSupplierInput
): Promise<IngredientSupplier> {
  const supabase = await createClient();
  await assertCatalogReferences(establishmentId, input);

  const { data, error } = await supabase.rpc(
    "add_ingredient_supplier_with_history",
    {
      p_est: establishmentId,
      p_ingredient_id: input.ingredientId,
      p_supplier_id: input.supplierId,
      p_unit_id: input.purchaseUnitId,
      p_qty: input.purchaseQuantity,
      p_price: input.purchasePrice,
      p_currency: input.currencyCode,
      p_min_order: input.minimumOrderQuantity ?? null,
      p_lead_time_days: input.leadTimeDays ?? null,
      p_is_preferred: input.isPreferred ?? false,
      p_notes: input.notes ?? null,
    }
  );
  if (error) throw toAuthorizationError(error);

  const created = await getIngredientSupplierById(
    establishmentId,
    data as string
  );
  if (!created) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "ingredient_supplier_not_found");
  }

  if (input.supplierSku || input.supplierBarcode) {
    const { error: skuError } = await supabase
      .from("ingredient_suppliers")
      .update({
        supplier_sku: input.supplierSku?.trim() || null,
        supplier_barcode: input.supplierBarcode?.trim() || null,
      })
      .eq("id", created.id);
    if (skuError) throw toAuthorizationError(skuError);
  }

  return created;
}

export interface IngredientSupplierUpdateInput {
  ingredientId: string;
  supplierId: string;
  purchaseUnitId?: string | null;
  purchaseQuantity?: number | null;
  purchasePrice?: number | null;
  currencyCode?: string | null;
  minimumOrderQuantity?: number | null;
  leadTimeDays?: number | null;
  supplierSku?: string | null;
  supplierBarcode?: string | null;
  isPreferred?: boolean | null;
  isActive?: boolean | null;
  notes?: string | null;
}

export async function updateIngredientSupplier(
  establishmentId: string,
  ingredientSupplierId: string,
  input: IngredientSupplierUpdateInput
): Promise<IngredientSupplier> {
  const supabase = await createClient();
  const existing = await getIngredientSupplierById(
    establishmentId,
    ingredientSupplierId
  );
  if (!existing) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "ingredient_supplier_not_found");
  }
  if (input.ingredientId && input.ingredientId !== existing.ingredient_id) {
    throw new AuthorizationError("CROSS_ESTABLISHMENT_REFERENCE");
  }
  if (input.supplierId && input.supplierId !== existing.supplier_id) {
    throw new AuthorizationError("CROSS_ESTABLISHMENT_REFERENCE");
  }

  const pricingChanged =
    (input.purchasePrice !== undefined &&
      input.purchasePrice !== Number(existing.purchase_price)) ||
    (input.currencyCode !== undefined &&
      input.currencyCode !== existing.currency_code) ||
    (input.purchaseQuantity !== undefined &&
      input.purchaseQuantity !== Number(existing.purchase_quantity)) ||
    (input.purchaseUnitId !== undefined &&
      input.purchaseUnitId !== existing.purchase_unit_id);

  if (pricingChanged) {
    const { error } = await supabase.rpc("record_supplier_price_change", {
      p_est: establishmentId,
      p_item_id: ingredientSupplierId,
      p_price: input.purchasePrice ?? Number(existing.purchase_price),
      p_currency: input.currencyCode ?? existing.currency_code,
      p_unit_id: input.purchaseUnitId ?? existing.purchase_unit_id,
      p_qty: input.purchaseQuantity ?? Number(existing.purchase_quantity),
    });
    if (error) throw toAuthorizationError(error);
  }

  const patch: Record<string, unknown> = {};
  if (input.supplierSku !== undefined) {
    patch.supplier_sku = input.supplierSku?.trim() || null;
  }
  if (input.supplierBarcode !== undefined) {
    patch.supplier_barcode = input.supplierBarcode?.trim() || null;
  }
  if (input.minimumOrderQuantity !== undefined) {
    patch.minimum_order_quantity = input.minimumOrderQuantity ?? null;
  }
  if (input.leadTimeDays !== undefined) {
    patch.lead_time_days = input.leadTimeDays ?? null;
  }
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.isPreferred !== undefined && !input.isPreferred) {
    patch.is_preferred = false;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("ingredient_suppliers")
      .update(patch)
      .eq("establishment_id", establishmentId)
      .eq("id", ingredientSupplierId);
    if (error) throw toAuthorizationError(error);
  }

  if (input.isPreferred) {
    await setPreferredSupplier(establishmentId, ingredientSupplierId);
  }

  const updated = await getIngredientSupplierById(
    establishmentId,
    ingredientSupplierId
  );
  if (!updated) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "ingredient_supplier_not_found");
  }
  return updated;
}

export async function setPreferredSupplier(
  establishmentId: string,
  ingredientSupplierId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_preferred_supplier", {
    p_est: establishmentId,
    p_item_id: ingredientSupplierId,
  });
  if (error) throw toAuthorizationError(error);
}

export async function removeIngredientSupplier(
  establishmentId: string,
  ingredientSupplierId: string
): Promise<void> {
  const supabase = await createClient();
  const existing = await getIngredientSupplierById(
    establishmentId,
    ingredientSupplierId
  );
  if (!existing) {
    throw new AuthorizationError("RESOURCE_NOT_FOUND", "ingredient_supplier_not_found");
  }
  const { error } = await supabase
    .from("ingredient_suppliers")
    .delete()
    .eq("establishment_id", establishmentId)
    .eq("id", ingredientSupplierId);
  if (error) throw toAuthorizationError(error);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function getActorUserId(): Promise<string | null> {
  try {
    const context = await getAuthorizationContext();
    return context.userId;
  } catch {
    return null;
  }
}

async function getSupplierRow(
  establishmentId: string,
  supplierId: string
): Promise<Supplier> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) {
    throw new AuthorizationError("SUPPLIER_NOT_FOUND", "supplier_not_found");
  }
  return data as Supplier;
}

async function assertReferences(
  establishmentId: string,
  input: SupplierCreateInput
): Promise<void> {
  if (!input.defaultPaymentMethodId) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("establishment_id")
    .eq("id", input.defaultPaymentMethodId)
    .maybeSingle();
  if (error || !data || data.establishment_id !== establishmentId) {
    throw new AuthorizationError(
      "CROSS_ESTABLISHMENT_REFERENCE",
      "payment_method_not_found"
    );
  }
}

async function assertCatalogReferences(
  establishmentId: string,
  input: IngredientSupplierInput
): Promise<void> {
  const supabase = await createClient();
  const [ingredient, supplier, requiredUnits] = await Promise.all([
    supabase
      .from("ingredients")
      .select("establishment_id")
      .eq("id", input.ingredientId)
      .maybeSingle(),
    supabase
      .from("suppliers")
      .select("establishment_id")
      .eq("id", input.supplierId)
      .maybeSingle(),
    supabase
      .from("units")
      .select("id, establishment_id")
      .eq("id", input.purchaseUnitId)
      .maybeSingle(),
  ]);
  if (
    ingredient.error ||
    !ingredient.data ||
    ingredient.data.establishment_id !== establishmentId
  ) {
    throw new AuthorizationError("INGREDIENT_SUPPLIER_NOREFS", "ingredient_not_found");
  }
  if (
    supplier.error ||
    !supplier.data ||
    supplier.data.establishment_id !== establishmentId
  ) {
    throw new AuthorizationError("INGREDIENT_SUPPLIER_NOREFS", "supplier_not_found");
  }
  if (
    requiredUnits.error ||
    !requiredUnits.data ||
    (requiredUnits.data.establishment_id !== establishmentId &&
      requiredUnits.data.establishment_id !== null)
  ) {
    throw new AuthorizationError("INGREDIENT_SUPPLIER_NOREFS", "unit_not_found");
  }
}

type ContactInputRow = SupplierContactInput;

async function replaceContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  supplierId: string,
  userId: string,
  contacts: ContactInputRow[]
): Promise<void> {
  const keptIds = contacts
    .map((contact) => contact.id)
    .filter((id): id is string => Boolean(id));
  if (keptIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("supplier_contacts")
      .delete()
      .eq("supplier_id", supplierId)
      .not("id", "in", `(${keptIds.join(",")})`);
    if (deleteError) throw toAuthorizationError(deleteError);
  } else {
    const { error: deleteError } = await supabase
      .from("supplier_contacts")
      .delete()
      .eq("supplier_id", supplierId);
    if (deleteError) throw toAuthorizationError(deleteError);
  }

  let assignedPrimary = false;
  for (const contact of contacts) {
    const row: Record<string, unknown> = {
      supplier_id: supplierId,
      first_name: contact.first_name ?? null,
      last_name: contact.last_name ?? null,
      job_title: contact.job_title ?? null,
      email: contact.email?.trim() ? contact.email.trim().toLowerCase() : null,
      phone: contact.phone?.trim() ? contact.phone.trim() : null,
      mobile: contact.mobile?.trim() ? contact.mobile.trim() : null,
      is_primary: contact.is_primary && !assignedPrimary,
      is_active: contact.is_active ?? true,
      updated_by: userId,
    };
    assignedPrimary = assignedPrimary || Boolean(contact.is_primary);

    if (contact.id) {
      const { error: updateError } = await supabase
        .from("supplier_contacts")
        .update(row)
        .eq("id", contact.id)
        .eq("supplier_id", supplierId);
      if (updateError) throw toAuthorizationError(updateError);
    } else {
      const { error: insertError } = await supabase
        .from("supplier_contacts")
        .insert({ ...row, created_by: userId });
      if (insertError) throw toAuthorizationError(insertError);
    }
  }
}

interface CatalogJoinRow extends IngredientSupplier {
  ingredients?: unknown;
  suppliers?: unknown;
  units?: unknown;
}

async function enrichCatalogItems(
  rows: CatalogJoinRow[],
  establishmentId: string
): Promise<SupplierCatalogItem[]> {
  if (rows.length === 0) return [];

  const purchaseUnitIds = new Set<string>();
  const baseUnitIds = new Set<string>();
  for (const row of rows) {
    if (row.purchase_unit_id) purchaseUnitIds.add(row.purchase_unit_id);
    const ingredient = (Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients) as { base_unit_id?: string | null } | null;
    const baseUnitId = ingredient?.base_unit_id ?? null;
    if (baseUnitId) baseUnitIds.add(baseUnitId);
  }
  const unitsById = await unitSymbolMap([
    ...purchaseUnitIds,
    ...baseUnitIds,
  ]);

  const { conversions } = await getCatalogCached(establishmentId);

  return rows.map((row) => {
    const ingredient = (Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients) as {
      name: string;
      slug: string;
      base_unit_id: string | null;
    } | null;
    const purchaseUnit = (Array.isArray(row.units) ? row.units[0] : row.units) as {
      symbol: string;
    } | null;
    const supplier = (Array.isArray(row.suppliers)
      ? row.suppliers[0]
      : row.suppliers) as { name?: string; code?: string | null } | null;
    const baseUnitId = ingredient?.base_unit_id ?? null;
    const normalizedCost = calculateNormalizedPurchaseCost({
      purchasePrice: Number(row.purchase_price),
      purchaseQuantity: Number(row.purchase_quantity),
      purchaseUnitId: row.purchase_unit_id ?? "",
      baseUnitId,
      conversions,
      baseUnitSymbol: baseUnitId ? unitsById.get(baseUnitId) ?? null : null,
    });

    return {
      ...row,
      ingredient_id: row.ingredient_id as string,
      supplier_id: row.supplier_id as string,
      purchase_unit_id: row.purchase_unit_id as string | null,
      ingredientName: ingredient?.name ?? "",
      ingredientSlug: ingredient?.slug ?? "",
      supplierName: supplier?.name ?? "",
      supplierCode: supplier?.code ?? null,
      purchaseUnitSymbol: purchaseUnit?.symbol ?? null,
      normalizedCost,
    } as unknown as SupplierCatalogItem;
  });
}

async function unitSymbolMap(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, symbol")
    .in("id", ids);
  for (const row of data ?? []) map.set(row.id, row.symbol);
  return map;
}

async function enrichSupplier(rows: Supplier[]): Promise<SupplierWithRelations[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const [contactsRows, catalogRows] = await Promise.all([
    supabase
      .from("supplier_contacts")
      .select("supplier_id, id")
      .in("supplier_id", rows.map((row) => row.id)),
    supabase
      .from("ingredient_suppliers")
      .select("supplier_id, is_preferred")
      .in("supplier_id", rows.map((row) => row.id)),
  ]);

  const contactsBySupplier = new Map<string, SupplierContact[]>();
  for (const row of contactsRows.data ?? []) {
    const list = contactsBySupplier.get(row.supplier_id) ?? [];
    list.push(row as SupplierContact);
    contactsBySupplier.set(row.supplier_id, list);
  }
  const preferredBySupplier = new Map<string, boolean>();
  for (const row of catalogRows.data ?? []) {
    if (row.is_preferred) preferredBySupplier.set(row.supplier_id, true);
  }

  return rows.map((row) => {
    const contacts = contactsBySupplier.get(row.id) ?? [];
    const catalogCount = catalogRows.data?.filter(
      (c) => c.supplier_id === row.id
    ).length ?? 0;
    return {
      ...row,
      contacts,
      catalogCount,
      hasPreferredItems: preferredBySupplier.get(row.id) ?? false,
    };
  });
}