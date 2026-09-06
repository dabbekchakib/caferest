import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOODS_RECEIPT_STATUSES,
  GOODS_RECEIPT_ACTIONS,
  RECEIPT_ACTION_PERMISSION,
  RECEIPT_ACTION_TARGET_STATUS,
  isReceiptEditable,
  receiptAvailableActions,
  canReceiptTransition,
  receiptTargetStatus,
  type GoodsReceiptAction,
} from "../src/lib/receiving/status";
import {
  goodsReceiptLineSchema,
  goodsReceiptLineInputSchema,
  createGoodsReceiptSchema,
  updateGoodsReceiptSchema,
  goodsReceiptActionSchema,
  goodsReceiptStatusSchema,
} from "../src/validations/receiving";
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

const EST = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const POI = "44444444-4444-4444-8444-444444444444";
const INGREDIENT = "55555555-5555-4555-8555-555555555555";

function line(overrides: Record<string, unknown> = {}) {
  return {
    purchaseOrderItemId: POI,
    ingredientId: INGREDIENT,
    receivedQuantity: 10,
    acceptedQuantity: 9,
    rejectedQuantity: 1,
    lotNumber: "LOT-01",
    batchNumber: null,
    expiryDate: "2027-01-01",
    notes: null,
    sortOrder: 0,
    ...overrides,
  };
}

const TRANSITION_MATRIX: Record<
  GoodsReceiptAction,
  readonly string[]
> = {
  submit: ["draft"],
  validate: ["pending_validation"],
  cancel: ["draft", "pending_validation"],
  delete: ["draft"],
};

test("receipt workflow exposes the four canonical statuses", () => {
  assert.deepEqual([...GOODS_RECEIPT_STATUSES], [
    "draft",
    "pending_validation",
    "validated",
    "cancelled",
  ]);
  assert.deepEqual([...GOODS_RECEIPT_ACTIONS], [
    "submit",
    "validate",
    "cancel",
    "delete",
  ]);
});

test("receipt action permission and target mappings cover every action", () => {
  const statuses = [...GOODS_RECEIPT_STATUSES];
  for (const action of GOODS_RECEIPT_ACTIONS) {
    assert.ok(RECEIPT_ACTION_PERMISSION[action].startsWith("goods_receipts."));
    assert.ok(statuses.includes(RECEIPT_ACTION_TARGET_STATUS[action]));
  }
  assert.equal(RECEIPT_ACTION_PERMISSION.submit, "goods_receipts.submit");
  assert.equal(RECEIPT_ACTION_TARGET_STATUS.validate, "validated");
  assert.equal(RECEIPT_ACTION_TARGET_STATUS.cancel, "cancelled");
});

test("receipt transitions follow the defined matrix", () => {
  assert.deepEqual(receiptAvailableActions("draft"), ["submit", "cancel", "delete"]);
  assert.deepEqual(receiptAvailableActions("pending_validation"), [
    "validate",
    "cancel",
  ]);
  assert.deepEqual(receiptAvailableActions("validated"), []);
  assert.deepEqual(receiptAvailableActions("cancelled"), []);

  for (const action of GOODS_RECEIPT_ACTIONS) {
    for (const status of GOODS_RECEIPT_STATUSES) {
      const expected = TRANSITION_MATRIX[action].includes(status);
      assert.equal(canReceiptTransition(status, action), expected, `${status}+${action}`);
      assert.equal(
        receiptTargetStatus(status, action) === null,
        !expected,
        `target ${status}+${action}`
      );
    }
  }

  assert.equal(
    receiptTargetStatus("pending_validation", "validate"),
    "validated"
  );
});

test("receipts are open to edits until their stock is sealed", () => {
  assert.equal(isReceiptEditable("draft"), true);
  assert.equal(isReceiptEditable("pending_validation"), true);
  assert.equal(isReceiptEditable("validated"), false);
  assert.equal(isReceiptEditable("cancelled"), false);
});

test("receipt line schema enforces quantity ranges and max values", () => {
  const result = goodsReceiptLineSchema.safeParse({
    ...line(),
    receivedQuantity: -1,
  });
  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues.some((i) => i.message === "validation.minValue"),
    true
  );

  const overflow = goodsReceiptLineSchema.safeParse({
    ...line(),
    acceptedQuantity: 1_000_000,
  });
  assert.equal(overflow.success, false);
  assert.equal(
    overflow.error?.issues.some((i) => i.message === "validation.maxValue"),
    true
  );
});

test("receipt line input accepts numeric strings and rejects split over received", () => {
  const valid = goodsReceiptLineInputSchema.safeParse([
    line({ receivedQuantity: "10", acceptedQuantity: "8" }),
    line({
      purchaseOrderItemId: "66666666-6666-4666-8666-666666666666",
      ingredientId: "77777777-7777-4777-8777-777777777777",
      receivedQuantity: 5,
      acceptedQuantity: 5,
      rejectedQuantity: 0,
      sortOrder: 1,
    }),
  ]);
  assert.equal(valid.success, true);

  const over = goodsReceiptLineInputSchema.safeParse([
    line({ receivedQuantity: 10, acceptedQuantity: 9, rejectedQuantity: 2 }),
  ]);
  assert.equal(over.success, false);
  assert.equal(over.error?.issues[0].message, "receiptValidation.splitExceedsReceived");
});

test("create receipt schema validates a full valid input", () => {
  const result = createGoodsReceiptSchema.safeParse({
    establishmentId: EST,
    purchaseOrderId: ORDER,
    receiptDate: "2026-09-01",
    inventoryLocationId: LOCATION,
    deliveryNoteNumber: "BL-42",
    supplierInvoiceNumber: "FAC-7",
    notes: "Urgent",
    internalNotes: "Double-check",
    items: [line()],
  });
  assert.equal(result.success, true);
});

test("create receipt schema rejects empty item lists", () => {
  const result = createGoodsReceiptSchema.safeParse({
    establishmentId: EST,
    purchaseOrderId: ORDER,
    receiptDate: new Date().toISOString().slice(0, 10),
    inventoryLocationId: null,
    items: [],
  });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].message, "receiptValidation.noItems");
});

test("create receipt schema rejects bad UUIDs and bad dates", () => {
  const badUuid = createGoodsReceiptSchema.safeParse({
    establishmentId: "nope",
    purchaseOrderId: ORDER,
    receiptDate: "not-a-date",
    items: [line()],
  });
  assert.equal(badUuid.success, false);
  assert.equal(
    badUuid.error?.issues.some((i) => i.message === "validation.invalidValue"),
    true
  );
});

test("update receipt schema requires an id and swaps establishment", () => {
  const ok = updateGoodsReceiptSchema.safeParse({
    id: EST,
    purchaseOrderId: ORDER,
    receiptDate: "2026-09-02",
    inventoryLocationId: null,
    items: [line()],
  });
  assert.equal(ok.success, true);

  const missing = updateGoodsReceiptSchema.safeParse({
    purchaseOrderId: ORDER,
    receiptDate: "2026-09-02",
    items: [line()],
  });
  assert.equal(missing.success, false);
  assert.equal(
    missing.error?.issues.some((i) => i.code === "invalid_type"),
    true
  );
});

test("receipt action and status schemas constrain values", () => {
  const validAction = goodsReceiptActionSchema.safeParse({
    id: EST,
    reason: "Wrong delivery",
  });
  assert.equal(validAction.success, true);

  const badAction = goodsReceiptActionSchema.safeParse({ id: "junk" });
  assert.equal(badAction.success, false);

  const validStatus = goodsReceiptStatusSchema.safeParse("validated");
  assert.equal(validStatus.success, true);

  const badStatus = goodsReceiptStatusSchema.safeParse("shipped");
  assert.equal(badStatus.success, false);
  assert.equal(badStatus.error?.issues[0].message, "receiptValidation.statusInvalid");
});

test("goods receipt RPC errors map to stable domain codes", () => {
  const cases: Record<string, string> = {
    goods_receipt_not_found: "GOODS_RECEIPT_NOT_FOUND",
    goods_receipt_locked: "GOODS_RECEIPT_LOCKED",
    goods_receipt_invalid_status: "GOODS_RECEIPT_INVALID_STATUS",
    goods_receipt_empty: "GOODS_RECEIPT_EMPTY",
    goods_receipt_date_invalid: "GOODS_RECEIPT_DATE_INVALID",
    goods_receipt_overdelivery: "GOODS_RECEIPT_OVERDELIVERY",
    goods_receipt_quantity_invalid: "GOODS_RECEIPT_QUANTITY_INVALID",
    goods_receipt_item_invalid: "GOODS_RECEIPT_ITEM_INVALID",
    purchase_order_not_receivable: "PURCHASE_ORDER_NOT_RECEIVABLE",
    stock_location_invalid: "STOCK_LOCATION_INVALID",
  };
  for (const [message, code] of Object.entries(cases)) {
    assert.equal(toAuthorizationError({ message }).code, code, message);
  }
  assert.equal(
    authorizationErrorKey("GOODS_RECEIPT_NOT_FOUND"),
    "authorization.errors.goodsReceiptNotFound"
  );
  assert.equal(
    authorizationErrorKey("PURCHASE_ORDER_NOT_RECEIVABLE"),
    "authorization.errors.purchaseOrderNotReceivable"
  );
  assert.equal(
    authorizationErrorKey("STOCK_LOCATION_INVALID"),
    "authorization.errors.stockLocationInvalid"
  );
});

test("goods receipt DB constraints map to stable domain codes", () => {
  const expected: Record<string, string> = {
    uq_goods_receipts_establishment_number: "GOODS_RECEIPT_DUPLICATE_NUMBER",
    goods_receipt_items_overdelivery_check: "GOODS_RECEIPT_OVERDELIVERY",
    goods_receipt_items_split_check: "GOODS_RECEIPT_QUANTITY_INVALID",
  };
  for (const [constraint, code] of Object.entries(expected)) {
    assert.equal(toAuthorizationError({ message: constraint }).code, code, constraint);
  }
  assert.equal(
    authorizationErrorKey("GOODS_RECEIPT_DUPLICATE_NUMBER"),
    "authorization.errors.goodsReceiptDuplicateNumber"
  );
  assert.equal(
    authorizationErrorKey("GOODS_RECEIPT_OVERDELIVERY"),
    "authorization.errors.goodsReceiptOverdelivery"
  );
  assert.equal(
    authorizationErrorKey("GOODS_RECEIPT_QUANTITY_INVALID"),
    "authorization.errors.goodsReceiptQuantityInvalid"
  );
});

test("goods_receipts is a registered module with seven slugs", () => {
  const byModule = getPermissionsByModule();
  const slugs = byModule.goods_receipts;
  assert.deepEqual(slugs, [
    "goods_receipts.view",
    "goods_receipts.create",
    "goods_receipts.update",
    "goods_receipts.delete",
    "goods_receipts.submit",
    "goods_receipts.validate",
    "goods_receipts.cancel",
  ]);
  for (const slug of slugs) assert.equal(isPermissionSlug(slug), true);
});

test("receipt role matrix grants the workflow to the right roles", () => {
  const adminSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.admin);
  const managerSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.manager);
  const purchasingSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.purchasing
  );
  const accountantSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.accountant
  );

  const granted = (set: ReturnType<typeof buildPermissionSet>, slug: string) =>
    canAccess(set, slug);

  assert.equal(granted(adminSet, "goods_receipts.validate"), true);
  assert.equal(granted(purchasingSet, "goods_receipts.validate"), true);
  assert.equal(granted(managerSet, "goods_receipts.validate"), true);
  assert.equal(granted(managerSet, "goods_receipts.cancel"), true);

  const stockSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.stock_manager
  );
  assert.equal(granted(stockSet, "goods_receipts.view"), true);
  assert.equal(granted(stockSet, "goods_receipts.create"), true);
  assert.equal(granted(stockSet, "goods_receipts.update"), true);
  assert.equal(granted(stockSet, "goods_receipts.delete"), true);
  assert.equal(granted(stockSet, "goods_receipts.submit"), true);
  assert.equal(granted(stockSet, "goods_receipts.cancel"), true);
  assert.equal(granted(stockSet, "goods_receipts.validate"), false);

  assert.equal(granted(accountantSet, "goods_receipts.view"), true);
  assert.equal(granted(accountantSet, "goods_receipts.create"), false);
  assert.equal(granted(accountantSet, "goods_receipts.update"), false);
  assert.equal(granted(accountantSet, "goods_receipts.submit"), false);
  assert.equal(granted(accountantSet, "goods_receipts.validate"), false);
  assert.equal(granted(accountantSet, "goods_receipts.cancel"), false);
  assert.equal(granted(accountantSet, "goods_receipts.delete"), false);
});