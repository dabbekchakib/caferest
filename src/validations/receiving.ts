import { z } from "zod";
import { GOODS_RECEIPT_STATUSES } from "../lib/receiving/status";

const uuidSchema = z.string().uuid({ message: "validation.invalidValue" });

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

const quantitySchema = z.coerce
  .number({ message: "validation.invalidValue" })
  .min(0, { message: "validation.minValue" })
  .max(999_999, { message: "validation.maxValue" });

const dateSchema = z.coerce
  .date({ message: "validation.invalidValue" })
  .nullable()
  .optional();

/** One receipt line. Quantities are user inputs; everything else is a DB snapshot. */
export const goodsReceiptLineSchema = z.object({
  purchaseOrderItemId: uuidSchema,
  ingredientId: uuidSchema,
  receivedQuantity: quantitySchema,
  acceptedQuantity: quantitySchema,
  rejectedQuantity: quantitySchema,
  lotNumber: optionalTextSchema,
  batchNumber: optionalTextSchema,
  expiryDate: optionalTextSchema,
  notes: optionalLongTextSchema,
  sortOrder: z.coerce
    .number({ message: "validation.invalidValue" })
    .int({ message: "validation.invalidValue" })
    .min(0, { message: "validation.minValue" }),
});

export const goodsReceiptLineInputSchema = z
  .array(goodsReceiptLineSchema)
  .superRefine((lines, ctx) => {
    if (lines.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "receiptValidation.noItems",
      });
      return;
    }
    lines.forEach((line, index) => {
      if (line.acceptedQuantity + line.rejectedQuantity > line.receivedQuantity) {
        ctx.addIssue({
          code: "custom",
          path: [index, "acceptedQuantity"],
          message: "receiptValidation.splitExceedsReceived",
        });
      }
    });
  });

export const createGoodsReceiptSchema = z.object({
  establishmentId: uuidSchema,
  purchaseOrderId: uuidSchema,
  receiptDate: dateSchema,
  inventoryLocationId: uuidSchema.nullable(),
  deliveryNoteNumber: optionalTextSchema,
  supplierInvoiceNumber: optionalTextSchema,
  notes: optionalLongTextSchema,
  internalNotes: optionalLongTextSchema,
  items: goodsReceiptLineInputSchema,
});

export const updateGoodsReceiptSchema = createGoodsReceiptSchema
  .omit({ establishmentId: true })
  .extend({ id: uuidSchema });

export const goodsReceiptActionSchema = z.object({
  id: uuidSchema,
  reason: optionalLongTextSchema,
});

export const goodsReceiptStatusSchema = z.enum(GOODS_RECEIPT_STATUSES, {
  message: "receiptValidation.statusInvalid",
});

export type GoodsReceiptLineValidated = z.infer<typeof goodsReceiptLineSchema>;
export type CreateGoodsReceiptValidated = z.infer<
  typeof createGoodsReceiptSchema
>;
export type UpdateGoodsReceiptValidated = z.infer<
  typeof updateGoodsReceiptSchema
>;
export type GoodsReceiptActionValidated = z.infer<
  typeof goodsReceiptActionSchema
>;