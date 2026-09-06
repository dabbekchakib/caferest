/**
 * Construction des payloads envoyés aux RPC de commande (purs, testables).
 *
 * Le serveur re-snapshotte les prix/taxes depuis les tables : ici on ne
 * transmet que les identifiants produits + quantités, jamais des montants.
 */

import { computeOrderTotals } from "./calculations";
import type { CartLine, OrderTotals, PosProduct } from "./types";

export interface RpcItemInput {
  product_id: string;
  quantity: number;
}

export interface BuildOrderOptions {
  clientOperationId: string | null;
  orderType: string;
  tableId: string | null;
  diningAreaId: string | null;
  customerId: string | null;
  notes: string | null;
  discountAmount: number;
}

export interface BuiltOrderInput {
  clientOperationId: string | null;
  orderType: string;
  tableId: string | null;
  diningAreaId: string | null;
  customerId: string | null;
  notes: string | null;
  discountAmount: number;
  items: RpcItemInput[];
  totals: OrderTotals;
}

export function toRpcItems(lines: readonly CartLine[]): RpcItemInput[] {
  return lines.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
  }));
}

export function buildOrderInput(
  lines: readonly CartLine[],
  options: BuildOrderOptions
): BuiltOrderInput {
  return {
    clientOperationId: options.clientOperationId ?? null,
    orderType: options.orderType,
    tableId: options.tableId ?? null,
    diningAreaId: options.diningAreaId ?? null,
    customerId: options.customerId ?? null,
    notes: options.notes ?? null,
    discountAmount: options.discountAmount,
    items: toRpcItems(lines),
    totals: computeOrderTotals(lines, options.discountAmount),
  };
}

export interface ProductCatalogIndex {
  get(productId: string): PosProduct | undefined;
}

export function toCartLines(
  products: readonly PosProduct[],
  quantities: ReadonlyMap<string, number>
): CartLine[] {
  const lines: CartLine[] = [];
  for (const product of products) {
    const quantity = quantities.get(product.id);
    if (!quantity || quantity <= 0) continue;
    lines.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      taxRate: product.taxRate,
      quantity,
    });
  }
  return lines;
}