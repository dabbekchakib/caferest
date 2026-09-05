"use server";

import { revalidatePath } from "next/cache";
import {
  createSupplierSchema,
  updateSupplierSchema,
  deleteSupplierSchema,
  supplierStatusSchema,
  createIngredientSupplierSchema,
  updateIngredientSupplierSchema,
  removeIngredientSupplierSchema,
  setPreferredSupplierSchema,
} from "@/validations/suppliers";
import {
  requirePermission,
  requireCurrentEstablishment,
  getAuthorizationContext,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import { AuthorizationError } from "@/lib/authorization/errors";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  setSupplierStatus,
  addIngredientSupplier,
  updateIngredientSupplier,
  removeIngredientSupplier,
  setPreferredSupplier,
  getIngredientSupplierById,
} from "@/services/suppliers-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

function toTrimmedOrNull(value?: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Supplier CRUD
// ---------------------------------------------------------------------------

export async function createSupplierAction(input: {
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
  contacts?: Array<{
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    is_primary?: boolean;
    is_active?: boolean;
  }>;
}): Promise<ActionResult<{ id: string; code: string | null }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.create");

    const { contacts, establishmentId: estId, ...rest } = parsed.data;
    const context = await getAuthorizationContext();
    const created = await createSupplier(estId, context.userId, {
      ...rest,
      contacts: (contacts ?? []).map((contact) => ({
        ...contact,
        email: toTrimmedOrNull(contact.email),
      })),
    });

    await writeAudit({
      action: "supplier.created",
      establishmentId: estId,
      entityType: "supplier",
      entityId: created.id,
      newValues: {
        name: created.name,
        code: created.code,
        city: created.city,
      },
    });

    revalidatePath("/suppliers");
    return ok({ id: created.id, code: created.code });
  } catch (error) {
    return fail(error);
  }
}

export async function updateSupplierAction(input: {
  supplierId: string;
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
  contacts?: Array<{
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    is_primary?: boolean;
    is_active?: boolean;
  }>;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.update");

    const {
      supplierId,
      establishmentId: estId,
      contacts,
      ...rest
    } = parsed.data;

    const context = await getAuthorizationContext();
    await updateSupplier(estId, supplierId, context.userId, {
      ...rest,
      contacts: (contacts ?? []).map((contact) => ({
        ...contact,
        email: toTrimmedOrNull(contact.email),
      })),
    });

    await writeAudit({
      action: "supplier.updated",
      establishmentId: estId,
      entityType: "supplier",
      entityId: supplierId,
      newValues: {
        name: rest.name,
        city: rest.city,
        isActive: rest.isActive,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/suppliers/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteSupplierAction(input: {
  supplierId: string;
}): Promise<ActionResult<{ softDeleted: boolean }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.delete");
    const result = await deleteSupplier(
      establishmentId,
      parsed.data.supplierId
    );

    await writeAudit({
      action: result.softDeleted ? "supplier.deactivated" : "supplier.deleted",
      establishmentId,
      entityType: "supplier",
      entityId: parsed.data.supplierId,
      newValues: { softDeleted: result.softDeleted },
    });

    revalidatePath("/suppliers");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function setSupplierStatusAction(input: {
  supplierId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = supplierStatusSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.activate");
    await setSupplierStatus(
      establishmentId,
      parsed.data.supplierId,
      parsed.data.isActive
    );

    await writeAudit({
      action: parsed.data.isActive
        ? "supplier.activated"
        : "supplier.deactivated",
      establishmentId,
      entityType: "supplier",
      entityId: parsed.data.supplierId,
    });

    revalidatePath("/suppliers");
    revalidatePath("/suppliers/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Supplier catalog
// ---------------------------------------------------------------------------

export async function addIngredientSupplierAction(input: {
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
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createIngredientSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.manage_catalog");

    const {
      establishmentId: estId,
      purchaseUnitId,
      ...rest
    } = parsed.data;
    const created = await addIngredientSupplier(estId, {
      ...rest,
      purchaseUnitId: purchaseUnitId as string,
    });

    await writeAudit({
      action: "ingredient_supplier.created",
      establishmentId: estId,
      entityType: "ingredient_supplier",
      entityId: created.id,
      newValues: {
        ingredientId: created.ingredient_id,
        supplierId: created.supplier_id,
        purchasePrice: created.purchase_price,
        currencyCode: created.currency_code,
        isPreferred: created.is_preferred,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateIngredientSupplierAction(input: {
  ingredientSupplierId: string;
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
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateIngredientSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.manage_catalog");

    const {
      ingredientSupplierId,
      establishmentId: estId,
      ...rest
    } = parsed.data;

    const pricingChanged =
      rest.purchasePrice !== undefined ||
      rest.purchaseQuantity !== undefined ||
      rest.currencyCode !== undefined ||
      rest.purchaseUnitId !== undefined;

    if (pricingChanged) {
      await requirePermission("suppliers.update_prices");
    }

    const existing = await getIngredientSupplierById(
      estId,
      ingredientSupplierId
    );
    if (!existing) return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));

    const beforePrice = Number(existing.purchase_price);
    await updateIngredientSupplier(estId, ingredientSupplierId, rest);

    const after = await getIngredientSupplierById(estId, ingredientSupplierId);
    const afterPrice = after ? Number(after.purchase_price) : beforePrice;

    await writeAudit({
      action:
        pricingChanged && afterPrice !== beforePrice
          ? "supplier_price.updated"
          : "ingredient_supplier.updated",
      establishmentId: estId,
      entityType: "ingredient_supplier",
      entityId: ingredientSupplierId,
      newValues: {
        ingredientId: rest.ingredientId,
        supplierId: rest.supplierId,
        purchasePrice: afterPrice,
        isPreferred: rest.isPreferred ?? false,
        isActive: rest.isActive,
      },
    });

    if (rest.isPreferred) {
      await writeAudit({
        action: "ingredient_supplier.preferred",
        establishmentId: estId,
        entityType: "ingredient_supplier",
        entityId: ingredientSupplierId,
        newValues: { isPreferred: true },
      });
    }

    revalidatePath("/suppliers");
    revalidatePath("/suppliers/[id]", "page");
    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function removeIngredientSupplierAction(input: {
  ingredientSupplierId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = removeIngredientSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.manage_catalog");
    await removeIngredientSupplier(
      establishmentId,
      parsed.data.ingredientSupplierId
    );

    await writeAudit({
      action: "ingredient_supplier.deleted",
      establishmentId,
      entityType: "ingredient_supplier",
      entityId: parsed.data.ingredientSupplierId,
    });

    revalidatePath("/suppliers");
    revalidatePath("/suppliers/[id]", "page");
    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setPreferredSupplierAction(input: {
  ingredientSupplierId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setPreferredSupplierSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("suppliers.manage_catalog");
    await setPreferredSupplier(establishmentId, parsed.data.ingredientSupplierId);

    await writeAudit({
      action: "ingredient_supplier.preferred",
      establishmentId,
      entityType: "ingredient_supplier",
      entityId: parsed.data.ingredientSupplierId,
    });

    revalidatePath("/suppliers");
    revalidatePath("/suppliers/[id]", "page");
    revalidatePath("/ingredients");
    revalidatePath("/ingredients/[id]", "page");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}