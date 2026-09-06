import { test } from "node:test";
import assert from "node:assert/strict";
import type { DiningTable } from "../src/lib/tables/types";
import {
  DINING_TABLE_STATUSES,
  DINING_TABLE_SHAPES,
  TABLE_STATUS_META,
  TABLE_SHAPE_LABEL_KEYS,
  TABLE_STATUS_LABEL_KEYS,
  TABLE_MIN_SIZE,
  isDiningTableStatus,
  isDiningTableShape,
} from "../src/lib/tables/status";
import {
  slugify,
  isValidDiningSlug,
  resolveDiningAreaName,
} from "../src/lib/tables/translations";
import {
  DINING_AREA_ICONS,
  diningAreaIcon,
  isDiningAreaIconKey,
} from "../src/lib/tables/icons";
import {
  FLOOR_PLAN_SIZE,
  FLOOR_PLAN_SNAP,
  FLOOR_PLAN_FINE_SNAP,
  snapToGrid,
  clampNumber,
  clampRotation,
  snapRotation,
  withinCanvas,
  tableBox,
  tableCenter,
  rectsOverlap,
  clampDimension,
  normalizeFloorPatches,
} from "../src/lib/floor-plan/geometry";
import {
  createDiningAreaSchema,
  createTableSchema,
  updateTableFloorPlanSchema,
  diningSlugSchema,
} from "../src/validations/tables";

const EST = "11111111-1111-4111-8111-111111111111";
const TABLE_ID = "22222222-2222-4222-8222-222222222222";

test("slugify normalizes accents and collapses separators", () => {
  assert.equal(slugify("Salle   principale!"), "salle-principale");
  assert.equal(slugify("La Terrasse"), "la-terrasse");
  assert.equal(slugify("Café 217"), "cafe-217");
  assert.equal(slugify("阿拉伯语"), "element");
  assert.equal(slugify("---"), "element");
  assert.ok(slugify("a".repeat(120)).length <= 80);
});

test("isValidDiningSlug accepts safe slugs only", () => {
  assert.ok(isValidDiningSlug("salle-principale"));
  assert.ok(isValidDiningSlug("t4"));
  assert.ok(!isValidDiningSlug(""));
  assert.ok(!isValidDiningSlug("Salle"));
  assert.ok(!isValidDiningSlug("salle--2"));
  assert.ok(!isValidDiningSlug("-salle"));
  assert.ok(!isValidDiningSlug("salle-"));
  assert.ok(!isValidDiningSlug("a".repeat(81)));
});

test("dining slug schema trims and rejects invalid values", () => {
  assert.equal(diningSlugSchema.safeParse(" Salle ").success, false);
  assert.equal(diningSlugSchema.safeParse("salle").success, true);
});

test("resolveDiningAreaName prefers the localized name", () => {
  assert.equal(
    resolveDiningAreaName(
      { name: "Salle", translations: { ar: { name: "القاعة" } } } as never,
      "ar"
    ),
    "القاعة"
  );
  assert.equal(
    resolveDiningAreaName(
      { name: "Salle", translations: { ar: { name: "  " } } } as never,
      "ar"
    ),
    "Salle"
  );
  assert.equal(
    resolveDiningAreaName({ name: "Salon" } as never, "fr"),
    "Salon"
  );
});

test("table status helpers cover every defined status", () => {
  for (const status of DINING_TABLE_STATUSES) {
    assert.ok(isDiningTableStatus(status));
    assert.ok(TABLE_STATUS_META[status].badge);
    assert.ok(TABLE_STATUS_LABEL_KEYS[status].length > 0);
  }
  assert.ok(!isDiningTableStatus("unknown"));
  assert.ok(!isDiningTableStatus(null));
});

test("table shape helpers cover every defined shape", () => {
  for (const shape of DINING_TABLE_SHAPES) {
    assert.ok(isDiningTableShape(shape));
    assert.ok(TABLE_SHAPE_LABEL_KEYS[shape].length > 0);
  }
  assert.ok(!isDiningTableShape("oval"));
});

test("dining area icons map known keys and fall back", () => {
  assert.ok(DINING_AREA_ICONS.includes("terrasse"));
  assert.ok(isDiningAreaIconKey("vip"));
  assert.ok(!isDiningAreaIconKey("unknown"));
  assert.ok(diningAreaIcon("bar"));
  assert.ok(diningAreaIcon(null));
  assert.ok(diningAreaIcon("unknown"));
});

test("snap and clamp helpers behave predictably", () => {
  assert.equal(snapToGrid(37), 40);
  assert.equal(snapToGrid(37, FLOOR_PLAN_FINE_SNAP), 35);
  assert.equal(clampNumber(123.6, 0, 100), 100);
  assert.equal(clampNumber(-5, 50, 1200), 50);
  assert.equal(clampRotation(375), 15);
  assert.equal(clampRotation(-15), 345);
  assert.equal(snapRotation(22), 15);
  assert.equal(snapRotation(203), 210);
});

test("withinCanvas keeps coordinates inside the virtual canvas", () => {
  assert.equal(withinCanvas(10, 90), 10);
  assert.equal(withinCanvas(FLOOR_PLAN_SIZE, 90), FLOOR_PLAN_SIZE - 90);
  assert.equal(withinCanvas(FLOOR_PLAN_SIZE + 50, 90), FLOOR_PLAN_SIZE - 90);
  assert.equal(withinCanvas(-20), 0);
});

test("tableBox falls back to zero when dimensions are missing", () => {
  const table = {
    width: null,
    height: null,
    position_x: 40,
    position_y: 60,
    rotation: 0,
  } as unknown as DiningTable;
  const box = tableBox(table);
  assert.equal(box.width, 0);
  assert.equal(box.height, 0);
  assert.deepEqual(tableCenter(box), { x: 40, y: 60 });
});

test("tableBox clamps undersized dimensions to the minimum", () => {
  const table = {
    width: 12,
    height: 12,
    position_x: 40,
    position_y: 60,
    rotation: 0,
  } as unknown as DiningTable;
  const box = tableBox(table);
  assert.equal(box.width, TABLE_MIN_SIZE);
  assert.equal(box.height, TABLE_MIN_SIZE);
  assert.deepEqual(tableCenter(box), { x: 65, y: 85 });
});

test("rectsOverlap detects touching and separated boxes", () => {
  assert.ok(rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 50, width: 100, height: 100 }));
  assert.ok(!rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 200, y: 200, width: 50, height: 50 }));
});

test("clampDimension enforces minimum", () => {
  assert.equal(clampDimension(10), TABLE_MIN_SIZE);
  assert.equal(clampDimension(120.4), 120);
});

test("normalizeFloorPatches validates size, rotation and bounds", () => {
  const base = { tableId: TABLE_ID, positionX: 100, positionY: 100, width: 90, height: 90, rotation: 0 };
  const ok = normalizeFloorPatches([{ ...base }]);
  assert.equal(ok.valid, true);
  assert.equal(ok.patches.length, 1);

  assert.equal(normalizeFloorPatches([{ ...base, width: TABLE_MIN_SIZE - 1 }]).valid, false);
  assert.equal(normalizeFloorPatches([{ ...base, width: FLOOR_PLAN_SIZE + 1 }]).valid, false);
  assert.equal(normalizeFloorPatches([{ ...base, rotation: -1 }]).valid, false);
  assert.equal(normalizeFloorPatches([{ ...base, rotation: 361 }]).valid, false);
  assert.equal(normalizeFloorPatches([{ ...base, positionX: -5 }]).valid, false);
  assert.equal(normalizeFloorPatches([{ ...base, positionY: FLOOR_PLAN_SIZE + 5 }]).valid, false);
  assert.equal(normalizeFloorPatches([{ ...base, width: 200, height: 150 }]).patches[0]?.width, 200);
});

test("createDiningAreaSchema enforces slug/name/color rules", () => {
  const valid = createDiningAreaSchema.safeParse({
    establishmentId: EST,
    name: "Terrasse",
    slug: "terrasse",
    color: "#ff8800",
  });
  assert.equal(valid.success, true);

  assert.equal(
    createDiningAreaSchema.safeParse({ establishmentId: EST, name: "T", slug: "terrasse" }).success,
    false
  );
  assert.equal(
    createDiningAreaSchema.safeParse({ establishmentId: EST, name: "Terrasse", slug: "Terrasse" }).success,
    false
  );
  assert.equal(
    createDiningAreaSchema.safeParse({ establishmentId: EST, name: "Terrasse", slug: "terrasse", color: "red" }).success,
    false
  );
});

test("createTableSchema enforces geometry bounds", () => {
  const valid = createTableSchema.safeParse({
    establishmentId: EST,
    name: "Table 4",
    slug: "table-4",
    tableNumber: "4",
    width: 90,
    height: 90,
    rotation: 15,
    positionX: 40,
    positionY: 50,
  });
  assert.equal(valid.success, true);

  assert.equal(
    createTableSchema.safeParse({ establishmentId: EST, name: "Table 4", slug: "table-4", width: 10 }).success,
    false
  );
  assert.equal(
    createTableSchema.safeParse({ establishmentId: EST, name: "Table 4", slug: "table-4", rotation: 450 }).success,
    false
  );
});

test("updateTableFloorPlanSchema requires at least one patch", () => {
  const ok = updateTableFloorPlanSchema.safeParse({
    establishmentId: EST,
    patches: [{ tableId: TABLE_ID, positionX: 1, positionY: 1 }],
  });
  assert.equal(ok.success, true);

  assert.equal(
    updateTableFloorPlanSchema.safeParse({ establishmentId: EST, patches: [] }).success,
    false
  );
});

test("floor plan snap step defaults are consistent", () => {
  assert.equal(FLOOR_PLAN_SNAP, 20);
  assert.equal(snapToGrid(25), 20);
  assert.ok(FLOOR_PLAN_SNAP > FLOOR_PLAN_FINE_SNAP);
});