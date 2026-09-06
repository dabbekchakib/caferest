import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SALE_TYPES,
  POS_DISPLAY_TYPES,
  ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  POS_SETTINGS_KEYS,
  POS_SETTINGS_DEFAULTS,
  POS_TRANSITIONS,
  isSaleType,
  isOrderStatus,
  canTransition,
} from "../src/lib/pos/config";
import {
  roundMoney,
  lineSubtotal,
  lineTaxAmount,
  subtotalOf,
  taxOf,
  quantityOf,
  clampDiscount,
  computeOrderTotals,
} from "../src/lib/pos/calculations";
import { toRpcItems, buildOrderInput, toCartLines } from "../src/lib/pos/order-builder";
import {
  createOrderSchema,
  updateOrderItemsSchema,
  updateOrderDetailsSchema,
  transitionOrderSchema,
  orderRefSchema,
  posSearchSchema,
  posUuidSchema,
} from "../src/validations/pos";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";
import {
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
  isPermissionSlug,
  getPermissionsByModule,
} from "../src/lib/authorization/permissions";
import { canAccess, buildPermissionSet } from "../src/lib/authorization/compute";
import type { CartLine } from "../src/lib/pos/types";

const EST = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "44444444-4444-4444-8444-444444444444";
const TABLE = "55555555-5555-4555-8555-555555555555";
const CUSTOMER = "66666666-6666-4666-8666-666666666666";

function line(
  productId: string,
  name: string,
  unitPrice: number,
  taxRate: number,
  quantity: number
): CartLine {
  return { productId, name, unitPrice, taxRate, quantity };
}

test("pos config exposes the sale types and order statuses", () => {
  assert.deepEqual([...SALE_TYPES], [
    "dine_in",
    "takeaway",
    "delivery",
    "counter",
  ]);
  assert.deepEqual([...POS_DISPLAY_TYPES], ["dine_in", "takeaway", "counter"]);
  assert.deepEqual([...ORDER_STATUSES], ["draft", "open", "confirmed", "cancelled"]);
  assert.deepEqual([...OPEN_ORDER_STATUSES], ["open", "confirmed"]);
  assert.equal(isSaleType("takeaway"), true);
  assert.equal(isSaleType("delivery"), true);
  assert.equal(isSaleType("drive"), false);
  assert.equal(isOrderStatus("open"), true);
  assert.equal(isOrderStatus("completed"), false);
});

test("pos transitions follow the defined matrix", () => {
  assert.deepEqual(POS_TRANSITIONS.draft, ["confirmed"]);
  assert.deepEqual(POS_TRANSITIONS.open, ["confirmed", "cancelled"]);
  assert.deepEqual(POS_TRANSITIONS.confirmed, ["open", "cancelled"]);
  assert.deepEqual(POS_TRANSITIONS.cancelled, []);
  assert.equal(canTransition("open", "confirmed"), true);
  assert.equal(canTransition("confirmed", "open"), true);
  assert.equal(canTransition("open", "cancelled"), true);
  assert.equal(canTransition("open", "draft"), false);
  assert.equal(canTransition("cancelled", "open"), false);
});

test("pos settings keys and defaults stay aligned", () => {
  assert.deepEqual(POS_SETTINGS_KEYS, {
    allowDiscount: "pos.allow_discount",
    requireConfirmation: "pos.require_order_confirmation",
    allowNegativeStock: "pos.allow_negative_stock",
  });
  assert.equal(POS_SETTINGS_DEFAULTS.allowDiscount, true);
  assert.equal(POS_SETTINGS_DEFAULTS.requireConfirmation, true);
  assert.equal(POS_SETTINGS_DEFAULTS.allowNegativeStock, false);
});

test("roundMoney uses three decimals", () => {
  assert.equal(roundMoney(1 / 3), 0.333);
  assert.equal(roundMoney(2.3456), 2.346);
  assert.equal(roundMoney(2.3454), 2.345);
  assert.equal(roundMoney(0.0004), 0);
});

test("line helpers compute subtotal, tax and taxable line total", () => {
  assert.equal(lineSubtotal(line(PRODUCT_A, "A", 2.5, 19, 3)), 7.5);
  assert.equal(lineTaxAmount(line(PRODUCT_A, "A", 2.5, 19, 3)), 1.425);
  assert.equal(lineTaxAmount(line(PRODUCT_A, "A", 2.5, 0, 3)), 0);
  assert.equal(
    subtotalOf([line(PRODUCT_A, "A", 2.5, 19, 3)]),
    7.5
  );
  assert.equal(
    subtotalOf([
      line(PRODUCT_A, "A", 2.5, 19, 3),
      line(PRODUCT_B, "B", 4, 0, 1),
    ]),
    11.5
  );
});

test("taxOf and quantityOf aggregate across the cart", () => {
  const cart = [
    line(PRODUCT_A, "A", 10, 19, 2),
    line(PRODUCT_B, "B", 5, 19, 1),
  ];
  assert.equal(taxOf(cart), 4.75);
  assert.equal(quantityOf(cart), 3);
  assert.equal(quantityOf([]), 0);
});

test("clampDiscount keeps the discount inside the subtotal", () => {
  assert.equal(clampDiscount(120, 50), 50);
  assert.equal(clampDiscount(100, 150), 100);
  assert.equal(clampDiscount(100, 0), 0);
  assert.equal(clampDiscount(0, 10), 0);
});

test("computeOrderTotals rolls the full receipt for the cart", () => {
  const cart = [
    line(PRODUCT_A, "A", 10, 19, 2),
    line(PRODUCT_B, "B", 5, 19, 1),
  ];
  const totals = computeOrderTotals(cart, 5);
  assert.equal(totals.quantity, 3);
  assert.equal(totals.subtotal, 25);
  assert.equal(totals.discountAmount, 5);
  assert.equal(totals.taxAmount, 4.75);
  assert.equal(totals.total, 24.75);
});

test("toRpcItems strips cart metadata down to product + quantity", () => {
  const cart = [
    line(PRODUCT_A, "A", 10, 19, 2),
    line(PRODUCT_B, "B", 5, 19, 1),
  ];
  assert.deepEqual(toRpcItems(cart), [
    { product_id: PRODUCT_A, quantity: 2 },
    { product_id: PRODUCT_B, quantity: 1 },
  ]);
});

test("buildOrderInput forwards the client payload to the RPC", () => {
  const cart = [line(PRODUCT_A, "A", 10, 19, 2)];
  const built = buildOrderInput(cart, {
    clientOperationId: "op-123",
    orderType: "dine_in",
    tableId: TABLE,
    diningAreaId: null,
    customerId: CUSTOMER,
    notes: "  Salle 2  ",
    discountAmount: 2,
  });
  assert.equal(built.clientOperationId, "op-123");
  assert.equal(built.orderType, "dine_in");
  assert.equal(built.tableId, TABLE);
  assert.equal(built.customerId, CUSTOMER);
  assert.equal(built.notes, "  Salle 2  ");
  assert.equal(built.discountAmount, 2);
  assert.equal(built.totals.subtotal, 20);
  assert.equal(built.totals.total, 21.8);
});

test("toCartLines only emits lines that have a positive quantity", () => {
  const products = [
    {
      id: PRODUCT_A,
      name: "A",
      price: 10,
      categoryId: null,
      categoryName: null,
      barcode: null,
      sku: null,
      isAvailable: true,
      imageUrl: null,
      taxRate: 0.19,
    },
    {
      id: PRODUCT_B,
      name: "B",
      price: 5,
      categoryId: null,
      categoryName: null,
      barcode: null,
      sku: null,
      isAvailable: true,
      imageUrl: null,
      taxRate: 0,
    },
  ];
  const lines = toCartLines(
    products,
    new Map([
      [PRODUCT_A, 2],
      [PRODUCT_B, 0],
    ])
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productId, PRODUCT_A);
});

test("create order schema accepts a full valid cart payload", () => {
  const result = createOrderSchema.safeParse({
    clientOperationId: "op-123",
    orderType: "dine_in",
    tableId: TABLE,
    diningAreaId: null,
    customerId: CUSTOMER,
    notes: "Menu enfant",
    discountAmount: 2,
    items: [
      { productId: PRODUCT_A, quantity: 2 },
      { productId: PRODUCT_B, quantity: 1 },
    ],
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.items.length, 2);
  assert.equal(result.data?.orderType, "dine_in");

  const badRef = createOrderSchema.safeParse({
    orderType: "dine_in",
    discountAmount: 0,
    items: [{ productId: "junk", quantity: 1 }],
  });
  assert.equal(badRef.success, false);

  const badType = createOrderSchema.safeParse({
    orderType: "drive",
    discountAmount: 0,
    items: [{ productId: PRODUCT_A, quantity: 1 }],
  });
  assert.equal(badType.success, false);

  const emptyItems = createOrderSchema.safeParse({
    orderType: "counter",
    discountAmount: 0,
    items: [],
  });
  assert.equal(emptyItems.success, false);

  const negativeQty = createOrderSchema.safeParse({
    orderType: "counter",
    discountAmount: 0,
    items: [{ productId: PRODUCT_A, quantity: 0 }],
  });
  assert.equal(negativeQty.success, false);
});

test("update and transition schemas constrain their inputs", () => {
  const itemsOk = updateOrderItemsSchema.safeParse({
    orderId: ORDER,
    items: [{ productId: PRODUCT_A, quantity: 3 }],
  });
  assert.equal(itemsOk.success, true);

  const itemsBad = updateOrderItemsSchema.safeParse({
    orderId: "junk",
    items: [],
  });
  assert.equal(itemsBad.success, false);

  const detailsOk = updateOrderDetailsSchema.safeParse({
    orderId: ORDER,
    discountAmount: 5,
  });
  assert.equal(detailsOk.success, true);
  assert.equal(detailsOk.data?.orderType, undefined);

  const transitionOk = transitionOrderSchema.safeParse({
    orderId: ORDER,
    toStatus: "confirmed",
    reason: "Client installé",
  });
  assert.equal(transitionOk.success, true);

  const transitionBad = transitionOrderSchema.safeParse({
    orderId: ORDER,
    toStatus: "shipped",
  });
  assert.equal(transitionBad.success, false);

  const refOk = orderRefSchema.safeParse({ orderId: ORDER });
  assert.equal(refOk.success, true);
  const uuidOk = posUuidSchema.safeParse(EST);
  assert.equal(uuidOk.success, true);
  const refBad = orderRefSchema.safeParse({ orderId: "nope" });
  assert.equal(refBad.success, false);

  const searchOk = posSearchSchema.safeParse("  espresso  ");
  assert.equal(searchOk.success, true);
  assert.equal(searchOk.data, "espresso");
  const searchEmpty = posSearchSchema.safeParse("   ");
  assert.equal(searchEmpty.success, false);
});

test("order RPC errors map to stable domain codes and keys", () => {
  const cases: Record<string, string> = {
    order_not_found: "ORDER_NOT_FOUND",
    order_wrong_status: "ORDER_WRONG_STATUS",
    order_bad_transition: "ORDER_BAD_TRANSITION",
    order_empty: "ORDER_EMPTY",
    order_invalid_type: "ORDER_INVALID_TYPE",
    order_invalid_table: "ORDER_INVALID_TABLE",
    order_invalid_area: "ORDER_INVALID_AREA",
    order_invalid_customer: "ORDER_INVALID_CUSTOMER",
    order_item_invalid: "ORDER_ITEM_INVALID",
    order_discount_invalid: "ORDER_DISCOUNT_INVALID",
    order_discount_forbidden: "ORDER_DISCOUNT_FORBIDDEN",
  };
  for (const [message, code] of Object.entries(cases)) {
    assert.equal(toAuthorizationError({ message }).code, code, message);
  }
  assert.equal(
    authorizationErrorKey("ORDER_NOT_FOUND"),
    "authorization.errors.orderNotFound"
  );
  assert.equal(
    authorizationErrorKey("ORDER_EMPTY"),
    "authorization.errors.orderEmpty"
  );
  assert.equal(
    authorizationErrorKey("ORDER_DISCOUNT_FORBIDDEN"),
    "authorization.errors.orderDiscountForbidden"
  );
});

test("orders module slugs are registered and granted to the right roles", () => {
  const byModule = getPermissionsByModule();
  assert.deepEqual(byModule.orders.slice(0, 4), [
    "orders.view",
    "orders.create",
    "orders.update",
    "orders.cancel",
  ]);
  assert.ok(byModule.pos.includes("pos.access"));
  assert.equal(isPermissionSlug("orders.view"), true);

  const cashier = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.cashier);
  assert.equal(canAccess(cashier, "pos.access"), true);
  assert.equal(canAccess(cashier, "orders.view"), true);
  assert.equal(canAccess(cashier, "orders.update"), true);
  assert.equal(canAccess(cashier, "orders.cancel"), false);

  const manager = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.manager);
  assert.equal(canAccess(manager, "orders.cancel"), true);

  const accountant = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.accountant
  );
  assert.equal(canAccess(accountant, "pos.access"), false);
});