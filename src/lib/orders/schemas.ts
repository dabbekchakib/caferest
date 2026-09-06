/**
 * Schémas de validation du module commandes (purs, testables, Zod).
 *
 * Les inputs des server actions du module commandes passent ici : statuts,
 * filtres de liste, ordres de fusion et de séparation. Le serveur recalculera
 * toujours les montants et vérifiera les identifiants (jamais de confiance au
 * navigateur).
 */

import { z } from "zod";
import { SALE_TYPES } from "../pos/config";
import { ALL_ORDER_STATUSES } from "./workflow";
import { posUuidSchema } from "../../validations/pos";

export const orderStatusSchema = z.enum(ALL_ORDER_STATUSES);
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

/** Filtres de la liste des commandes (/orders). */
export const orderListFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(15),
  query: z.string().trim().max(60).nullable().optional(),
  status: orderStatusSchema.optional(),
  orderType: z.enum(SALE_TYPES).optional(),
  tableId: posUuidSchema.optional(),
  customerId: posUuidSchema.optional(),
});
export type OrderListFiltersInput = z.infer<typeof orderListFiltersSchema>;

/** Fusion de deux commandes (source → cible). */
export const mergeOrdersSchema = z
  .object({
    sourceOrderId: posUuidSchema,
    targetOrderId: posUuidSchema,
  })
  .refine((v) => v.sourceOrderId !== v.targetOrderId, {
    path: ["targetOrderId"],
    message: "same_order",
  });
export type MergeOrdersInput = z.infer<typeof mergeOrdersSchema>;

/** Séparation d'une commande vers une nouvelle commande. */
export const splitOrderSchema = z.object({
  sourceOrderId: posUuidSchema,
  orderType: z.enum(SALE_TYPES),
  clientOperationId: z.string().trim().min(1).max(64).nullable().optional(),
  tableId: posUuidSchema.nullable().optional(),
  diningAreaId: posUuidSchema.nullable().optional(),
  customerId: posUuidSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(posUuidSchema).min(1).max(200),
});
export type SplitOrderInput = z.infer<typeof splitOrderSchema>;