import { test } from "node:test";
import assert from "node:assert/strict";
import {
  navSections,
  flattenNavItems,
  registeredRoutes,
  bottomNavItems,
  resolveBreadcrumbTrail,
  resolveNavLabelKey,
} from "../src/lib/navigation";
import frNavigation from "../src/locales/fr/navigation.json";
import enNavigation from "../src/locales/en/navigation.json";
import arNavigation from "../src/locales/ar/navigation.json";

test("navigation registry references only distinct real routes", () => {
  const routes = registeredRoutes();
  assert.equal(new Set(routes).size, routes.length, "duplicate routes in registry");
  assert.ok(routes.length >= 15, "registry should expose the main modules");
  assert.ok(routes.includes("/dashboard"));
  assert.ok(routes.includes("/pos"));
  assert.ok(routes.includes("/orders"));
  assert.ok(routes.includes("/products"));
  assert.ok(routes.includes("/purchase-orders"));
  assert.ok(routes.includes("/receipts"));
  assert.ok(routes.includes("/stocktakes"));
  assert.ok(routes.includes("/settings"));
});

test("registry has no dead placeholder links", () => {
  const hrefs = new Set([
    ...flattenNavItems().map((item) => item.href),
    ...bottomNavItems.map((item) => item.href),
  ]);
  for (const dead of [
    "/kitchen",
    "/bar",
    "/sales",
    "/tickets",
    "/payments",
    "/register",
    "/yields",
    "/purchase-requests",
    "/inventory",
    "/stock-movements",
    "/customers",
    "/loyalty",
    "/reports",
    "/analytics",
    "/logs",
    "/goods-receipts",
    "/users/create",
    "/roles/create",
  ]) {
    assert.equal(hrefs.has(dead), false, `dead link still referenced: ${dead}`);
  }
});

test("every registry labelKey exists in all three navigation locales", () => {
  const keys = new Set<string>([
    ...flattenNavItems().map((item) => item.labelKey),
    ...navSections.map((section) => section.labelKey),
    ...bottomNavItems.map((item) => item.labelKey),
    "home",
    "detail",
    "label",
    "mobileLabel",
  ]);
  for (const key of keys) {
    assert.ok(key in enNavigation, `navigation.en missing "${key}"`);
    assert.ok(key in frNavigation, `navigation.fr missing "${key}"`);
    assert.ok(key in arNavigation, `navigation.ar missing "${key}"`);
  }
});

test("breadcrumbs resolve from the central registry", () => {
  assert.deepEqual(resolveBreadcrumbTrail("/dashboard"), [
    { href: "/dashboard", labelKey: "home" },
  ]);

  assert.deepEqual(resolveBreadcrumbTrail("/orders"), [
    { href: "/dashboard", labelKey: "home" },
    { href: "/orders", labelKey: "orders" },
  ]);

  assert.deepEqual(resolveBreadcrumbTrail("/orders/1234"), [
    { href: "/dashboard", labelKey: "home" },
    { href: "/orders", labelKey: "orders" },
    { href: "", labelKey: "detail" },
  ]);

  assert.deepEqual(resolveBreadcrumbTrail("/products/abc/edit"), [
    { href: "/dashboard", labelKey: "home" },
    { href: "/products", labelKey: "products" },
    { href: "", labelKey: "detail" },
  ]);

  assert.deepEqual(resolveBreadcrumbTrail("/purchase-orders/xyz/print"), [
    { href: "/dashboard", labelKey: "home" },
    { href: "/purchase-orders", labelKey: "purchaseOrders" },
    { href: "", labelKey: "detail" },
  ]);
});

test("breadcrumbs pick the longest matching registered prefix", () => {
  assert.equal(resolveNavLabelKey("/orders/abc"), "orders");
  assert.equal(resolveNavLabelKey("/settings"), "settings");
  assert.equal(resolveNavLabelKey("/unmatched-route"), null);
});