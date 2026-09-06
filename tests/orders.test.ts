import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_STATUS_ORDER,
  ALL_ORDER_STATUSES,
  ORDER_WORKFLOW,
  ORDER_OPEN_STATUSES,
  ORDER_EDITABLE_STATUSES,
  ORDER_CANCELLABLE_STATUSES,
  canTransition,
  isOpenStatus,
  isEditableStatus,
  isCancellableStatus,
} from "../src/lib/orders/workflow";
import {
  ORDER_TARGET_PERMISSIONS,
  permissionForTargetStatus,
  ORDER_WRITE_PERMISSIONS,
} from "../src/lib/orders/actions";
import {
  canMergeOrders,
  mergedDiscountAmount,
  canMergeDistinctOrders,
} from "../src/lib/orders/merge";
import {
  canSplitOrder,
  resolveSplitItemIds,
  hasMovableItems,
} from "../src/lib/orders/split";
import {
  orderListFiltersSchema,
  mergeOrdersSchema,
  splitOrderSchema,
} from "../src/lib/orders/schemas";

const ORDER = "22222222-2222-4222-8222-222222222222";
const ITEM_A = "33333333-3333-4333-8333-333333333333";
const ITEM_B = "44444444-4444-4444-8444-444444444444";

test("workflow exposes the full status list (mirror of DB CHECK)", () => {
  assert.deepEqual([...ALL_ORDER_STATUSES], [
    "draft",
    "open",
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "served",
    "completed",
    "cancelled",
  ]);
  assert.deepEqual([...ORDER_STATUS_ORDER], [...ALL_ORDER_STATUSES]);
});

test("workflow transition graph matches transition_pos_order", () => {
  assert.deepEqual(ORDER_WORKFLOW.draft, ["open", "confirmed"]);
  assert.deepEqual(ORDER_WORKFLOW.open, ["confirmed", "cancelled"]);
  assert.deepEqual(ORDER_WORKFLOW.pending, []);
  assert.deepEqual(ORDER_WORKFLOW.confirmed, ["open", "preparing", "cancelled"]);
  assert.deepEqual(ORDER_WORKFLOW.preparing, ["ready", "cancelled"]);
  assert.deepEqual(ORDER_WORKFLOW.ready, ["served"]);
  assert.deepEqual(ORDER_WORKFLOW.served, ["completed"]);
  assert.deepEqual(ORDER_WORKFLOW.completed, []);
  assert.deepEqual(ORDER_WORKFLOW.cancelled, []);

  assert.equal(canTransition("draft", "open"), true);
  assert.equal(canTransition("draft", "confirmed"), true);
  assert.equal(canTransition("confirmed", "preparing"), true);
  assert.equal(canTransition("preparing", "ready"), true);
  assert.equal(canTransition("ready", "served"), true);
  assert.equal(canTransition("served", "completed"), true);
  assert.equal(canTransition("confirmed", "cancelled"), true);

  assert.equal(canTransition("completed", "cancelled"), false);
  assert.equal(canTransition("cancelled", "open"), false);
  assert.equal(canTransition("open", "preparing"), false);
  assert.equal(canTransition("preparing", "served"), false);
});

test("status helper predicates behave correctly", () => {
  assert.deepEqual([...ORDER_OPEN_STATUSES], [
    "open",
    "confirmed",
    "preparing",
    "ready",
    "served",
  ]);
  assert.deepEqual([...ORDER_EDITABLE_STATUSES], ["draft", "open"]);
  assert.deepEqual([...ORDER_CANCELLABLE_STATUSES], [
    "draft",
    "open",
    "confirmed",
    "preparing",
  ]);
  assert.equal(isOpenStatus("confirmed"), true);
  assert.equal(isOpenStatus("completed"), false);
  assert.equal(isEditableStatus("open"), true);
  assert.equal(isEditableStatus("confirmed"), false);
  assert.equal(isCancellableStatus("preparing"), true);
  assert.equal(isCancellableStatus("completed"), false);
});

test("each status maps to the action permission mirroring the SQL guard", () => {
  assert.equal(ORDER_TARGET_PERMISSIONS.cancelled, "orders.cancel");
  assert.equal(ORDER_TARGET_PERMISSIONS.completed, "orders.update");
  assert.equal(ORDER_TARGET_PERMISSIONS.preparing, "orders.update");
  assert.equal(permissionForTargetStatus("preparing"), "orders.update");
  assert.equal(permissionForTargetStatus("cancelled"), "orders.cancel");
  assert.deepEqual(ORDER_WRITE_PERMISSIONS, {
    updateItems: "orders.update",
    updateDetails: "orders.update",
    merge: "orders.update",
    split: "orders.update",
  });
});

test("merge policy: only open orders, discount capped at subtotal", () => {
  assert.equal(
    canMergeOrders({ sourceStatus: "open", targetStatus: "open" }),
    true
  );
  assert.equal(
    canMergeOrders({ sourceStatus: "open", targetStatus: "draft" }),
    true
  );
  assert.equal(
    canMergeOrders({ sourceStatus: "confirmed", targetStatus: "open" }),
    false
  );
  assert.equal(
    canMergeOrders({ sourceStatus: "open", targetStatus: "completed" }),
    false
  );

  assert.equal(
    mergedDiscountAmount({
      sourceDiscount: 5,
      targetDiscount: 3,
      targetSubtotal: 50,
    }),
    8
  );
  assert.equal(
    mergedDiscountAmount({
      sourceDiscount: 40,
      targetDiscount: 30,
      targetSubtotal: 50,
    }),
    50
  );
});

test("merge policy rejects reflexive merge", () => {
  assert.equal(canMergeDistinctOrders(ORDER, ORDER), false);
  assert.equal(canMergeDistinctOrders("11111111-1111-4111-8111-111111111111", ORDER), true);
});

test("split policy resolves only the movable items of the source", () => {
  assert.equal(
    canSplitOrder({ sourceStatus: "open", selectedItemIds: [ITEM_A], ownedItemIds: [ITEM_A] }),
    true
  );
  assert.equal(
    canSplitOrder({ sourceStatus: "confirmed", selectedItemIds: [ITEM_A], ownedItemIds: [ITEM_A] }),
    false
  );
  assert.equal(
    canSplitOrder({ sourceStatus: "open", selectedItemIds: [], ownedItemIds: [] }),
    false
  );

  const resolved = resolveSplitItemIds({
    sourceStatus: "open",
    selectedItemIds: [ITEM_A, "99999999-9999-4999-8999-999999999999"],
    ownedItemIds: [ITEM_B, ITEM_A],
  });
  assert.deepEqual(resolved, [ITEM_A]);

  assert.equal(
    hasMovableItems({
      sourceStatus: "open",
      selectedItemIds: [ITEM_A],
      ownedItemIds: [ITEM_A],
    }),
    true
  );
  assert.equal(
    hasMovableItems({
      sourceStatus: "open",
      selectedItemIds: [ITEM_A],
      ownedItemIds: [ITEM_B],
    }),
    false
  );
});

test("order list filters schema normalizes page inputs", () => {
  const parsed = orderListFiltersSchema.safeParse({ page: "3", pageSize: "25" });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.page, 3);
    assert.equal(parsed.data.pageSize, 25);
  }
  assert.equal(orderListFiltersSchema.safeParse({ status: "bogus" }).success, false);
  assert.equal(
    orderListFiltersSchema.safeParse({ pageSize: 500 }).success,
    false
  );
});

test("merge/split schemas reject reflexive and empty payloads", () => {
  assert.equal(
    mergeOrdersSchema.safeParse({ sourceOrderId: ORDER, targetOrderId: ORDER }).success,
    false
  );
  assert.equal(
    splitOrderSchema.safeParse({ sourceOrderId: ORDER, items: [] }).success,
    false
  );
  assert.equal(
    splitOrderSchema
      .safeParse({ sourceOrderId: ORDER, orderType: "dine_in", items: [ITEM_A] })
      .success,
    true
  );
});
