import { z } from "zod";
import {
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_ADJUSTMENT_TYPES,
} from "../lib/stock-adjustments/status";

const uuidSchema = z.string().uuid({ message: "validation.invalidValue" });

const optionalLongTextSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const optionalShortTextSchema = z
  .string()
  .trim()
  .max(100, { message: "validation.maxLength" })
  .nullable()
  .optional();

/** A positive quantity in any unit compatible with the ingredient base unit. */
const adjustmentQuantitySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "stockAdjustmentValidation.quantityInvalid" })
  .max(999_999, { message: "validation.maxValue" });

const adjustmentDateSchema = z
  .string({ message: "stockAdjustmentValidation.dateInvalid" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "stockAdjustmentValidation.dateInvalid",
  });

/** One drafted line (consumed by create + add-item). */
export const stockAdjustmentItemInputSchema = z.object({
  ingredientId: uuidSchema,
  quantity: adjustmentQuantitySchema,
  unitId: uuidSchema.nullable().optional(),
});

/** Draft header creation (number/status/totals are server-controlled). */
export const createStockAdjustmentSchema = z.object({
  establishmentId: uuidSchema,
  inventoryLocationId: uuidSchema,
  adjustmentType: z.enum(STOCK_ADJUSTMENT_TYPES, {
    message: "stockAdjustmentValidation.typeInvalid",
  }),
  adjustmentDate: adjustmentDateSchema,
  reasonId: uuidSchema.nullable().optional(),
  notes: optionalLongTextSchema,
  internalReference: optionalShortTextSchema,
  items: z
    .array(stockAdjustmentItemInputSchema)
    .min(1, { message: "stockAdjustmentValidation.empty" })
    .max(10_000),
});

export const addStockAdjustmentItemSchema = z.object({
  establishmentId: uuidSchema,
  adjustmentId: uuidSchema,
  ingredientId: uuidSchema,
  quantity: adjustmentQuantitySchema,
  unitId: uuidSchema.nullable().optional(),
});

export const updateStockAdjustmentItemSchema = z.object({
  establishmentId: uuidSchema,
  adjustmentId: uuidSchema,
  itemId: uuidSchema,
  quantity: adjustmentQuantitySchema,
  unitId: uuidSchema.nullable().optional(),
});

export const removeStockAdjustmentItemSchema = z.object({
  establishmentId: uuidSchema,
  adjustmentId: uuidSchema,
  itemId: uuidSchema,
});

/** Header workflow transitions (submit/approve/validate/cancel/delete). */
export const stockAdjustmentActionSchema = z.object({
  adjustmentId: uuidSchema,
  reason: optionalLongTextSchema,
});

export const stockAdjustmentStatusSchema = z.enum(STOCK_ADJUSTMENT_STATUSES, {
  message: "stockAdjustmentValidation.statusInvalid",
});

export const stockAdjustmentTypeSchema = z.enum(STOCK_ADJUSTMENT_TYPES, {
  message: "stockAdjustmentValidation.typeInvalid",
});

export const stockAdjustmentFiltersSchema = z.object({
  query: z.string().trim().max(120).nullable().optional(),
  locationId: uuidSchema.nullable().optional(),
  type: z.enum(STOCK_ADJUSTMENT_TYPES).nullable().optional(),
  status: z.enum(STOCK_ADJUSTMENT_STATUSES).nullable().optional(),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
  page: z.coerce.number().int().min(1).nullable().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).nullable().optional(),
});

export type CreateStockAdjustmentValidated = z.infer<
  typeof createStockAdjustmentSchema
>;
export type AddStockAdjustmentItemValidated = z.infer<
  typeof addStockAdjustmentItemSchema
>;
export type UpdateStockAdjustmentItemValidated = z.infer<
  typeof updateStockAdjustmentItemSchema
>;
export type RemoveStockAdjustmentItemValidated = z.infer<
  typeof removeStockAdjustmentItemSchema
>;
export type StockAdjustmentActionValidated = z.infer<
  typeof stockAdjustmentActionSchema
>;
export type StockAdjustmentStatusValidated = z.infer<
  typeof stockAdjustmentStatusSchema
>;