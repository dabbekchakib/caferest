import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import type { Database } from "@/types/database";
import type {
  Category,
  CategoryWithTranslations,
} from "@/lib/categories/types";
import { groupTranslations } from "@/lib/categories/translations";
import {
  wouldCreateCycle,
  findChildren,
} from "@/lib/categories/tree";

const CATEGORY_IMAGE_BUCKET = "category-images";
const CATEGORY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const CATEGORY_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type DbClient = SupabaseClient<Database>;

export interface CategoryTranslationInput {
  locale: "fr" | "en" | "ar";
  name?: string;
  description?: string | null;
}

export interface CategoryCreateInput {
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  imageUrl?: string | null;
  translations?: CategoryTranslationInput[];
}

export interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
  imageUrl?: string | null;
  translations?: CategoryTranslationInput[];
}

export async function listCategories(
  establishmentId: string
): Promise<CategoryWithTranslations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new AuthorizationError("GENERIC", error.message);
  const rows = (data ?? []) as Category[];
  const grouped = await fetchTranslationsFor(rows.map((c) => c.id));
  return rows.map((c) => ({ ...c, translations: grouped[c.id] ?? {} }));
}

export async function getCategory(
  establishmentId: string,
  categoryId: string
): Promise<CategoryWithTranslations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;

  const category = data as Category;
  const grouped = await fetchTranslationsFor([category.id]);
  return { ...category, translations: grouped[category.id] ?? {} };
}

async function fetchTranslationsFor(
  categoryIds: string[]
): Promise<Record<string, CategoryWithTranslations["translations"]>> {
  if (categoryIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("category_translations")
    .select("*")
    .in("category_id", categoryIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return groupTranslations(data ?? []);
}

async function assertSlugAvailable(
  establishmentId: string,
  slug: string,
  excludingId?: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.id !== excludingId) {
    throw new AuthorizationError("DUPLICATE_SLUG", "duplicate_slug");
  }
}

export async function createCategory(
  establishmentId: string,
  input: CategoryCreateInput
): Promise<Category> {
  const slug = input.slug.trim();
  await assertSlugAvailable(establishmentId, slug);

  const supabase = await createClient();
  if (input.parentId) {
    const { data: parent, error } = await supabase
      .from("categories")
      .select("id")
      .eq("id", input.parentId)
      .eq("establishment_id", establishmentId)
      .maybeSingle();
    if (error) throw new AuthorizationError("GENERIC", error.message);
    if (!parent) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      establishment_id: establishmentId,
      parent_id: input.parentId ?? null,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      color: input.color?.trim() || null,
      sort_order: input.sortOrder ?? 10,
      is_active: input.isActive ?? true,
      is_system: false,
      image_url: input.imageUrl ?? null,
    })
    .select("*")
    .single();

  if (error) throw new AuthorizationError("GENERIC", error.message);
  await upsertTranslations(supabase, data.id, input.translations ?? []);
  return data as Category;
}

async function upsertTranslations(
  supabase: DbClient,
  categoryId: string,
  translations: CategoryTranslationInput[]
): Promise<void> {
  for (const entry of translations) {
    if (!entry.name) {
      if (entry.name === "") {
        const { error: delError } = await supabase
          .from("category_translations")
          .delete()
          .eq("category_id", categoryId)
          .eq("locale", entry.locale);
        if (delError) throw new AuthorizationError("GENERIC", delError.message);
      }
      continue;
    }
    const { error } = await supabase
      .from("category_translations")
      .upsert(
        {
          category_id: categoryId,
          locale: entry.locale,
          name: entry.name.trim(),
          description: entry.description?.trim() || null,
        },
        { onConflict: "category_id,locale" }
      );
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }
}

export async function updateCategory(
  establishmentId: string,
  categoryId: string,
  input: CategoryUpdateInput
): Promise<CategoryWithTranslations> {
  const existing = await getCategory(establishmentId, categoryId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (existing.is_system) {
    throw new AuthorizationError(
      "SYSTEM_CATEGORY_PROTECTED",
      "system_category_protected"
    );
  }

  if (input.slug !== undefined && input.slug !== existing.slug) {
    await assertSlugAvailable(establishmentId, input.slug, categoryId);
  }

  const supabase = await createClient();
  const patch: Record<string, string | boolean | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.icon !== undefined) patch.icon = input.icon?.trim() || null;
  if (input.color !== undefined) patch.color = input.color?.trim() || null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;

  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", categoryId)
    .select("*")
    .single();
  if (error) throw new AuthorizationError("GENERIC", error.message);

  await upsertTranslations(supabase, categoryId, input.translations ?? []);

  let translations = existing.translations;
  if (input.translations && input.translations.length > 0) {
    const grouped = await fetchTranslationsFor([categoryId]);
    translations = grouped[categoryId] ?? {};
  }

  return { ...(data as Category), translations };
}

export async function deleteCategory(
  establishmentId: string,
  categoryId: string
): Promise<void> {
  const existing = await getCategory(establishmentId, categoryId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (existing.is_system) {
    throw new AuthorizationError(
      "SYSTEM_CATEGORY_PROTECTED",
      "system_category_protected"
    );
  }

  const supabase = await createClient();
  const { data: siblings, error: sibError } = await supabase
    .from("categories")
    .select("*")
    .eq("establishment_id", establishmentId);
  if (sibError) throw new AuthorizationError("GENERIC", sibError.message);

  const children = findChildren((siblings ?? []) as Category[], categoryId);
  if (children.length > 0) {
    throw new AuthorizationError(
      "CATEGORY_HAS_CHILDREN",
      "category_has_children"
    );
  }

  const { count, error: refError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  if (refError) throw new AuthorizationError("GENERIC", refError.message);
  if ((count ?? 0) > 0) {
    throw new AuthorizationError("CATEGORY_IN_USE", "category_in_use");
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("is_system", false);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  if (existing.image_url) {
    await removeCategoryImage(existing.image_url).catch(() => undefined);
  }
}

export async function moveCategory(
  category: Category,
  allCategories: Category[],
  parentId: string | null
): Promise<void> {
  if (category.is_system) {
    throw new AuthorizationError(
      "SYSTEM_CATEGORY_PROTECTED",
      "system_category_protected"
    );
  }
  if (wouldCreateCycle(allCategories, category.id, parentId)) {
    throw new AuthorizationError("CATEGORY_CYCLE", "category_cycle");
  }
  if (parentId) {
    const parent = allCategories.find((c) => c.id === parentId);
    if (!parent) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  }

  const supabase = await createClient();
  const maxSort = allCategories
    .filter((c) => c.parent_id === parentId)
    .reduce((max, c) => Math.max(max, c.sort_order), 0);

  const { error } = await supabase
    .from("categories")
    .update({ parent_id: parentId, sort_order: maxSort + 10 })
    .eq("id", category.id);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Re-write the order of a sibling group based on an ordered id list. */
export async function reorderCategories(
  categories: Category[],
  parentId: string | null,
  orderedIds: string[]
): Promise<void> {
  const supabase = await createClient();
  const siblings = categories.filter((c) => c.parent_id === parentId);
  const missing = orderedIds.filter((id) => !siblings.some((s) => s.id === id));
  if (missing.length > 0) throw new AuthorizationError("RESOURCE_NOT_FOUND");

  for (let i = 0; i < orderedIds.length; i += 1) {
    const category = siblings.find((c) => c.id === orderedIds[i])!;
    const nextOrder = (i + 1) * 10;
    if (category.sort_order === nextOrder) continue;
    const { error } = await supabase
      .from("categories")
      .update({ sort_order: nextOrder })
      .eq("id", orderedIds[i]);
    if (error) throw new AuthorizationError("GENERIC", error.message);
  }
}

export async function setCategoryStatus(
  establishmentId: string,
  categoryId: string,
  isActive: boolean
): Promise<void> {
  const existing = await getCategory(establishmentId, categoryId);
  if (!existing) throw new AuthorizationError("RESOURCE_NOT_FOUND");
  if (existing.is_system) {
    throw new AuthorizationError(
      "SYSTEM_CATEGORY_PROTECTED",
      "system_category_protected"
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", categoryId)
    .eq("establishment_id", establishmentId);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

/** Validate + persist a category image; returns the public URL. */
export async function uploadCategoryImage(
  establishmentId: string,
  categoryId: string,
  file: File
): Promise<string> {
  if (file.size > CATEGORY_IMAGE_MAX_BYTES) {
    throw new AuthorizationError("GENERIC", "category_image_too_large");
  }
  if (!CATEGORY_IMAGE_MIMES.has(file.type)) {
    throw new AuthorizationError("GENERIC", "category_image_bad_type");
  }

  const safeName = String(file.name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  const path = `establishments/${establishmentId}/categories/${categoryId}/${Date.now()}_${safeName}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(CATEGORY_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const { data } = supabase.storage
    .from(CATEGORY_IMAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort cleanup of an old stored image file. */
export async function removeCategoryImage(imageUrl: string): Promise<void> {
  const path = extractStoredImagePath(imageUrl);
  if (!path) return;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(CATEGORY_IMAGE_BUCKET)
    .remove([decodeURIComponent(path)]);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

function extractStoredImagePath(imageUrl: string): string | null {
  if (!imageUrl.includes(`/${CATEGORY_IMAGE_BUCKET}/`)) return null;
  const marker = `/${CATEGORY_IMAGE_BUCKET}/`;
  return imageUrl.split(marker)[1] ?? null;
}