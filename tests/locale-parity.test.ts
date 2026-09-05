import { test } from "node:test";
import assert from "node:assert/strict";
import frAuth from "../src/locales/fr/auth.json";
import enAuth from "../src/locales/en/auth.json";
import arAuth from "../src/locales/ar/auth.json";
import frValidation from "../src/locales/fr/validation.json";
import enValidation from "../src/locales/en/validation.json";
import arValidation from "../src/locales/ar/validation.json";
import frUsers from "../src/locales/fr/users.json";
import enUsers from "../src/locales/en/users.json";
import arUsers from "../src/locales/ar/users.json";
import frRoles from "../src/locales/fr/roles.json";
import enRoles from "../src/locales/en/roles.json";
import arRoles from "../src/locales/ar/roles.json";
import frPermissions from "../src/locales/fr/permissions.json";
import enPermissions from "../src/locales/en/permissions.json";
import arPermissions from "../src/locales/ar/permissions.json";
import frAuthorization from "../src/locales/fr/authorization.json";
import enAuthorization from "../src/locales/en/authorization.json";
import arAuthorization from "../src/locales/ar/authorization.json";
import frUnits from "../src/locales/fr/units.json";
import enUnits from "../src/locales/en/units.json";
import arUnits from "../src/locales/ar/units.json";
import frUnitConversions from "../src/locales/fr/unitConversions.json";
import enUnitConversions from "../src/locales/en/unitConversions.json";
import arUnitConversions from "../src/locales/ar/unitConversions.json";
import frCategories from "../src/locales/fr/categories.json";
import enCategories from "../src/locales/en/categories.json";
import arCategories from "../src/locales/ar/categories.json";
import frProducts from "../src/locales/fr/products.json";
import enProducts from "../src/locales/en/products.json";
import arProducts from "../src/locales/ar/products.json";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function flatten(value: JsonValue, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return [prefix];
  }
  if (Array.isArray(value)) {
    return value.length ? [prefix] : [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  );
}

function sortedKeys(value: JsonValue): string[] {
  return flatten(value).sort();
}

const namespaces = [
  ["auth", enAuth, frAuth, arAuth],
  ["validation", enValidation, frValidation, arValidation],
  ["users", enUsers, frUsers, arUsers],
  ["roles", enRoles, frRoles, arRoles],
  ["permissions", enPermissions, frPermissions, arPermissions],
  ["authorization", enAuthorization, frAuthorization, arAuthorization],
  ["units", enUnits, frUnits, arUnits],
  ["unitConversions", enUnitConversions, frUnitConversions, arUnitConversions],
  ["categories", enCategories, frCategories, arCategories],
  ["products", enProducts, frProducts, arProducts],
] as const;

for (const [ns, en, fr, ar] of namespaces) {
  test(`${ns} namespace keys match across fr/en/ar`, () => {
    assert.deepEqual(sortedKeys(en), sortedKeys(fr));
    assert.deepEqual(sortedKeys(ar), sortedKeys(fr));
  });
}

test("every translation value is a non-empty string", () => {
  const walk = (value: JsonValue, ns: string) => {
    if (typeof value === "string") {
      assert.notEqual(value.trim(), "", `${ns} has an empty string`);
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([k, child]) =>
        walk(child as JsonValue, `${ns}.${k}`)
      );
    }
  };
  for (const [_ns, en, fr, ar] of namespaces) {
    walk(en, `en.${_ns}`);
    walk(fr, `fr.${_ns}`);
    walk(ar, `ar.${_ns}`);
  }
});