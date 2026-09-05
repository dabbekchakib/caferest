import { z } from "zod";

const uuidNullable = z
  .string()
  .uuid({ message: "validation.invalidValue" })
  .nullable()
  .optional();

const positiveNumeric = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "validation.minValue" })
  .max(999_999_999, { message: "validation.maxValue" })
  .nullable()
  .optional();

const rangeEdge = z.coerce
  .number({ message: "validation.invalidValue" })
  .nonnegative({ message: "validation.minValue" })
  .max(999_999_999, { message: "validation.maxValue" })
  .nullable()
  .optional();

const percentageNumeric = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "validation.minValue" })
  .max(100, { message: "validation.maxValue" })
  .nullable()
  .optional();

const notesSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

/**
 * Upsert payload for one `recipe_yields` row (one per recipe version).
 * The model-completeness and range-ordering rules are validated by the
 * domain validator (`src/lib/yields/validation`) after parsing against the
 * live conversions catalog; this schema guards the SHAPE + boundaries.
 */
export const recipeYieldSchema = z
  .object({
    recipeId: z.string().uuid({ message: "validation.invalidValue" }),
    yieldType: z.enum(
      [
        "exact_consumption",
        "batch_yield",
        "range_yield",
        "portion_yield",
        "percentage_yield",
      ],
      { message: "validation.invalidValue" }
    ),
    inputQuantity: positiveNumeric,
    inputUnitId: uuidNullable,
    outputQuantity: positiveNumeric,
    outputUnitId: uuidNullable,
    minimumYield: rangeEdge,
    standardYield: rangeEdge,
    maximumYield: rangeEdge,
    yieldPercentage: percentageNumeric,
    notes: notesSchema,
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const min = value.minimumYield ?? null;
    const standard = value.standardYield ?? null;
    const max = value.maximumYield ?? null;
    if (min !== null && max !== null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimumYield"],
        message: "yieldValidation.invalidRange",
      });
    }
    if (min !== null && standard !== null && standard < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["standardYield"],
        message: "yieldValidation.invalidRange",
      });
    }
    if (max !== null && standard !== null && standard > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["standardYield"],
        message: "yieldValidation.invalidRange",
      });
    }
    if (
      value.yieldType === "percentage_yield" &&
      (value.yieldPercentage ?? null) === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["yieldPercentage"],
        message: "yieldValidation.modelIncomplete",
      });
    }
    if (
      value.yieldType === "range_yield" &&
      (value.minimumYield ?? null) === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimumYield"],
        message: "yieldValidation.modelIncomplete",
      });
    }
  });

export type RecipeYieldValues = z.infer<typeof recipeYieldSchema>;

/** Action-level payload: validated input + server-owned establishment scope. */
export const saveRecipeYieldSchema = recipeYieldSchema.extend({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type SaveRecipeYieldValues = z.infer<typeof saveRecipeYieldSchema>;

export const recipeYieldActivateSchema = z.object({
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RecipeYieldActivateValues = z.infer<
  typeof recipeYieldActivateSchema
>;

export const recipeYieldDeleteSchema = z.object({
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RecipeYieldDeleteValues = z.infer<typeof recipeYieldDeleteSchema>;

export const recipeYieldCalculateSchema = z.object({
  recipeId: z.string().uuid({ message: "validation.invalidValue" }),
  availableQuantity: z.coerce
    .number({ message: "validation.invalidValue" })
    .nonnegative({ message: "validation.minValue" })
    .max(999_999_999, { message: "validation.maxValue" }),
  availableUnitId: z.string().uuid({ message: "validation.invalidValue" }),
  selection: z
    .enum(["min", "standard", "max"], { message: "validation.invalidValue" })
    .default("standard"),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RecipeYieldCalculateValues = z.infer<
  typeof recipeYieldCalculateSchema
>;