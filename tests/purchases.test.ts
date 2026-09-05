import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLineTotals,
  calculateOrderTotals,
  calculateLineFromInput,
} from "../src/lib/purchases/calculations";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_ACTIONS,
  STATUS_ACTIONS,
  availableActions,
  canTransition,
  targetStatus,
  isOrderEditable,
  ACTION_PERMISSION,
  ACTION_TARGET_STATUS,
} from "../src/lib/purchases/status";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderLineSchema,
  purchaseOrderLineInputSchema,
  purchaseOrderStatusSchema,
  purchaseOrderActionSchema,
} from "../src/validations/purchases";
import type { PurchaseOrderLineInput } from "../src/lib/purchases/types";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";
import {
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
  isPermissionSlug,
} from "../src/lib/authorization/permissions";
import { canAccess, buildPermissionSet } from "../src/lib/authorization/compute";

const EST = "11111111-1111-4111-8111-111111111111";
const SUPPLIER = "22222222-2222-4222-8222-222222222222";
const INGREDIENT = "33333333-3333-4333-8333-333333333333";
const OFFER = "44444444-4444-4444-8444-444444444444";
const TAX = "55555555-5555-4555-8555-555555555555";

function line(overrides: Partial<PurchaseOrderLineInput> = {}): PurchaseOrderLineInput {
  return {
    ingredientId: INGREDIENT,
    ingredientSupplierId: OFFER,
    description: "Coffee beans",
    supplierSku: "SKU-1",
    quantity: 5,
    purchaseUnitId: null,
    unitPrice: 100,
    discountType: "none",
    discountValue: 0,
    taxId: TAX,
    taxRate: 19,
    notes: null,
    sortOrder: 0,
    ...overrides,
  };
}

test("calculateLineTotals computes gross minus discount plus tax (percentage points)", () => {
  const totals = calculateLineTotals({
    quantity: 5,
    unitPrice: 100,
    discountType: "none",
    discountValue: 0,
    taxRate: 19,
  });
  assert.equal(totals.subtotal, 500);
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.taxAmount, 95); // 500 × 19 / 100
  assert.equal(totals.total, 595);
});

test("calculateLineTotals applies percentage and fixed discounts", () => {
  const percent = calculateLineTotals({
    quantity: 10,
    unitPrice: 10,
    discountType: "percentage",
    discountValue: 10,
    taxRate: 7,
  });
  assert.equal(percent.subtotal, 90);
  assert.equal(percent.discountAmount, 10);
  assert.equal(percent.taxAmount, 6.3);
  assert.equal(percent.total, 96.3);

  const fixed = calculateLineTotals({
    quantity: 2,
    unitPrice: 50,
    discountType: "fixed",
    discountValue: 25,
    taxRate: 0,
  });
  assert.equal(fixed.subtotal, 75);
  assert.equal(fixed.discountAmount, 25);
  assert.equal(fixed.total, 75);
});

test("calculateLineTotals clamps a fixed discount at the gross amount", () => {
  const totals = calculateLineTotals({
    quantity: 3,
    unitPrice: 40,
    discountType: "fixed",
    discountValue: 9999,
    taxRate: 19,
  });
  assert.equal(totals.discountAmount, 120);
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.total, 0);
});

test("calculateOrderTotals aggregates lines and keeps shipping/other separate", () => {
  const totals = calculateOrderTotals(
    [
      { subtotal: 100, discountAmount: 5, taxAmount: 19, total: 119 },
      { subtotal: 50, discountAmount: 0, taxAmount: 3.5, total: 53.5 },
    ],
    15,
    4.5
  );
  assert.equal(totals.subtotal, 150);
  assert.equal(totals.discountAmount, 5);
  assert.equal(totals.taxAmount, 22.5);
  assert.equal(totals.shippingAmount, 15);
  assert.equal(totals.otherCharges, 4.5);
  assert.equal(totals.total, 192);
});

test("calculateLineFromInput delegates to calculateLineTotals", () => {
  const totals = calculateLineFromInput(line());
  assert.equal(totals.total, 595);
});

test("workflow covers eight ordered statuses and five actions", () => {
  assert.deepEqual(PURCHASE_ORDER_STATUSES, [
    "draft",
    "pending_approval",
    "approved",
    "sent",
    "partially_received",
    "fully_received",
    "cancelled",
    "closed",
  ]);
  assert.deepEqual(PURCHASE_ORDER_ACTIONS, [
    "submit",
    "approve",
    "send",
    "cancel",
    "close",
  ]);
});

test("transitions follow the defined matrix", () => {
  assert.deepEqual(availableActions("draft"), ["submit", "cancel"]);
  assert.deepEqual(availableActions("pending_approval"), ["approve", "cancel"]);
  assert.deepEqual(availableActions("approved"), ["send", "cancel"]);
  assert.deepEqual(availableActions("sent"), ["cancel"]);
  assert.deepEqual(availableActions("partially_received"), ["cancel"]);
  assert.deepEqual(availableActions("fully_received"), ["close"]);
  assert.deepEqual(availableActions("cancelled"), []);
  assert.deepEqual(availableActions("closed"), []);

  assert.equal(canTransition("draft", "submit"), true);
  assert.equal(canTransition("draft", "approve"), false);
  assert.equal(targetStatus("draft", "submit"), "pending_approval");
  assert.equal(targetStatus("closed", "close"), null);

  for (const action of PURCHASE_ORDER_ACTIONS) {
    assert.ok(STATUS_ACTIONS["draft" as keyof typeof STATUS_ACTIONS].length >= 0);
    assert.ok(typeof ACTION_PERMISSION[action] === "string");
    assert.ok(ACTION_TARGET_STATUS[action]);
  }
});

test("editable orders are only draft and pending_approval", () => {
  assert.equal(isOrderEditable("draft"), true);
  assert.equal(isOrderEditable("pending_approval"), true);
  assert.equal(isOrderEditable("approved"), false);
  assert.equal(isOrderEditable("sent"), false);
  assert.equal(isOrderEditable("closed"), false);
});

test("create schema validates a full valid order", () => {
  const result = createPurchaseOrderSchema.safeParse({
    establishmentId: EST,
    supplierId: SUPPLIER,
    orderDate: new Date("2026-09-01T00:00:00Z"),
    expectedDeliveryDate: new Date("2026-09-15T00:00:00Z"),
    currencyCode: "tnd",
    shippingAmount: 12,
    otherCharges: 0,
    notes: "notes",
    internalNotes: null,
    supplierNotes: null,
    shippingAddress: null,
    billingAddress: null,
    items: [line()],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.currencyCode, "TND");
  }
});

test("create schema rejects empty item lists", () => {
  const result = createPurchaseOrderSchema.safeParse({
    establishmentId: EST,
    supplierId: SUPPLIER,
    orderDate: new Date(),
    expectedDeliveryDate: null,
    currencyCode: "TND",
    shippingAmount: 0,
    otherCharges: 0,
    items: [],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].message, "purchaseOrderValidation.noItems");
  }
});

test("line discount rules are enforced", () => {
  const percentTooHigh = purchaseOrderLineSchema.safeParse(
    line({ discountType: "percentage", discountValue: 101 })
  );
  assert.equal(percentTooHigh.success, false);

  const fixedTooHigh = purchaseOrderLineSchema.safeParse(
    line({ discountType: "fixed", discountValue: 501 })
  );
  assert.equal(fixedTooHigh.success, false);
  if (!fixedTooHigh.success) {
    assert.equal(
      fixedTooHigh.error.issues[0].message,
      "purchaseOrderValidation.discountExceedsGross"
    );
  }

  const noneWithValue = purchaseOrderLineSchema.safeParse(
    line({ discountType: "none", discountValue: 5 })
  );
  assert.equal(noneWithValue.success, false);

  const validFixed = purchaseOrderLineSchema.safeParse(
    line({ discountType: "fixed", discountValue: 250 })
  );
  assert.equal(validFixed.success, true);
});

test("line input schema requires at least one item", () => {
  assert.equal(purchaseOrderLineInputSchema.safeParse([]).success, false);
  assert.equal(purchaseOrderLineInputSchema.safeParse([line()]).success, true);
});

test("update schema swaps establishmentId for id", () => {
  const result = updatePurchaseOrderSchema.safeParse({
    id: EST,
    supplierId: SUPPLIER,
    orderDate: new Date(),
    expectedDeliveryDate: null,
    currencyCode: "TND",
    shippingAmount: 0,
    otherCharges: 0,
    items: [line()],
  });
  assert.equal(result.success, true);

  const missingId = updatePurchaseOrderSchema.safeParse({
    supplierId: SUPPLIER,
    orderDate: new Date(),
    expectedDeliveryDate: null,
    currencyCode: "TND",
    shippingAmount: 0,
    otherCharges: 0,
    items: [line()],
  });
  assert.equal(missingId.success, false);

  const badId = updatePurchaseOrderSchema.safeParse({
    id: "not-a-uuid",
    supplierId: SUPPLIER,
    orderDate: new Date(),
    expectedDeliveryDate: null,
    currencyCode: "TND",
    shippingAmount: 0,
    otherCharges: 0,
    items: [line()],
  });
  assert.equal(badId.success, false);
});

test("status and action schemas constrain values", () => {
  assert.equal(purchaseOrderStatusSchema.safeParse("sent").success, true);
  assert.equal(purchaseOrderStatusSchema.safeParse("snoozed").success, false);
  assert.equal(
    purchaseOrderActionSchema.safeParse({
      id: EST,
      reason: "Player error",
    }).success,
    true
  );
});

test("RPC error messages map to stable purchase-order domain codes", () => {
  assert.equal(
    toAuthorizationError({ message: "purchase_order_not_found" }).code,
    "PURCHASE_ORDER_NOT_FOUND"
  );
  assert.equal(
    toAuthorizationError({ message: "purchase_order_locked" }).code,
    "PURCHASE_ORDER_LOCKED"
  );
  assert.equal(
    toAuthorizationError({ message: "purchase_order_invalid_status" }).code,
    "PURCHASE_ORDER_INVALID_STATUS"
  );
  assert.equal(
    toAuthorizationError({ message: "purchase_order_empty" }).code,
    "PURCHASE_ORDER_EMPTY"
  );
  assert.equal(
    toAuthorizationError({ message: "forbidden" }).code,
    "FORBIDDEN"
  );
  assert.equal(
    toAuthorizationError({ message: "uq_purchase_orders_establishment_order_number" }).code,
    "PURCHASE_ORDER_DUPLICATE_NUMBER"
  );
  assert.equal(
    authorizationErrorKey("PURCHASE_ORDER_NOT_FOUND"),
    "authorization.errors.purchaseOrderNotFound"
  );
});

test("purchase workflow slugs exist and are granted to the right roles", () => {
  const slugs = [
    "purchases.submit",
    "purchases.approve",
    "purchases.send",
    "purchases.cancel",
    "purchases.close",
    "purchases.duplicate",
  ];
  for (const slug of slugs) {
    assert.equal(isPermissionSlug(slug), true, `${slug} must be a registered slug`);
  }

  const managerSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.manager);
  for (const slug of slugs) {
    assert.equal(canAccess(managerSet, slug), true, `manager must have ${slug}`);
  }

  const purchasingSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.purchasing);
  for (const slug of slugs) {
    assert.equal(canAccess(purchasingSet, slug), true, `purchasing must have ${slug}`);
  }

  assert.equal(canAccess(managerSet, "purchases.create"), true);
  assert.equal(canAccess(managerSet, "purchases.receive"), true);
  assert.equal(canAccess(managerSet, "suppliers.view"), true);
  assert.equal(
    canAccess(buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.accountant), "purchases.send"),
    false
  );
  assert.equal(
    canAccess(buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.stock_manager), "purchases.approve"),
    false
  );
});