import { test } from "node:test";
import assert from "node:assert/strict";
import type { CategoryLike } from "../src/lib/categories/types";
import {
  buildTree,
  flattenTree,
  collectSubtreeIds,
  findChildren,
  wouldCreateCycle,
  nextSortOrder,
  pathOfCategory,
} from "../src/lib/categories/tree";
import { slugify, isValidSlug } from "../src/lib/categories/slug";
import {
  groupTranslations,
  resolveCategoryName,
  resolveCategoryDescription,
} from "../src/lib/categories/translations";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";

const cat = (
  id: string,
  parent_id: string | null,
  sort_order = 10,
  name = id
): CategoryLike => ({ id, parent_id, sort_order, name });

/** Boissons (root) > Café > Espresso-like hierarchy used across tests. */
function sampleTree(): CategoryLike[] {
  return [
    cat("boissons", null, 10, "Boissons"),
    cat("cuisine", null, 20, "Cuisine"),
    cat("cafe", "boissons", 10, "Café"),
    cat("the", "boissons", 20, "Thé"),
    cat("espresso", "cafe", 10, "Espresso"),
    cat("infusion", "cafe", 20, "Infusion"),
  ];
}

test("slugify normalizes accents, spaces and case", () => {
  assert.equal(slugify("Boissons Chaudes"), "boissons-chaudes");
  assert.equal(slugify("Café Gourmand"), "cafe-gourmand");
  assert.equal(slugify("  Plats & spécialités  "), "plats-specialites");
  assert.equal(slugify("---"), "categorie");
  assert.equal(isValidSlug("boissons-chaudes"), true);
  assert.equal(isValidSlug("Boissons"), false);
  assert.equal(isValidSlug("boissons--chaudes"), false);
  assert.equal(isValidSlug("ok"), true);
});

test("buildTree groups by parent and sorts by (sort_order, name)", () => {
  const tree = buildTree(sampleTree());
  assert.equal(tree.length, 2);
  assert.equal(tree[0].node.id, "boissons"); // sort_order 10 before 20
  assert.equal(tree[1].node.id, "cuisine");

  const boissons = tree[0];
  assert.equal(boissons.children.length, 2);
  assert.equal(boissons.children[0].node.id, "cafe"); // 10 before 20
  assert.equal(boissons.children[1].node.id, "the");

  assert.equal(boissons.children[0].children.length, 2);
  assert.equal(boissons.children[0].children[0].node.id, "espresso");
});

test("flattenTree yields reading order with depth and path", () => {
  const flat = flattenTree(buildTree(sampleTree()));
  assert.equal(flat.length, 6);
  assert.equal(flat[0].depth, 0);
  assert.equal(flat[0].path, "Boissons");
  assert.equal(flat[1].depth, 1);
  assert.equal(flat[1].path, "Boissons / Café");
  assert.equal(flat[2].depth, 2);
  assert.equal(flat[3].path, "Boissons / Café / Infusion");
  assert.equal(flat[4].path, "Boissons / Thé");
  assert.equal(flat[5].depth, 0, "Cuisine is a root node");
});

test("collectSubtreeIds includes the node and all descendants", () => {
  const ids = collectSubtreeIds(sampleTree(), "boissons");
  assert.deepEqual(
    [...ids].sort(),
    ["boissons", "cafe", "espresso", "infusion", "the"].sort()
  );
  assert.equal(collectSubtreeIds(sampleTree(), "espresso").size, 1);
  assert.equal(collectSubtreeIds(sampleTree(), "missing").size, 0);
});

test("findChildren returns direct children only", () => {
  assert.deepEqual(
    findChildren(sampleTree(), "cafe").map((c) => c.id).sort(),
    ["espresso", "infusion"].sort()
  );
  assert.deepEqual(findChildren(sampleTree(), "espresso"), []);
});

test("wouldCreateCycle detects self and descendant parenting", () => {
  // espresso under itself
  assert.equal(wouldCreateCycle(sampleTree(), "espresso", "espresso"), true);
  // boissons under its own descendant
  assert.equal(wouldCreateCycle(sampleTree(), "boissons", "cafe"), true);
  assert.equal(wouldCreateCycle(sampleTree(), "boissons", "infusion"), true);
  // safe moves
  assert.equal(wouldCreateCycle(sampleTree(), "espresso", "boissons"), false);
  assert.equal(wouldCreateCycle(sampleTree(), "boissons", "cuisine"), false);
  assert.equal(wouldCreateCycle(sampleTree(), "espresso", null), false);
});

test("nextSortOrder steps after the max sibling order", () => {
  assert.equal(nextSortOrder(sampleTree(), "boissons"), 30);
  assert.equal(nextSortOrder(sampleTree(), "cafe"), 30);
  assert.equal(nextSortOrder(sampleTree(), "cuisine"), 10);
  assert.equal(nextSortOrder([], null), 10);
});

test("pathOfCategory builds a breadcrumb", () => {
  assert.equal(pathOfCategory(sampleTree(), "espresso"), "Boissons / Café / Espresso");
  assert.equal(pathOfCategory(sampleTree(), "cuisine"), "Cuisine");
  assert.equal(pathOfCategory(sampleTree(), "missing"), null);
});

test("groupTranslations indexes rows by category then locale", () => {
  const rows = [
    { category_id: "c1", locale: "fr", name: "Boissons", description: "x" },
    { category_id: "c1", locale: "en", name: "Drinks", description: null },
    { category_id: "c2", locale: "fr", name: "Cuisine", description: "y" },
  ];
  const grouped = groupTranslations(rows as never);
  assert.equal(grouped.c1?.fr?.name, "Boissons");
  assert.equal(grouped.c1?.en?.name, "Drinks");
  assert.equal(grouped.c2?.fr?.description, "y");
  assert.equal(grouped.c2?.en, undefined);
});

test("resolveCategoryName falls back active -> fr -> en -> master", () => {
  const full = {
    fr: { name: "Boissons", description: "f" },
    en: { name: "Drinks", description: "e" },
    ar: { name: "المشروبات", description: "a" },
  };
  assert.equal(resolveCategoryName("Master", full, "ar"), "المشروبات");
  assert.equal(resolveCategoryName("Master", full, "en"), "Drinks");
  assert.equal(resolveCategoryName("Master", full, "fr"), "Boissons");

  const onlyFr = { fr: { name: "Boissons", description: "f" } };
  assert.equal(resolveCategoryName("Master", onlyFr, "ar"), "Boissons");
  assert.equal(resolveCategoryName("Master", onlyFr, "en"), "Boissons");
  assert.equal(resolveCategoryName("Master", onlyFr, "fr"), "Boissons");

  const onlyEn = { en: { name: "Drinks", description: "e" } };
  // even in fr, the fallback chain reaches the EN translation before the master
  assert.equal(resolveCategoryName("Master", onlyEn, "fr"), "Drinks");
  assert.equal(resolveCategoryName("Master", onlyEn, "unknown"), "Drinks");

  assert.equal(resolveCategoryName("Master", {}, "unknown-locale"), "Master");
});

test("resolveCategoryDescription falls back like the name resolver", () => {
  const tr = { ar: { name: "المشروبات", description: "أ" } };
  assert.equal(resolveCategoryDescription("fr", tr, "ar"), "أ");
  assert.equal(resolveCategoryDescription("fr", tr, "en"), "fr");
  assert.equal(resolveCategoryDescription(null, {}, "ar"), null);
});

test("category DB constraints map to stable domain codes", () => {
  const cycle = toAuthorizationError({ message: "category_cycle" });
  assert.equal(cycle.code, "CATEGORY_CYCLE");
  const protectedRow = toAuthorizationError({
    message: "system_category_protected",
  });
  assert.equal(protectedRow.code, "SYSTEM_CATEGORY_PROTECTED");
  assert.equal(
    authorizationErrorKey("CATEGORY_HAS_CHILDREN"),
    "authorization.errors.categoryHasChildren"
  );
  assert.equal(
    authorizationErrorKey("SYSTEM_CATEGORY_PROTECTED"),
    "authorization.errors.systemCategory"
  );
});