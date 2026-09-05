import { z } from "zod";

const recipeNameSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(120, { message: "validation.maxLength" });

const recipeDescriptionSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const notesSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const uuidNullableSchema = z
  .string()
  .uuid({ message: "validation.invalidValue" })
  .nullable()
  .optional();

const positiveNumberSchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "validation.minValue" })
  .max(999_999_999, { message: "validation.maxValue" });

const wasteSchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(100, { message: "validation.maxValue" });

const translationLocaleSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120, { message: "validation.maxLength" })
    .optional(),
  description: recipeDescriptionSchema,
  notes: notesSchema,
});

const translationsSchema = z
  .object({
    en: translationLocaleSchema.optional(),
    ar: translationLocaleSchema.optional(),
  })
  .optional();

/**
 * One line of the recipe composition: EITHER an ingredient reference OR a
 * sub-recipe reference (never both — the DB enforces the same XOR rule).
 */
export const recipeItemSchema = z
  .object({
    id: z.string().uuid({ message: "validation.invalidValue" }).optional(),
    ingredientId: uuidNullableSchema,
    subRecipeId: uuidNullableSchema,
    quantity: positiveNumberSchema,
    unitId: uuidNullableSchema,
    wastePercentage: wasteSchema.default(0),
    notes: notesSchema,
    sortOrder: z
      .number()
      .int({ message: "validation.invalidValue" })
      .min(0, { message: "validation.minValue" })
      .max(2_147_483_647, { message: "validation.maxValue" })
      .optional(),
  })
  .superRefine((item, ctx) => {
    const hasIngredient = item.ingredientId != null;
    const hasSubRecipe = item.subRecipeId != null;
    if (hasIngredient === hasSubRecipe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ingredientId"],
        message: "recipeValidation.itemRefRequired",
      });
    }
  });

export type RecipeItemValues = z.infer<typeof recipeItemSchema>;

export const recipeItemsSchema = z
  .object({
    establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
    recipeId: z.string().uuid({ message: "validation.invalidValue" }),
    items: z
      .array(recipeItemSchema)
      .max(200, { message: "validation.maxLength" }),
  })
  .superRefine((value, ctx) => {
    // No duplicate ingredient / sub-recipe references within one recipe.
    const seenIngredients = new Set<string>();
    const seenSubRecipes = new Set<string>();
    value.items.forEach((item, index) => {
      if (item.ingredientId) {
        if (seenIngredients.has(item.ingredientId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items", index, "ingredientId"],
            message: "recipeValidation.duplicateItem",
          });
          return;
        }
        seenIngredients.add(item.ingredientId);
      }
      if (item.subRecipeId) {
        if (seenSubRecipes.has(item.subRecipeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items", index, "subRecipeId"],
            message: "recipeValidation.duplicateItem",
          });
          return;
        }
        seenSubRecipes.add(item.subRecipeId);
      }
    });
  });

export type RecipeItemsValues = z.infer<typeof recipeItemsSchema>;

const recipeCoreSchema = z.object({
  name: recipeNameSchema,
  description: recipeDescriptionSchema,
  notes: notesSchema,
  yieldType: z.enum(
    ["exact_consumption", "batch_yield", "range_yield"],
    { message: "validation.invalidValue" }
  ),
  defaultYield: positiveNumberSchema.default(1),
  yieldUnitId: uuidNullableSchema,
  preparationTime: z.coerce
    .number({ message: "validation.invalidValue" })
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .nullable()
    .optional(),
  translations: translationsSchema,
});

export const createRecipeSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  productId: z.string().uuid({ message: "validation.invalidValue" }),
  ...recipeCoreSchema.shape,
});

export type CreateRecipeValues = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
  name: recipeNameSchema.optional(),
  description: recipeDescriptionSchema,
  notes: notesSchema,
  yieldType: z
    .enum(
      ["exact_consumption", "batch_yield", "range_yield"],
      { message: "validation.invalidValue" }
    )
    .optional(),
  defaultYield: positiveNumberSchema.optional(),
  yieldUnitId: uuidNullableSchema,
  preparationTime: z.coerce
    .number({ message: "validation.invalidValue" })
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .nullable()
    .optional(),
  translations: translationsSchema,
});

export type UpdateRecipeValues = z.infer<typeof updateRecipeSchema>;

export const deleteRecipeSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteRecipeValues = z.infer<typeof deleteRecipeSchema>;

export const recipeStatusSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
  status: z.enum(["draft", "active", "inactive", "archived"], {
    message: "validation.invalidValue",
  }),
});

export type RecipeStatusValues = z.infer<typeof recipeStatusSchema>;

export const setDefaultRecipeSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type SetDefaultRecipeValues = z.infer<typeof setDefaultRecipeSchema>;

export const duplicateRecipeSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DuplicateRecipeValues = z.infer<typeof duplicateRecipeSchema>;

export const recipeReorderSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
  orderedIds: z
    .array(z.string().uuid({ message: "validation.invalidValue" }))
    .max(200, { message: "validation.maxLength" }),
});

export type RecipeReorderValues = z.infer<typeof recipeReorderSchema>;

export const recipeCostSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RecipeCostValues = z.infer<typeof recipeCostSchema>;