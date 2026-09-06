import { z } from "zod";
import {
  DINING_TABLE_SHAPES,
  DINING_TABLE_STATUSES,
  TABLE_MIN_SIZE,
} from "../lib/tables/status";
import { FLOOR_PLAN_SIZE } from "../lib/floor-plan/geometry";

export const diningLocaleSchema = z.enum(["fr", "en", "ar"]);

export const diningSlugSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(80, { message: "validation.maxLength" })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "validation.regex" });

const diningColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: "validation.regex" })
  .nullable()
  .optional();

const diningTranslationSchema = z.object({
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

const diningTranslationsSchema = z
  .object({
    fr: diningTranslationSchema.optional(),
    en: diningTranslationSchema.optional(),
    ar: diningTranslationSchema.optional(),
  })
  .optional();

export const createDiningAreaSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(80, { message: "validation.maxLength" }),
  slug: diningSlugSchema,
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  color: diningColorSchema,
  icon: z
    .string()
    .trim()
    .max(40, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  sortOrder: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .optional(),
  isActive: z.boolean().optional(),
  translations: diningTranslationsSchema,
});

export type CreateDiningAreaValues = z.infer<typeof createDiningAreaSchema>;

export const updateDiningAreaSchema = createDiningAreaSchema.extend({
  diningAreaId: z.string().uuid({ message: "validation.invalidValue" }),
  name: createDiningAreaSchema.shape.name.optional(),
  slug: diningSlugSchema.optional(),
});

export type UpdateDiningAreaValues = z.infer<typeof updateDiningAreaSchema>;

export const deleteDiningAreaSchema = z.object({
  diningAreaId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export const reorderDiningAreasSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  orderedIds: z
    .array(z.string().uuid({ message: "validation.invalidValue" }))
    .min(1, { message: "validation.required" })
    .max(500, { message: "validation.maxLength" }),
});

export type ReorderDiningAreasValues = z.infer<
  typeof reorderDiningAreasSchema
>;

export const setDiningAreaStatusSchema = z.object({
  diningAreaId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

const tableShapeSchema = z.enum(DINING_TABLE_SHAPES, {
  message: "validation.invalidValue",
});

const tableStatusSchema = z.enum(DINING_TABLE_STATUSES, {
  message: "validation.invalidValue",
});

const tableNumberSchema = z
  .string()
  .trim()
  .max(20, { message: "validation.maxLength" })
  .nullable()
  .optional();

const tableColorSchema = diningColorSchema;

const tableDimensionSchema = z
  .number()
  .min(TABLE_MIN_SIZE, { message: "validation.minValue" })
  .max(FLOOR_PLAN_SIZE, { message: "validation.maxValue" })
  .nullable()
  .optional();

const tablePositionSchema = z
  .number()
  .min(0, { message: "validation.minValue" })
  .max(FLOOR_PLAN_SIZE, { message: "validation.maxValue" })
  .nullable()
  .optional();

export const createTableSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(80, { message: "validation.maxLength" }),
  slug: diningSlugSchema,
  tableNumber: tableNumberSchema,
  areaId: z
    .string()
    .uuid({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
  capacity: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(1, { message: "validation.minValue" })
    .max(10_000, { message: "validation.maxValue" })
    .optional(),
  shape: tableShapeSchema.optional(),
  positionX: tablePositionSchema,
  positionY: tablePositionSchema,
  width: tableDimensionSchema,
  height: tableDimensionSchema,
  rotation: z
    .number()
    .min(0, { message: "validation.minValue" })
    .max(360, { message: "validation.maxValue" })
    .optional(),
  color: tableColorSchema,
  sortOrder: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(2_147_483_647, { message: "validation.maxValue" })
    .optional(),
  status: tableStatusSchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateTableValues = z.infer<typeof createTableSchema>;

export const updateTableSchema = createTableSchema.extend({
  tableId: z.string().uuid({ message: "validation.invalidValue" }),
  name: createTableSchema.shape.name.optional(),
  slug: diningSlugSchema.optional(),
});

export type UpdateTableValues = z.infer<typeof updateTableSchema>;

export const deleteTableSchema = z.object({
  tableId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export const setTableStatusSchema = z.object({
  tableId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  status: tableStatusSchema,
});

export const duplicateTableSchema = z.object({
  tableId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

const floorPatchSchema = z.object({
  tableId: z.string().uuid({ message: "validation.invalidValue" }),
  areaId: z
    .string()
    .uuid({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
  positionX: tablePositionSchema,
  positionY: tablePositionSchema,
  width: tableDimensionSchema,
  height: tableDimensionSchema,
  rotation: z
    .number()
    .min(0, { message: "validation.minValue" })
    .max(360, { message: "validation.maxValue" })
    .optional(),
});

export const updateTableFloorPlanSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  patches: z
    .array(floorPatchSchema)
    .min(1, { message: "validation.required" })
    .max(1000, { message: "validation.maxLength" }),
});

export type UpdateTableFloorPlanValues = z.infer<
  typeof updateTableFloorPlanSchema
>;