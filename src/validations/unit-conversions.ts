import { z } from "zod";

export const baseUnitConversionSchema = {
  from_unit_id: z
    .string()
    .uuid({ message: "validation.invalidValue" }),
  to_unit_id: z
    .string()
    .uuid({ message: "validation.invalidValue" }),
  factor: z
    .number({ message: "validation.invalidValue" })
    .positive({ message: "validation.minValue" })
    .max(1e15, { message: "validation.maxValue" }),
  offset: z
    .number({ message: "validation.invalidValue" })
    .max(1e15, { message: "validation.maxValue" })
    .optional(),
  is_active: z.boolean().optional(),
};

export const createUnitConversionSchema = z
  .object(baseUnitConversionSchema)
  .extend({
    establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  })
  .refine((data) => data.from_unit_id !== data.to_unit_id, {
    message: "unitConversions.errors.sameUnit",
    path: ["to_unit_id"],
  });

export type CreateUnitConversionValues = z.infer<
  typeof createUnitConversionSchema
>;

export const updateUnitConversionSchema = z
  .object(baseUnitConversionSchema)
  .extend({
    conversionId: z.string().uuid({ message: "validation.invalidValue" }),
    establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  })
  .refine((data) => data.from_unit_id !== data.to_unit_id, {
    message: "unitConversions.errors.sameUnit",
    path: ["to_unit_id"],
  });

export type UpdateUnitConversionValues = z.infer<
  typeof updateUnitConversionSchema
>;

export const deleteUnitConversionSchema = z.object({
  conversionId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteUnitConversionValues = z.infer<
  typeof deleteUnitConversionSchema
>;

export const setUnitConversionStatusSchema = z.object({
  conversionId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

export type SetUnitConversionStatusValues = z.infer<
  typeof setUnitConversionStatusSchema
>;

/** Target used by the client-side conversion preview widget. */
export const convertQueueSchema = z.object({
  fromUnitId: z.string().uuid({ message: "validation.invalidValue" }),
  toUnitId: z.string().uuid({ message: "validation.invalidValue" }),
  value: z.coerce.number({ message: "validation.invalidValue" }),
});

export type ConvertQueueValues = z.infer<typeof convertQueueSchema>;