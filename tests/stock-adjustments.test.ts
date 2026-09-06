import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_ADJUSTMENT_ACTIONS,
  STOCK_ADJUSTMENT_ACTION_PERMISSION,
  STOCK_ADJUSTMENT_ACTION_TARGET_STATUS,
  STOCK_ADJUSTMENT_STATUS_ACTIONS,
  STOCK_ADJUSTMENT_TYPES,
  isStockAdjustmentEditable,
  stockAdjustmentAvailableActions,
  canStockAdjustmentTransition,
  stockAdjustmentTargetStatus,
  isStockAdjustmentTerminal,
  type StockAdjustmentAction,
} from "../src/lib/stock-adjustments/status";
import {
  round6,
  round3,
  lineTotalCost,
  stockAdjustmentTotals,
  adjustmentRequiresApproval,
  adjustmentAvailableQuantity,
  adjustmentHasEnoughStock,
  isValidStockAdjustmentNumber,
} from "../src/lib/stock-adjustments/calculations";
import {
  createStockAdjustmentSchema,
  addStockAdjustmentItemSchema,
  updateStockAdjustmentItemSchema,
  removeStockAdjustmentItemSchema,
  stockAdjustmentActionSchema,
  stockAdjustmentStatusSchema,
  stockAdjustmentTypeSchema,
  stockAdjustmentFiltersSchema,
} from "../src/validations/stock-adjustments";
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
const ADJUSTMENT = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";
const INGREDIENT = "55555555-5555-4555-8555-555555555555";
const UNIT = "66666666-6666-4666-8666-666666666666";

const TRANSITION_MATRIX: Record<StockAdjustmentAction, readonly string[]> = {
  submit: ["draft"],
  approve: ["pending_approval"],
  validate: ["approved"],
  cancel: ["draft", "pending_approval", "approved"],
  delete: ["draft"],
};

test("adjustment workflow exposes five statuses and five actions", () => {
  assert.deepEqual([...STOCK_ADJUSTMENT_STATUSES], [
    "draft",
    "pending_approval",
    "approved",
    "validated",
    "cancelled",
  ]);
  assert.deepEqual([...STOCK_ADJUSTMENT_ACTIONS], [
    "submit",
    "approve",
    "validate",
    "cancel",
    "delete",
  ]);
  assert.deepEqual([...STOCK_ADJUSTMENT_TYPES], [
    "loss",
    "breakage",
    "waste",
    "expired",
    "damaged",
    "internal_consumption",
    "sample",
    "staff_consumption",
    "cleaning",
    "other",
  ]);
});

test("adjustment action permission and target mappings cover every action", () => {
  const statuses = [...STOCK_ADJUSTMENT_STATUSES];
  for (const action of STOCK_ADJUSTMENT_ACTIONS) {
    assert.ok(
      STOCK_ADJUSTMENT_ACTION_PERMISSION[action].startsWith("stock_adjustments."),
      action
    );
    assert.ok(statuses.includes(STOCK_ADJUSTMENT_ACTION_TARGET_STATUS[action]), action);
  }
  assert.equal(
    STOCK_ADJUSTMENT_ACTION_PERMISSION.validate,
    "stock_adjustments.validate"
  );
  assert.equal(
    STOCK_ADJUSTMENT_ACTION_TARGET_STATUS.submit,
    "pending_approval"
  );
});

test("adjustment transitions follow the defined matrix", () => {
  assert.deepEqual(stockAdjustmentAvailableActions("draft"), [
    "submit",
    "cancel",
    "delete",
  ]);
  assert.deepEqual(stockAdjustmentAvailableActions("pending_approval"), [
    "approve",
    "cancel",
  ]);
  assert.deepEqual(stockAdjustmentAvailableActions("approved"), [
    "validate",
    "cancel",
  ]);
  assert.deepEqual(stockAdjustmentAvailableActions("validated"), []);
  assert.deepEqual(stockAdjustmentAvailableActions("cancelled"), []);
  assert.deepEqual(STOCK_ADJUSTMENT_STATUS_ACTIONS.validated, []);
  assert.deepEqual(STOCK_ADJUSTMENT_STATUS_ACTIONS.cancelled, []);

  for (const action of STOCK_ADJUSTMENT_ACTIONS) {
    for (const status of STOCK_ADJUSTMENT_STATUSES) {
      const expected = TRANSITION_MATRIX[action].includes(status);
      assert.equal(
        canStockAdjustmentTransition(status, action),
        expected,
        `${status}+${action}`
      );
      assert.equal(
        stockAdjustmentTargetStatus(status, action) === null,
        !expected,
        `target ${status}+${action}`
      );
    }
  }
});

test("validated and cancelled statuses are terminal sinks", () => {
  assert.equal(isStockAdjustmentTerminal("validated"), true);
  assert.equal(isStockAdjustmentTerminal("cancelled"), true);
  assert.equal(isStockAdjustmentTerminal("pending_approval"), false);
  assert.equal(isStockAdjustmentTerminal("approved"), false);
});

test("adjustments are editable only while in draft", () => {
  assert.equal(isStockAdjustmentEditable("draft"), true);
  assert.equal(isStockAdjustmentEditable("pending_approval"), false);
  assert.equal(isStockAdjustmentEditable("approved"), false);
  assert.equal(isStockAdjustmentEditable("validated"), false);
  assert.equal(isStockAdjustmentEditable("cancelled"), false);
});

test("adjustment rounding follows the currency conventions", () => {
  assert.equal(round6(0.0000004), 0);
  assert.equal(round6(1 / 3), 0.333333);
  assert.equal(round3(1 / 3), 0.333);
  assert.equal(round3(2.3456), 2.346);
  assert.equal(lineTotalCost(2, 70), 140);
  assert.equal(lineTotalCost(1.5, 1.2), 1.8);
  assert.equal(lineTotalCost(0.1, 0.3), 0.03);
});

test("stockAdjustmentTotals rolls quantities and values", () => {
  const summary = stockAdjustmentTotals([
    { base_quantity: 2, unit_cost: 70 },
    { base_quantity: 1.5, unit_cost: 1.2 },
    { base_quantity: 0, unit_cost: 5 },
  ]);
  assert.equal(summary.itemCount, 3);
  assert.equal(summary.totalQuantity, 3.5);
  assert.equal(summary.totalValue, 141.8);
});

test("adjustmentRequiresApproval mirrors the submit gate", () => {
  const thresholds = {
    requireApproval: false,
    approvalThresholdValue: 1000,
    approvalThresholdPercentage: 0,
    requireSeparation: false,
  };
  assert.equal(adjustmentRequiresApproval(thresholds, 999.99), false);
  assert.equal(adjustmentRequiresApproval(thresholds, 1000), false);
  assert.equal(adjustmentRequiresApproval(thresholds, 1000.01), true);

  const always = { ...thresholds, requireApproval: true };
  assert.equal(adjustmentRequiresApproval(always, 0), true);

  const noThreshold = { ...thresholds, approvalThresholdValue: 0 };
  assert.equal(adjustmentRequiresApproval(noThreshold, 50_000), false);
});

test("adjustment stock helpers preview availability", () => {
  assert.equal(adjustmentAvailableQuantity(12, 2), 10);
  assert.equal(adjustmentAvailableQuantity(1, 1.5), -0.5);
  assert.equal(adjustmentHasEnoughStock(12, 2), true);
  assert.equal(adjustmentHasEnoughStock(1, 1.5), false);
});

test("adjustment numbering follows the PER-YYYY-NNNNNN pattern", () => {
  assert.equal(isValidStockAdjustmentNumber("PER-2026-000001"), true);
  assert.equal(isValidStockAdjustmentNumber("PER-2026-000001 "), false);
  assert.equal(isValidStockAdjustmentNumber("PER-32-1"), false);
  assert.equal(isValidStockAdjustmentNumber("INV-2026-000001"), false);
});

test("create adjustment schema validates a full valid input", () => {
  const result = createStockAdjustmentSchema.safeParse({
    establishmentId: EST,
    inventoryLocationId: LOCATION,
    adjustmentType: "loss",
    adjustmentDate: "2026-09-06",
    reasonId: null,
    notes: null,
    internalReference: null,
    items: [
      { ingredientId: INGREDIENT, quantity: "2", unitId: null },
      { ingredientId: ITEM, quantity: 1.5 },
    ],
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.items[0].quantity, 2);

  const badType = createStockAdjustmentSchema.safeParse({
    establishmentId: EST,
    inventoryLocationId: LOCATION,
    adjustmentType: "theft",
    adjustmentDate: "2026-09-06",
    items: [{ ingredientId: INGREDIENT, quantity: 1 }],
  });
  assert.equal(badType.success, false);
  assert.equal(
    badType.error?.issues[0].message,
    "stockAdjustmentValidation.typeInvalid"
  );

  const empty = createStockAdjustmentSchema.safeParse({
    establishmentId: EST,
    inventoryLocationId: LOCATION,
    adjustmentType: "loss",
    adjustmentDate: "2026-09-06",
    items: [],
  });
  assert.equal(empty.success, false);
  assert.equal(
    empty.error?.issues[0].message,
    "stockAdjustmentValidation.empty"
  );
});

test("line item schemas enforce positive quantities and valid references", () => {
  const valid = addStockAdjustmentItemSchema.safeParse({
    establishmentId: EST,
    adjustmentId: ADJUSTMENT,
    ingredientId: INGREDIENT,
    quantity: "2.5",
    unitId: UNIT,
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.quantity, 2.5);

  const negative = addStockAdjustmentItemSchema.safeParse({
    establishmentId: EST,
    adjustmentId: ADJUSTMENT,
    ingredientId: INGREDIENT,
    quantity: -1,
  });
  assert.equal(negative.success, false);
  assert.equal(
    negative.error?.issues.some(
      (i) => i.message === "stockAdjustmentValidation.quantityInvalid"
    ),
    true
  );

  const zero = addStockAdjustmentItemSchema.safeParse({
    establishmentId: EST,
    adjustmentId: ADJUSTMENT,
    ingredientId: INGREDIENT,
    quantity: 0,
  });
  assert.equal(zero.success, false);

  const badRef = addStockAdjustmentItemSchema.safeParse({
    establishmentId: EST,
    adjustmentId: "junk",
    ingredientId: INGREDIENT,
    quantity: 1,
  });
  assert.equal(badRef.success, false);

  const updateOk = updateStockAdjustmentItemSchema.safeParse({
    establishmentId: EST,
    adjustmentId: ADJUSTMENT,
    itemId: ITEM,
    quantity: 3,
  });
  assert.equal(updateOk.success, true);

  const removeOk = removeStockAdjustmentItemSchema.safeParse({
    establishmentId: EST,
    adjustmentId: ADJUSTMENT,
    itemId: ITEM,
  });
  assert.equal(removeOk.success, true);
});

test("action, status and type schemas constrain values", () => {
  const valid = stockAdjustmentActionSchema.safeParse({
    adjustmentId: ADJUSTMENT,
    reason: "Casse en chambre froide",
  });
  assert.equal(valid.success, true);

  const bad = stockAdjustmentActionSchema.safeParse({ adjustmentId: "junk" });
  assert.equal(bad.success, false);

  const validStatus = stockAdjustmentStatusSchema.safeParse("validated");
  assert.equal(validStatus.success, true);

  const badStatus = stockAdjustmentStatusSchema.safeParse("shipped");
  assert.equal(badStatus.success, false);
  assert.equal(
    badStatus.error?.issues[0].message,
    "stockAdjustmentValidation.statusInvalid"
  );

  const validType = stockAdjustmentTypeSchema.safeParse("breakage");
  assert.equal(validType.success, true);

  const badType = stockAdjustmentTypeSchema.safeParse("theft");
  assert.equal(badType.success, false);
  assert.equal(
    badType.error?.issues[0].message,
    "stockAdjustmentValidation.typeInvalid"
  );
});

test("adjustment filters coerce page numbers", () => {
  const ok = stockAdjustmentFiltersSchema.safeParse({
    query: "  PER-2026  ",
    locationId: null,
    type: null,
    status: null,
    page: "2",
    pageSize: 25,
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data?.query, "PER-2026");
  assert.equal(ok.data?.page, 2);
});

test("adjustment RPC errors map to stable domain codes and keys", () => {
  const cases: Record<string, string> = {
    stock_adjustment_not_found: "STOCK_ADJUSTMENT_NOT_FOUND",
    stock_adjustment_wrong_status: "STOCK_ADJUSTMENT_WRONG_STATUS",
    stock_adjustment_invalid_location: "STOCK_ADJUSTMENT_INVALID_LOCATION",
    stock_adjustment_invalid_type: "STOCK_ADJUSTMENT_INVALID_TYPE",
    stock_adjustment_invalid_date: "STOCK_ADJUSTMENT_INVALID_DATE",
    stock_adjustment_invalid_reason: "STOCK_ADJUSTMENT_INVALID_REASON",
    stock_adjustment_quantity_invalid: "STOCK_ADJUSTMENT_QUANTITY_INVALID",
    stock_adjustment_duplicate_item: "STOCK_ADJUSTMENT_DUPLICATE_ITEM",
    stock_adjustment_item_invalid: "STOCK_ADJUSTMENT_ITEM_INVALID",
    stock_adjustment_item_not_found: "STOCK_ADJUSTMENT_ITEM_NOT_FOUND",
    stock_adjustment_empty: "STOCK_ADJUSTMENT_EMPTY",
    stock_adjustment_high_value_approval: "STOCK_ADJUSTMENT_HIGH_VALUE_APPROVAL",
    stock_adjustment_self_approval: "STOCK_ADJUSTMENT_SELF_APPROVAL",
    stock_adjustment_insufficient_stock: "STOCK_ADJUSTMENT_INSUFFICIENT_STOCK",
  };
  for (const [message, code] of Object.entries(cases)) {
    assert.equal(toAuthorizationError({ message }).code, code, message);
  }
  assert.equal(
    authorizationErrorKey("STOCK_ADJUSTMENT_NOT_FOUND"),
    "authorization.errors.stockAdjustmentNotFound"
  );
  assert.equal(
    authorizationErrorKey("STOCK_ADJUSTMENT_HIGH_VALUE_APPROVAL"),
    "authorization.errors.stockAdjustmentHighValueApproval"
  );
  assert.equal(
    authorizationErrorKey("STOCK_ADJUSTMENT_SELF_APPROVAL"),
    "authorization.errors.stockAdjustmentSelfApproval"
  );
});

test("adjustment DB constraints map to stable domain codes and keys", () => {
  assert.equal(
    toAuthorizationError({ message: "uq_stock_adjustment_items_added" }).code,
    "STOCK_ADJUSTMENT_DUPLICATE_ITEM"
  );
  assert.equal(
    toAuthorizationError({ message: "uq_stock_adjustment_reasons_system_code" })
      .code,
    "STOCK_ADJUSTMENT_INVALID_REASON"
  );
  assert.equal(
    toAuthorizationError({ message: "uq_stock_adjustment_reasons_est_code" })
      .code,
    "STOCK_ADJUSTMENT_INVALID_REASON"
  );
  assert.equal(
    authorizationErrorKey("STOCK_ADJUSTMENT_DUPLICATE_ITEM"),
    "authorization.errors.stockAdjustmentDuplicateItem"
  );
});

test("stock_adjustments is a registered module with ten slugs", () => {
  const byModule = getPermissionsByModule();
  const slugs = byModule.stock_adjustments;
  assert.deepEqual(slugs, [
    "stock_adjustments.view",
    "stock_adjustments.create",
    "stock_adjustments.update",
    "stock_adjustments.delete",
    "stock_adjustments.submit",
    "stock_adjustments.approve",
    "stock_adjustments.validate",
    "stock_adjustments.cancel",
    "stock_adjustments.view_cost",
    "stock_adjustments.approve_high_value",
  ]);
  for (const slug of slugs) assert.equal(isPermissionSlug(slug), true);
  assert.equal(byModule.stock_adjustments.length, 10);
});

test("adjustment role matrix grants the workflow to the right roles", () => {
  const granted = (set: ReturnType<typeof buildPermissionSet>, slug: string) =>
    canAccess(set, slug);

  const adminSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.admin);
  const managerSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.manager);
  for (const slug of getPermissionsByModule().stock_adjustments) {
    assert.equal(granted(adminSet, slug), true, `${slug}/admin`);
    assert.equal(granted(managerSet, slug), true, `${slug}/manager`);
  }

  const stockSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.stock_manager
  );
  assert.equal(granted(stockSet, "stock_adjustments.view"), true);
  assert.equal(granted(stockSet, "stock_adjustments.create"), true);
  assert.equal(granted(stockSet, "stock_adjustments.update"), true);
  assert.equal(granted(stockSet, "stock_adjustments.delete"), true);
  assert.equal(granted(stockSet, "stock_adjustments.submit"), true);
  assert.equal(granted(stockSet, "stock_adjustments.cancel"), true);
  assert.equal(granted(stockSet, "stock_adjustments.view_cost"), true);
  assert.equal(granted(stockSet, "stock_adjustments.approve"), false);
  assert.equal(granted(stockSet, "stock_adjustments.validate"), false);
  assert.equal(granted(stockSet, "stock_adjustments.approve_high_value"), false);

  const purchasingSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.purchasing
  );
  assert.equal(granted(purchasingSet, "stock_adjustments.view"), true);
  assert.equal(granted(purchasingSet, "stock_adjustments.create"), false);
  assert.equal(granted(purchasingSet, "stock_adjustments.view_cost"), false);

  const accountantSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.accountant
  );
  assert.equal(granted(accountantSet, "stock_adjustments.view"), true);
  assert.equal(granted(accountantSet, "stock_adjustments.view_cost"), true);
  assert.equal(granted(accountantSet, "stock_adjustments.submit"), false);
  assert.equal(granted(accountantSet, "stock_adjustments.validate"), false);

  const cashierSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.cashier
  );
  assert.equal(granted(cashierSet, "stock_adjustments.view"), false);
});