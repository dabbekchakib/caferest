"use server";

import { revalidatePath } from "next/cache";
import {
  createDiningAreaSchema,
  updateDiningAreaSchema,
  deleteDiningAreaSchema,
  reorderDiningAreasSchema,
  setDiningAreaStatusSchema,
} from "@/validations/tables";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import {
  createDiningArea,
  updateDiningArea,
  deleteDiningArea,
  reorderDiningAreas,
  setDiningAreaStatus,
  getDiningArea,
  type DiningAreaTranslationInput,
} from "@/services/tables-service";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";
import { AuthorizationError } from "@/lib/authorization/errors";

type LocaleField = {
  name?: string;
  description?: string | null;
};

function toTranslationRows(translations?: {
  fr?: LocaleField;
  en?: LocaleField;
  ar?: LocaleField;
}): DiningAreaTranslationInput[] {
  const rows: DiningAreaTranslationInput[] = [];
  (["fr", "en", "ar"] as const).forEach((locale) => {
    const entry = translations?.[locale];
    if (!entry) return;
    rows.push({
      locale,
      name: entry.name?.trim(),
      description:
        entry.description != null ? entry.description.trim() : entry.description,
    });
  });
  return rows;
}

export async function createDiningAreaAction(input: {
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  translations?: { fr?: LocaleField; en?: LocaleField; ar?: LocaleField };
}): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createDiningAreaSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("dining_areas.create");

    const { establishmentId: estId, translations, ...rest } = parsed.data;
    const created = await createDiningArea(estId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    await writeAudit({
      action: "dining_area.created",
      establishmentId: estId,
      entityType: "dining_area",
      entityId: created.id,
      newValues: { name: created.name, slug: created.slug },
    });

    revalidatePath("/dining-areas");
    revalidatePath("/floor-plan");
    return ok({ id: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function updateDiningAreaAction(input: {
  diningAreaId: string;
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  translations?: { fr?: LocaleField; en?: LocaleField; ar?: LocaleField };
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateDiningAreaSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("dining_areas.update");

    const {
      diningAreaId,
      establishmentId: estId,
      translations,
      ...rest
    } = parsed.data;

    const existing = await getDiningArea(estId, diningAreaId);
    if (!existing) return fail(new AuthorizationError("RESOURCE_NOT_FOUND"));

    await updateDiningArea(estId, diningAreaId, {
      ...rest,
      translations: toTranslationRows(translations),
    });

    await writeAudit({
      action: "dining_area.updated",
      establishmentId: estId,
      entityType: "dining_area",
      entityId: diningAreaId,
      newValues: {
        name: rest.name,
        slug: rest.slug,
        color: rest.color,
        icon: rest.icon,
        is_active: rest.isActive,
      },
    });

    revalidatePath("/dining-areas");
    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDiningAreaAction(input: {
  diningAreaId: string;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = deleteDiningAreaSchema.safeParse({ ...input, establishmentId });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("dining_areas.delete");
    await deleteDiningArea(establishmentId, parsed.data.diningAreaId);

    await writeAudit({
      action: "dining_area.deleted",
      establishmentId,
      entityType: "dining_area",
      entityId: parsed.data.diningAreaId,
    });

    revalidatePath("/dining-areas");
    revalidatePath("/floor-plan");
    revalidatePath("/tables");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function reorderDiningAreasAction(input: {
  orderedIds: string[];
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = reorderDiningAreasSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("dining_areas.reorder");
    await reorderDiningAreas(establishmentId, parsed.data.orderedIds);

    await writeAudit({
      action: "dining_area.reordered",
      establishmentId,
      entityType: "dining_area",
      newValues: { orderedIds: parsed.data.orderedIds },
    });

    revalidatePath("/dining-areas");
    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function setDiningAreaStatusAction(input: {
  diningAreaId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = setDiningAreaStatusSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("dining_areas.update");
    await setDiningAreaStatus(
      establishmentId,
      parsed.data.diningAreaId,
      parsed.data.isActive
    );

    await writeAudit({
      action: parsed.data.isActive
        ? "dining_area.activated"
        : "dining_area.deactivated",
      establishmentId,
      entityType: "dining_area",
      entityId: parsed.data.diningAreaId,
      newValues: { is_active: parsed.data.isActive },
    });

    revalidatePath("/dining-areas");
    revalidatePath("/floor-plan");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}