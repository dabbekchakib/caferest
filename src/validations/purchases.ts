import { z } from "zod";
import { PURCHASE_ORDER_STATUSES } from "../lib/purchases/status";

const moneySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(99_999_999, { message: "validation.maxValue" });

const quantitySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .positive({ message: "validation.minValue" })
  .max(999_999, { message: "validation.maxValue" });

const uuidSchema = z.string().uuid({ message: "validation.invalidValue" });

const optionalUuidSchema = z
  .string()
  .uuid({ message: "validation.invalidValue" })
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

const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, { message: "validation.minLength" })
  .max(3, { message: "validation.maxLength" })
  .regex(/^[A-Z]{3}$/, { message: "validation.invalidValue" });

/** Mirror of the DB `discount_type` CHECK ('none' | 'percentage' | 'fixed'). */
export const lineDiscountTypeSchema = z.enum(["none", "percentage", "fixed"], {
  message: "purchaseOrderValidation.discountTypeInvalid",
});

export const purchaseOrderLineBaseSchema = z.object({
  ingredientId: uuidSchema,
  ingredientSupplierId: uuidSchema,
  description: optionalTextSchema,
  supplierSku: optionalTextSchema,
  quantity: quantitySchema,
  purchaseUnitId: optionalUuidSchema,
  unitPrice: moneySchema,
  discountType: lineDiscountTypeSchema,
  discountValue: moneySchema,
  taxId: optionalUuidSchema,
  taxRate: z.coerce
    .number({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" })
    .max(10_000, { message: "validation.maxValue" }),
  notes: optionalLongTextSchema,
  sortOrder: z.coerce
    .number({ message: "validation.invalidValue" })
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" }),
});

function lineDiscountRule(parsed: z.infer<typeof purchaseOrderLineBaseSchema>) {
  const gross = parsed.quantity * parsed.unitPrice;
  if (parsed.discountType === "percentage") {
    if (parsed.discountValue > 100) {
      return { path: ["discountValue"], message: "purchaseOrderValidation.discountMax" };
    }
  } else if (parsed.discountType === "fixed") {
    if (parsed.discountValue > gross) {
      return {
        path: ["discountValue"],
        message: "purchaseOrderValidation.discountExceedsGross",
      };
    }
  } else if (parsed.discountType === "none" && parsed.discountValue !== 0) {
    return { path: ["discountValue"], message: "purchaseOrderValidation.discountNone" };
  }
  return null;
}

export const purchaseOrderLineSchema =
  purchaseOrderLineBaseSchema.superRefine((parsed, ctx) => {
    const issue = lineDiscountRule(parsed);
    if (issue) {
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
  });

export const purchaseOrderLineInputSchema = z
  .array(purchaseOrderLineSchema)
  .nonempty({ message: "purchaseOrderValidation.noItems" });

export const createPurchaseOrderSchema = z.object({
  establishmentId: uuidSchema,
  supplierId: uuidSchema,
  orderDate: z.coerce.date({ message: "validation.invalidValue" }),
  expectedDeliveryDate: z.coerce
    .date({ message: "validation.invalidValue" })
    .nullable()
    .optional(),
  currencyCode: currencyCodeSchema,
  shippingAmount: moneySchema,
  otherCharges: moneySchema,
  notes: optionalLongTextSchema,
  internalNotes: optionalLongTextSchema,
  supplierNotes: optionalLongTextSchema,
  shippingAddress: optionalLongTextSchema,
  billingAddress: optionalLongTextSchema,
  items: purchaseOrderLineInputSchema,
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
  .omit({ establishmentId: true })
  .extend({ id: uuidSchema });

export const purchaseOrderActionSchema = z.object({
  id: uuidSchema,
  reason: optionalLongTextSchema,
});

export const purchaseOrderStatusSchema = z.enum(PURCHASE_ORDER_STATUSES, {
  message: "purchaseOrderValidation.statusInvalid",
});

export type PurchaseOrderLineValidated = z.infer<
  typeof purchaseOrderLineSchema
>;
export type CreatePurchaseOrderValidated = z.infer<
  typeof createPurchaseOrderSchema
>;
export type UpdatePurchaseOrderValidated = z.infer<
  typeof updatePurchaseOrderSchema
>;
export type PurchaseOrderActionValidated = z.infer<
  typeof purchaseOrderActionSchema
>;