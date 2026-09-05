import { z } from "zod";

export const categoryLocaleSchema = z.enum(["fr", "en", "ar"]);

export const categorySlugSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(80, { message: "validation.maxLength" })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "validation.regex" });

const categoryColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: "validation.regex" })
  .nullable()
  .optional();

const translationLocaleSchema = z.object({
  /**
   * Empty string signals "remove this translation row" on update; server-side
   * the master FR name always guarantees a displayable fallback.
   */
  name: z
    .string()
    .trim()
    .max(80, { message: "validation.maxLength" })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
});

const translationsSchema = z
  .object({
    fr: translationLocaleSchema.optional(),
    en: translationLocaleSchema.optional(),
    ar: translationLocaleSchema.optional(),
  })
  .optional();

export const createCategorySchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(80, { message: "validation.maxLength" }),
  slug: categorySlugSchema,
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  parentId: z
    .string()
    .uuid({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
  icon: z
    .string()
    .trim()
    .max(40, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  color: categoryColorSchema,
  sortOrder: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .optional(),
  isActive: z.boolean().optional(),
  translations: translationsSchema,
  imageUrl: z
    .string()
    .url({ message: "validation.invalidValue" })
    .max(2000, { message: "validation.maxLength" })
    .nullable()
    .optional(),
});

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.extend({
  categoryId: z.string().uuid({ message: "validation.invalidValue" }),
  name: createCategorySchema.shape.name.optional(),
  slug: categorySlugSchema.optional(),
});

export type UpdateCategoryValues = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z.object({
  categoryId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteCategoryValues = z.infer<typeof deleteCategorySchema>;

export const moveCategorySchema = z.object({
  categoryId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  parentId: z
    .string()
    .uuid({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
});

export type MoveCategoryValues = z.infer<typeof moveCategorySchema>;

export const reorderCategoriesSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  parentId: z
    .string()
    .uuid({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
  orderedIds: z
    .array(z.string().uuid({ message: "validation.invalidValue" }))
    .min(1, { message: "validation.required" })
    .max(500, { message: "validation.maxLength" }),
});

export type ReorderCategoriesValues = z.infer<typeof reorderCategoriesSchema>;

export const setCategoryStatusSchema = z.object({
  categoryId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

export type SetCategoryStatusValues = z.infer<typeof setCategoryStatusSchema>;

export const removeCategoryImageSchema = z.object({
  categoryId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RemoveCategoryImageValues = z.infer<
  typeof removeCategoryImageSchema
>;