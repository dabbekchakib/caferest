/**
 * Schémas de validation Zod du module POS (Phase 19).
 *
 * Tous les « inputs » des server actions passent par ici — le serveur ne fait
 * jamais confiance au navigateur (montants recalculés, identifiants vérifiés).
 */

import { z } from "zod";
import { ORDER_STATUSES, SALE_TYPES } from "../lib/pos/config";

export const posUuidSchema = z.string().uuid();

export const posQuantitySchema = z.number().positive().max(99999);

export const posCartItemSchema = z.object({
  productId: posUuidSchema,
  quantity: posQuantitySchema,
});

/** Création d'une commande (panier envoyé au serveur). */
export const createOrderSchema = z.object({
  clientOperationId: z.string().trim().min(1).max(64).nullable().optional(),
  orderType: z.enum(SALE_TYPES),
  tableId: posUuidSchema.nullable().optional(),
  diningAreaId: posUuidSchema.nullable().optional(),
  customerId: posUuidSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  discountAmount: z.number().min(0),
  items: z.array(posCartItemSchema).min(1).max(200),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Remplacement atomique des lignes (draft / open). */
export const updateOrderItemsSchema = z.object({
  orderId: posUuidSchema,
  items: z.array(posCartItemSchema).min(1).max(200),
});
export type UpdateOrderItemsInput = z.infer<typeof updateOrderItemsSchema>;

/** Mise à jour des métadonnées + remise. */
export const updateOrderDetailsSchema = z.object({
  orderId: posUuidSchema,
  orderType: z.enum(SALE_TYPES).optional(),
  tableId: posUuidSchema.nullable().optional(),
  diningAreaId: posUuidSchema.nullable().optional(),
  customerId: posUuidSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  discountAmount: z.number().min(0).optional(),
});
export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;

/** Transition de statut (confirmer / attendre / annuler). */
export const transitionOrderSchema = z.object({
  orderId: posUuidSchema,
  toStatus: z.enum(ORDER_STATUSES),
  clientOperationId: z.string().trim().min(1).max(64).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;

/** Référence simple vers une commande. */
export const orderRefSchema = z.object({
  orderId: posUuidSchema,
});
export type OrderRefInput = z.infer<typeof orderRefSchema>;

/** Recherche produit (nom / code-barres). */
export const posSearchSchema = z.string().trim().min(1).max(80);