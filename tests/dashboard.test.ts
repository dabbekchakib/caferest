import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TZ = "UTC";
import {
  computeDashboardStats,
  revenueByDay,
  revenueByType,
  startOfDay,
  REVENUE_STATUSES,
} from "../src/lib/dashboard/metrics";
import type { PosOrderSummary } from "../src/lib/pos/types";

function makeOrder(
  overrides: Partial<PosOrderSummary> & { createdAt: string }
): PosOrderSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    orderNumber: "#001",
    status: "completed",
    orderType: "takeaway",
    tableId: null,
    tableNumber: null,
    diningAreaId: null,
    diningAreaName: null,
    customerId: null,
    customerName: null,
    serverName: null,
    notes: null,
    itemsCount: 1,
    quantity: 1,
    subtotal: 10,
    discountAmount: 0,
    taxAmount: 0,
    total: 10,
    heldAt: null,
    confirmedAt: null,
    cancelledAt: null,
    updatedAt: overrides.createdAt,
    ...overrides,
  };
}

const NOW = new Date("2026-09-06T14:30:00Z");
const TODAY_MIDDAY = "2026-09-06T12:00:00Z";

function hour(h: number): string {
  const d = new Date(NOW);
  d.setUTCHours(h, 0, 0, 0);
  return d.toISOString();
}

test("REVENUE_STATUSES contains completed and served", () => {
  assert.deepEqual([...REVENUE_STATUSES].sort(), ["completed", "served"]);
});

test("startOfDay zeroes the clock", () => {
  const start = startOfDay(NOW);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
});

test("computeDashboardStats sums only today's closed orders", () => {
  const orders = [
    makeOrder({ createdAt: TODAY_MIDDAY, total: 40, quantity: 4 }),
    makeOrder({
      createdAt: TODAY_MIDDAY,
      total: 15,
      quantity: 2,
      status: "served",
    }),
    makeOrder({
      createdAt: TODAY_MIDDAY,
      total: 99,
      quantity: 9,
      status: "open",
    }),
    makeOrder({ createdAt: "2026-09-05T12:00:00Z", total: 500, quantity: 5 }),
  ];

  const stats = computeDashboardStats(orders, 3, NOW);

  // only today's orders: 40 + 15 + 99
  assert.equal(stats.ordersCount, 3);
  // revenue only closed: 40 + 15
  assert.equal(stats.revenue, 55);
  // basket = 55 / 2
  assert.equal(stats.averageOrder, 27.5);
  // items sold only closed: 4 + 2
  assert.equal(stats.productsSold, 6);
  assert.equal(stats.openOrdersCount, 3);
});

test("computeDashboardStats with no data yields zeros", () => {
  const stats = computeDashboardStats([], 0, NOW);
  assert.deepEqual(stats, {
    revenue: 0,
    ordersCount: 0,
    averageOrder: 0,
    productsSold: 0,
    openOrdersCount: 0,
  });
});

test("revenueByDay buckets by day in ascending order", () => {
  const orders = [
    makeOrder({ createdAt: "2026-09-05T10:00:00Z", total: 10 }),
    makeOrder({ createdAt: "2026-09-06T08:00:00Z", total: 20 }),
    makeOrder({ createdAt: hour(9), total: 30 }),
    makeOrder({
      createdAt: hour(10),
      total: 40,
      status: "cancelled",
    }),
    makeOrder({ createdAt: "2026-08-01T00:00:00Z", total: 999 }),
  ];

  const buckets = revenueByDay(orders, NOW, 3);

  assert.equal(buckets.length, 3);
  assert.equal(buckets[0].dayStart.getUTCDate(), 4);
  assert.equal(buckets[0].total, 0);
  assert.equal(buckets[1].dayStart.getUTCDate(), 5);
  assert.equal(buckets[1].total, 10);
  assert.equal(buckets[2].dayStart.getUTCDate(), 6);
  assert.equal(buckets[2].total, 50); // 20 + 30, cancelled ignored
});

test("revenueByType aggregates today's closed orders per type", () => {
  const orders = [
    makeOrder({ createdAt: TODAY_MIDDAY, orderType: "dine_in", total: 10 }),
    makeOrder({ createdAt: TODAY_MIDDAY, orderType: "dine_in", total: 20 }),
    makeOrder({
      createdAt: TODAY_MIDDAY,
      orderType: "takeaway",
      total: 5,
      status: "open",
    }),
    makeOrder({ createdAt: TODAY_MIDDAY, orderType: "delivery", total: 8 }),
    makeOrder({ createdAt: "2026-09-05T08:00:00Z", orderType: "counter", total: 7 }),
  ];

  const totals = revenueByType(orders, NOW);

  assert.equal(totals.dine_in, 30);
  assert.equal(totals.delivery, 8);
  assert.equal(totals.takeaway, undefined); // ignored (still open)
  assert.equal(totals.counter, undefined); // ignored (yesterday)
});