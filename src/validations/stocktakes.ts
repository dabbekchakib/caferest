import { z } from "zod";
import {
  STOCKTAKE_MODES,
  STOCKTAKE_SCOPES,
  STOCKTAKE_STATUSES,
} from "../lib/stocktakes/status";

const uuidSchema = z.string().uuid({ message: "validation.invalidValue" });

const optionalLongTextSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const quantitySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(999_999, { message: "validation.maxValue" });

/** Draft header creation (number + status are server-controlled). */
export const createStocktakeSchema = z.object({
  establishmentId: uuidSchema,
  inventoryLocationId: uuidSchema,
  mode: z.enum(STOCKTAKE_MODES, {
    message: "stocktakeValidation.modeInvalid",
  }),
  notes: optionalLongTextSchema,
});

export const startStocktakeSchema = z.object({
  establishmentId: uuidSchema,
  stocktakeId: uuidSchema,
  scope: z.enum(STOCKTAKE_SCOPES, {
    message: "stocktakeValidation.scopeInvalid",
  }),
  includeZeroStock: z.boolean(),
  ingredientIds: z.array(uuidSchema).max(10_000),
});

/**
 * One physical count. `amount` is expressed in `unitId` (any unit compatible
 * with the ingredient base unit); NULL clears a previously captured count.
 */
export const stocktakeCountSchema = z.object({
  establishmentId: uuidSchema,
  stocktakeId: uuidSchema,
  itemId: uuidSchema,
  amount: quantitySchema.nullable(),
  unitId: uuidSchema.nullable(),
});

/** Header workflow transitions (start/complete/approve/validate/cancel/delete). */
export const stocktakeActionSchema = z.object({
  stocktakeId: uuidSchema,
  reason: optionalLongTextSchema,
});

export const stocktakeStatusSchema = z.enum(STOCKTAKE_STATUSES, {
  message: "stocktakeValidation.statusInvalid",
});

export const stocktakeFiltersSchema = z.object({
  query: z.string().trim().max(120).nullable().optional(),
  locationId: uuidSchema.nullable().optional(),
  mode: z.enum(STOCKTAKE_MODES).nullable().optional(),
  status: z.enum(STOCKTAKE_STATUSES).nullable().optional(),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
  page: z.coerce.number().int().min(1).nullable().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).nullable().optional(),
});

export type CreateStocktakeValidated = z.infer<typeof createStocktakeSchema>;
export type StartStocktakeValidated = z.infer<typeof startStocktakeSchema>;
export type StocktakeCountValidated = z.infer<typeof stocktakeCountSchema>;
export type StocktakeActionValidated = z.infer<typeof stocktakeActionSchema>;
export type StocktakeStatusValidated = z.infer<typeof stocktakeStatusSchema>;