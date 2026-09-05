import { test } from "node:test";
import assert from "node:assert/strict";
import frAuth from "../src/locales/fr/auth.json";
import enAuth from "../src/locales/en/auth.json";
import arAuth from "../src/locales/ar/auth.json";
import frValidation from "../src/locales/fr/validation.json";
import enValidation from "../src/locales/en/validation.json";
import arValidation from "../src/locales/ar/validation.json";

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

test("auth namespace keys match across fr/en/ar", () => {
  assert.deepEqual(sortedKeys(enAuth), sortedKeys(frAuth));
  assert.deepEqual(sortedKeys(arAuth), sortedKeys(frAuth));
});

test("validation namespace keys match across fr/en/ar", () => {
  assert.deepEqual(sortedKeys(enValidation), sortedKeys(frValidation));
  assert.deepEqual(sortedKeys(arValidation), sortedKeys(frValidation));
});

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
  for (const pair of [
    [frAuth, "fr.auth"],
    [enAuth, "en.auth"],
    [arAuth, "ar.auth"],
    [frValidation, "fr.validation"],
    [enValidation, "en.validation"],
    [arValidation, "ar.validation"],
  ] as const) {
    walk(pair[0], pair[1]);
  }
});
