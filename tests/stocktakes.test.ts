import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STOCKTAKE_STATUSES,
  STOCKTAKE_ACTIONS,
  STOCKTAKE_ACTION_PERMISSION,
  STOCKTAKE_ACTION_TARGET_STATUS,
  STOCKTAKE_STATUS_ACTIONS,
  isStocktakeEditable,
  stocktakeAvailableActions,
  canStocktakeTransition,
  stocktakeTargetStatus,
  isStocktakeTerminal,
  STOCKTAKE_SCOPES,
  type StocktakeAction,
} from "../src/lib/stocktakes/status";
import {
  round6,
  signedMovementQuantity,
  expectedQuantity,
  varianceQuantity,
  variancePercentage,
  varianceValue,
  reconcileItem,
  summarizeStocktake,
  varianceSeverity,
  isValidStocktakeNumber,
  adjustmentReason,
} from "../src/lib/stocktakes/calculations";
import {
  createStocktakeSchema,
  startStocktakeSchema,
  stocktakeCountSchema,
  stocktakeActionSchema,
  stocktakeStatusSchema,
  stocktakeFiltersSchema,
} from "../src/validations/stocktakes";
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
const STOCKTAKE = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";
const UNIT = "55555555-5555-4555-8555-555555555555";

const TRANSITION_MATRIX: Record<StocktakeAction, readonly string[]> = {
  start: ["draft"],
  complete: ["counting"],
  approve: ["pending_review"],
  validate: ["approved"],
  cancel: ["draft", "counting", "pending_review", "approved"],
  delete: ["draft"],
};

test("stocktake workflow exposes six statuses and six actions", () => {
  assert.deepEqual([...STOCKTAKE_STATUSES], [
    "draft",
    "counting",
    "pending_review",
    "approved",
    "validated",
    "cancelled",
  ]);
  assert.deepEqual([...STOCKTAKE_ACTIONS], [
    "start",
    "complete",
    "approve",
    "validate",
    "cancel",
    "delete",
  ]);
});

test("stocktake action permission and target mappings cover every action", () => {
  const statuses = [...STOCKTAKE_STATUSES];
  for (const action of STOCKTAKE_ACTIONS) {
    assert.ok(
      STOCKTAKE_ACTION_PERMISSION[action].startsWith("stocktakes."),
      action
    );
    assert.ok(statuses.includes(STOCKTAKE_ACTION_TARGET_STATUS[action]), action);
  }
  assert.equal(STOCKTAKE_ACTION_PERMISSION.validate, "stocktakes.validate");
});

test("stocktake transitions follow the defined matrix", () => {
  assert.deepEqual(stocktakeAvailableActions("draft"), [
    "start",
    "delete",
    "cancel",
  ]);
  assert.deepEqual(stocktakeAvailableActions("counting"), ["complete", "cancel"]);
  assert.deepEqual(stocktakeAvailableActions("pending_review"), [
    "approve",
    "cancel",
  ]);
  assert.deepEqual(stocktakeAvailableActions("approved"), ["validate", "cancel"]);
  assert.deepEqual(stocktakeAvailableActions("validated"), []);
  assert.deepEqual(stocktakeAvailableActions("cancelled"), []);
  assert.deepEqual(STOCKTAKE_STATUS_ACTIONS.validated, []);
  assert.deepEqual(STOCKTAKE_STATUS_ACTIONS.cancelled, []);

  for (const action of STOCKTAKE_ACTIONS) {
    for (const status of STOCKTAKE_STATUSES) {
      const expected = TRANSITION_MATRIX[action].includes(status);
      assert.equal(canStocktakeTransition(status, action), expected, `${status}+${action}`);
      assert.equal(
        stocktakeTargetStatus(status, action) === null,
        !expected,
        `target ${status}+${action}`
      );
    }
  }
});

test("validated and cancelled statuses are terminal sinks", () => {
  assert.equal(isStocktakeTerminal("validated"), true);
  assert.equal(isStocktakeTerminal("cancelled"), true);
  assert.equal(isStocktakeTerminal("pending_review"), false);
  assert.equal(isStocktakeTerminal("approved"), false);
});

test("stocktakes are editable only while the count is open", () => {
  assert.equal(isStocktakeEditable("draft"), true);
  assert.equal(isStocktakeEditable("counting"), true);
  assert.equal(isStocktakeEditable("pending_review"), false);
  assert.equal(isStocktakeEditable("approved"), false);
  assert.equal(isStocktakeEditable("validated"), false);
  assert.equal(isStocktakeEditable("cancelled"), false);
});

test("variance formulas follow the DB conventions", () => {
  assert.equal(round6(0.0000004), 0);
  assert.equal(round6(1 / 3), 0.333333);
  assert.equal(variancePercentage(0, 0), 0);
  assert.equal(variancePercentage(5, 0), 100);
  assert.equal(variancePercentage(0, 5), -100);
  assert.equal(variancePercentage(10, 20), -50);
  assert.equal(variancePercentage(12, 10), 20);
  assert.equal(varianceValue(12, 10, 3.5), 7);
  assert.equal(varianceValue(8, 10, 3.5), -7);
});

test("theoretical quantity is the snapshot plus signed movements, floored at zero", () => {
  assert.equal(signedMovementQuantity({ direction: "in", baseQuantity: 5 }), 5);
  assert.equal(signedMovementQuantity({ direction: "out", baseQuantity: 5 }), -5);
  assert.equal(signedMovementQuantity({ direction: "in", baseQuantity: null }), 0);
  assert.equal(expectedQuantity(10, -3), 7);
  assert.equal(expectedQuantity(2, -9), 0);
  assert.equal(varianceQuantity(4, 7), -3);
});

test("reconcileItem mirrors the RPC recompute for one line", () => {
  const uncounted = reconcileItem(10, -2, null, 3.5);
  assert.deepEqual(uncounted, {
    movementsQuantity: -2,
    expectedQuantity: 8,
    varianceQuantity: null,
    variancePercentage: null,
    varianceValue: null,
  });

  const counted = reconcileItem(10, -2, 6, 3.5);
  assert.deepEqual(counted, {
    movementsQuantity: -2,
    expectedQuantity: 8,
    varianceQuantity: -2,
    variancePercentage: -25,
    varianceValue: -7,
  });
});

test("summarizeStocktake rolls blanks, variances and values", () => {
  const summary = summarizeStocktake([
    { counted_quantity: null, expected_quantity: 10, variance_value: null, variance_percentage: null },
    { counted_quantity: 12, expected_quantity: 10, variance_value: 6, variance_percentage: 20 },
    { counted_quantity: 8, expected_quantity: 10, variance_value: -6, variance_percentage: -20 },
    { counted_quantity: 10, expected_quantity: 10, variance_value: 0, variance_percentage: 0 },
  ]);
  assert.equal(summary.totalCount, 4);
  assert.equal(summary.countedCount, 3);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.varianceCount, 2);
  assert.equal(summary.surplusCount, 1);
  assert.equal(summary.missingCount, 1);
  assert.equal(summary.surplusValue, 6);
  assert.equal(summary.missingValue, -6);
  assert.equal(summary.netValue, 0);
  assert.equal(summary.maxVariancePercent, 20);
});

test("varianceSeverity applies percentage and value gates", () => {
  const gates = {
    warningPercentage: 2,
    approvalPercentage: 5,
    warningValue: 100,
  };
  assert.equal(varianceSeverity(1.5, 5, gates), "none");
  assert.equal(varianceSeverity(3, 15, gates), "warning");
  assert.equal(varianceSeverity(7, 35, gates), "approval");
  assert.equal(varianceSeverity(1, 250, gates), "approval");
  assert.equal(varianceSeverity(1, 101, gates), "approval");
  assert.equal(varianceSeverity(null, null, gates), "none");

  const noValueGate = { ...gates, warningValue: 0 };
  assert.equal(varianceSeverity(1, 500, noValueGate), "none");
});

test("stocktake numbering follows the INV-YYYY-NNNNNN pattern", () => {
  assert.equal(isValidStocktakeNumber("INV-2026-000001"), true);
  assert.equal(isValidStocktakeNumber("INV-2026-000001 "), false);
  assert.equal(isValidStocktakeNumber("INV-32-1"), false);
  assert.equal(isValidStocktakeNumber("BR-2026-000001"), false);
  assert.equal(adjustmentReason("INV-2026-000001"), "Stocktake INV-2026-000001");
});

test("create stocktake schema validates a full valid input", () => {
  const result = createStocktakeSchema.safeParse({
    establishmentId: EST,
    inventoryLocationId: LOCATION,
    mode: "standard",
    notes: "Mensuel",
  });
  assert.equal(result.success, true);

  const badMode = createStocktakeSchema.safeParse({
    establishmentId: EST,
    inventoryLocationId: LOCATION,
    mode: "sealed",
  });
  assert.equal(badMode.success, false);
  assert.equal(badMode.error?.issues[0].message, "stocktakeValidation.modeInvalid");
});

test("start stocktake schema accepts every scope and rejects bad ones", () => {
  for (const scope of STOCKTAKE_SCOPES) {
    const ok = startStocktakeSchema.safeParse({
      establishmentId: EST,
      stocktakeId: STOCKTAKE,
      scope,
      includeZeroStock: true,
      ingredientIds: [],
    });
    assert.equal(ok.success, true, scope);
  }
  const bad = startStocktakeSchema.safeParse({
    establishmentId: "nope",
    stocktakeId: STOCKTAKE,
    scope: "everything",
    includeZeroStock: false,
    ingredientIds: [],
  });
  assert.equal(bad.success, false);
});

test("count schema coerces amounts, stays nullable and rejects negatives", () => {
  const valid = stocktakeCountSchema.safeParse({
    establishmentId: EST,
    stocktakeId: STOCKTAKE,
    itemId: ITEM,
    amount: "2.5",
    unitId: UNIT,
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.amount, 2.5);

  const cleared = stocktakeCountSchema.safeParse({
    establishmentId: EST,
    stocktakeId: STOCKTAKE,
    itemId: ITEM,
    amount: null,
    unitId: null,
  });
  assert.equal(cleared.success, true);

  const negative = stocktakeCountSchema.safeParse({
    establishmentId: EST,
    stocktakeId: STOCKTAKE,
    itemId: ITEM,
    amount: -1,
    unitId: null,
  });
  assert.equal(negative.success, false);
  assert.equal(
    negative.error?.issues.some((i) => i.message === "validation.minValue"),
    true
  );
});

test("action and status schemas constrain values", () => {
  const valid = stocktakeActionSchema.safeParse({
    stocktakeId: STOCKTAKE,
    reason: "Réécriture du comptage",
  });
  assert.equal(valid.success, true);

  const bad = stocktakeActionSchema.safeParse({ stocktakeId: "junk" });
  assert.equal(bad.success, false);

  const validStatus = stocktakeStatusSchema.safeParse("validated");
  assert.equal(validStatus.success, true);

  const badStatus = stocktakeStatusSchema.safeParse("shipped");
  assert.equal(badStatus.success, false);
  assert.equal(
    badStatus.error?.issues[0].message,
    "stocktakeValidation.statusInvalid"
  );
});

test("stocktake filters coerce page numbers", () => {
  const ok = stocktakeFiltersSchema.safeParse({
    query: "  INV-2026  ",
    locationId: null,
    mode: null,
    status: null,
    page: "2",
    pageSize: 25,
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data?.query, "INV-2026");
  assert.equal(ok.data?.page, 2);
});

test("stocktake RPC errors map to stable domain codes and keys", () => {
  const cases: Record<string, string> = {
    stocktake_not_found: "STOCKTAKE_NOT_FOUND",
    stocktake_locked: "STOCKTAKE_LOCKED",
    stocktake_invalid_status: "STOCKTAKE_INVALID_STATUS",
    stocktake_wrong_status: "STOCKTAKE_WRONG_STATUS",
    stocktake_invalid_location: "STOCKTAKE_INVALID_LOCATION",
    stocktake_invalid_mode: "STOCKTAKE_INVALID_MODE",
    stocktake_invalid_scope: "STOCKTAKE_INVALID_SCOPE",
    stocktake_empty: "STOCKTAKE_EMPTY",
    stocktake_item_not_found: "STOCKTAKE_ITEM_NOT_FOUND",
    stocktake_incomplete: "STOCKTAKE_INCOMPLETE",
    stocktake_high_variance_approval: "STOCKTAKE_HIGH_VARIANCE_APPROVAL",
  };
  for (const [message, code] of Object.entries(cases)) {
    assert.equal(toAuthorizationError({ message }).code, code, message);
  }
  assert.equal(
    authorizationErrorKey("STOCKTAKE_NOT_FOUND"),
    "authorization.errors.stocktakeNotFound"
  );
  assert.equal(
    authorizationErrorKey("STOCKTAKE_HIGH_VARIANCE_APPROVAL"),
    "authorization.errors.stocktakeHighVarianceApproval"
  );
});

test("stocktake DB constraints map to stable domain codes and keys", () => {
  assert.equal(
    toAuthorizationError({
      message: "uq_stocktakes_establishment_number",
    }).code,
    "STOCKTAKE_DUPLICATE_NUMBER"
  );
  assert.equal(
    toAuthorizationError({
      message: "stocktake_items_ingredient_unique",
    }).code,
    "STOCKTAKE_ITEM_NOT_FOUND"
  );
  assert.equal(
    authorizationErrorKey("STOCKTAKE_DUPLICATE_NUMBER"),
    "authorization.errors.stocktakeDuplicateNumber"
  );
});

test("stocktakes is a registered module with twelve slugs", () => {
  const byModule = getPermissionsByModule();
  const slugs = byModule.stocktakes;
  assert.deepEqual(slugs, [
    "stocktakes.view",
    "stocktakes.create",
    "stocktakes.update",
    "stocktakes.delete",
    "stocktakes.start",
    "stocktakes.count",
    "stocktakes.review",
    "stocktakes.approve",
    "stocktakes.validate",
    "stocktakes.cancel",
    "stocktakes.view_cost",
    "stocktakes.approve_high_variance",
  ]);
  for (const slug of slugs) assert.equal(isPermissionSlug(slug), true);
  assert.equal(byModule.stocktakes.length, 12);
});

test("stocktake role matrix grants the workflow to the right roles", () => {
  const granted = (set: ReturnType<typeof buildPermissionSet>, slug: string) =>
    canAccess(set, slug);

  const adminSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.admin);
  const managerSet = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS.manager);
  for (const slug of getPermissionsByModule().stocktakes) {
    assert.equal(granted(adminSet, slug), true, `${slug}/admin`);
    assert.equal(granted(managerSet, slug), true, `${slug}/manager`);
  }

  const stockSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.stock_manager
  );
  assert.equal(granted(stockSet, "stocktakes.view"), true);
  assert.equal(granted(stockSet, "stocktakes.create"), true);
  assert.equal(granted(stockSet, "stocktakes.update"), true);
  assert.equal(granted(stockSet, "stocktakes.delete"), true);
  assert.equal(granted(stockSet, "stocktakes.start"), true);
  assert.equal(granted(stockSet, "stocktakes.count"), true);
  assert.equal(granted(stockSet, "stocktakes.review"), true);
  assert.equal(granted(stockSet, "stocktakes.cancel"), true);
  assert.equal(granted(stockSet, "stocktakes.view_cost"), true);
  assert.equal(granted(stockSet, "stocktakes.approve"), false);
  assert.equal(granted(stockSet, "stocktakes.validate"), false);
  assert.equal(granted(stockSet, "stocktakes.approve_high_variance"), false);

  const purchasingSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.purchasing
  );
  assert.equal(granted(purchasingSet, "stocktakes.view"), true);
  assert.equal(granted(purchasingSet, "stocktakes.create"), false);
  assert.equal(granted(purchasingSet, "stocktakes.view_cost"), false);

  const accountantSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.accountant
  );
  assert.equal(granted(accountantSet, "stocktakes.view"), true);
  assert.equal(granted(accountantSet, "stocktakes.view_cost"), true);
  assert.equal(granted(accountantSet, "stocktakes.count"), false);
  assert.equal(granted(accountantSet, "stocktakes.review"), false);

  const cashierSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.cashier
  );
  assert.equal(granted(cashierSet, "stocktakes.view"), false);
});