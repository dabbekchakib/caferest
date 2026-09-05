import { z } from "zod";
import type { UnitType } from "@/types/database";

export const unitTypeSchema = z.enum([
  "mass",
  "volume",
  "count",
  "service",
  "custom",
]);

export const createUnitSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(80, { message: "validation.maxLength" }),
  symbol: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(12, { message: "validation.maxLength" })
    .regex(/^[A-Za-zÀ-ÿ0-9%/·_. ]+$/, { message: "validation.regex" }),
  type: unitTypeSchema,
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  precision: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(6, { message: "validation.maxValue" })
    .default(2),
  isBase: z.boolean().optional(),
});

export type CreateUnitValues = z.infer<typeof createUnitSchema>;

export const updateUnitSchema = z.object({
  unitId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: z
    .string()
    .trim()
    .min(2, { message: "validation.minLength" })
    .max(80, { message: "validation.maxLength" })
    .optional(),
  symbol: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .max(12, { message: "validation.maxLength" })
    .regex(/^[A-Za-zÀ-ÿ0-9%/·_. ]+$/, { message: "validation.regex" })
    .optional(),
  type: unitTypeSchema.optional(),
  description: z
    .string()
    .trim()
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  precision: z
    .number()
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(6, { message: "validation.maxValue" })
    .optional(),
  isBase: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUnitValues = z.infer<typeof updateUnitSchema>;

export const deleteUnitSchema = z.object({
  unitId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteUnitValues = z.infer<typeof deleteUnitSchema>;

export const setUnitStatusSchema = z.object({
  unitId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

export type SetUnitStatusValues = z.infer<typeof setUnitStatusSchema>;

export type { UnitType };