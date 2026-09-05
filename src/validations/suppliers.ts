import { z } from "zod";

const moneySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(99_999_999, { message: "validation.maxValue" });

const quantitySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "validation.minValue" })
  .max(999_999_999, { message: "validation.maxValue" });

const nonNegativeIntegerNullableSchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .int({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .nullable()
  .optional();

const optionalTextSchema = z
  .string()
  .trim()
  .max(300, { message: "validation.maxLength" })
  .nullable()
  .optional();

const optionalLongTextSchema = z
  .string()
  .trim()
  .max(1500, { message: "validation.maxLength" })
  .nullable()
  .optional();

const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, { message: "validation.maxLength" })
  .email({ message: "validation.invalidValue" })
  .nullable()
  .optional()
  .or(z.literal(""));

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(30, { message: "validation.maxLength" })
  .regex(/^\+?[0-9 .()-]{6,30}$/, { message: "validation.invalidValue" })
  .nullable()
  .optional()
  .or(z.literal(""));

const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, { message: "validation.minLength" })
  .max(3, { message: "validation.maxLength" })
  .regex(/^[A-Z]{3}$/, { message: "validation.invalidValue" });

export const supplierNameSchema = z
  .string()
  .trim()
  .min(2, { message: "validation.minLength" })
  .max(160, { message: "validation.maxLength" });

export const createSupplierSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  name: supplierNameSchema,
  code: z
    .string()
    .trim()
    .min(1, { message: "validation.minLength" })
    .max(40, { message: "validation.maxLength" })
    .nullable()
    .optional(),
  legalName: optionalTextSchema,
  registrationNumber: optionalTextSchema,
  taxIdentifier: optionalTextSchema,
  phone: optionalPhoneSchema,
  mobile: optionalPhoneSchema,
  email: optionalEmailSchema,
  website: z
    .string()
    .trim()
    .url({ message: "validation.invalidValue" })
    .max(500, { message: "validation.maxLength" })
    .nullable()
    .optional()
    .or(z.literal("")),
  addressLine1: optionalTextSchema,
  addressLine2: optionalTextSchema,
  postalCode: optionalTextSchema,
  city: optionalTextSchema,
  state: optionalTextSchema,
  country: optionalTextSchema,
  contactPerson: optionalTextSchema,
  contactEmail: optionalEmailSchema,
  contactPhone: optionalPhoneSchema,
  paymentTerms: optionalTextSchema,
  defaultPaymentMethodId: z
    .string()
    .uuid({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
  deliveryLeadTimeDays: nonNegativeIntegerNullableSchema,
  minimumOrderAmount: moneySchema.nullable().optional(),
  notes: optionalLongTextSchema,
  isActive: z.boolean().optional(),
  contacts: z
    .array(
      z.object({
        id: z.string().uuid({ message: "validation.invalidValue" }).optional(),
        first_name: optionalTextSchema,
        last_name: optionalTextSchema,
        job_title: optionalTextSchema,
        email: optionalEmailSchema,
        phone: optionalPhoneSchema,
        mobile: optionalPhoneSchema,
        is_primary: z.boolean().optional(),
        is_active: z.boolean().optional(),
      })
    )
    .optional(),
});

export type CreateSupplierValues = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema
  .omit({ establishmentId: true })
  .extend({
    supplierId: z.string().uuid({ message: "validation.invalidValue" }),
    establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  });

export type UpdateSupplierValues = z.infer<typeof updateSupplierSchema>;

export const deleteSupplierSchema = z.object({
  supplierId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type DeleteSupplierValues = z.infer<typeof deleteSupplierSchema>;

export const supplierStatusSchema = z.object({
  supplierId: z.string().uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  isActive: z.boolean(),
});

export type SupplierStatusValues = z.infer<typeof supplierStatusSchema>;

export const createIngredientSupplierSchema = z.object({
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
  ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
  supplierId: z.string().uuid({ message: "validation.invalidValue" }),
  purchaseUnitId: z.string().uuid({ message: "validation.invalidValue" }),
  purchaseQuantity: quantitySchema.default(1),
  purchasePrice: moneySchema.default(0),
  currencyCode: currencyCodeSchema.default("TND"),
  minimumOrderQuantity: moneySchema.nullable().optional(),
  leadTimeDays: nonNegativeIntegerNullableSchema,
  supplierSku: optionalTextSchema,
  supplierBarcode: optionalTextSchema,
  isPreferred: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: optionalLongTextSchema,
});

export type CreateIngredientSupplierValues = z.infer<
  typeof createIngredientSupplierSchema
>;

export const updateIngredientSupplierSchema =
  createIngredientSupplierSchema
    .omit({
      establishmentId: true,
      ingredientId: true,
      supplierId: true,
    })
    .extend({
      ingredientSupplierId: z
        .string()
        .uuid({ message: "validation.invalidValue" }),
      establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
      ingredientId: z.string().uuid({ message: "validation.invalidValue" }),
      supplierId: z.string().uuid({ message: "validation.invalidValue" }),
      purchaseUnitId: z
        .string()
        .uuid({ message: "validation.invalidValue" })
        .nullable()
        .optional(),
    });

export type UpdateIngredientSupplierValues = z.infer<
  typeof updateIngredientSupplierSchema
>;

export const removeIngredientSupplierSchema = z.object({
  ingredientSupplierId: z
    .string()
    .uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type RemoveIngredientSupplierValues = z.infer<
  typeof removeIngredientSupplierSchema
>;

export const setPreferredSupplierSchema = z.object({
  ingredientSupplierId: z
    .string()
    .uuid({ message: "validation.invalidValue" }),
  establishmentId: z.string().uuid({ message: "validation.invalidValue" }),
});

export type SetPreferredSupplierValues = z.infer<
  typeof setPreferredSupplierSchema
>;