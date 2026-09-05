import { test } from "node:test";
import assert from "node:assert/strict";
import { loginSchema, resetPasswordSchema } from "../src/validations/auth";
import { createAuthResolver } from "../src/lib/validation/zod-resolver";

type Resolved = { values: unknown; errors: Record<string, unknown> };

async function run(resolver: unknown, values: unknown): Promise<Resolved> {
  const fn = resolver as (v: unknown) => Promise<Resolved>;
  return fn(values);
}

function key(type: string) {
  return (key: string, params?: Record<string, unknown>): string => {
    const suffix = params
      ? `(${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")})`
      : "";
    return `translated:${type}:${key}${suffix}`;
  };
}

test("resolver returns parsed values and no errors on valid input", async () => {
  const resolver = createAuthResolver(loginSchema, key("login"));
  const result = await run(resolver, {
    email: "chef@cafe.rest",
    password: "secret",
  });
  assert.deepEqual(result.values, {
    email: "chef@cafe.rest",
    password: "secret",
  });
  assert.deepEqual(result.errors, {});
});

test("resolver maps zod issues into FieldErrors with translated messages", async () => {
  const resolver = createAuthResolver(loginSchema, key("login"));
  const result = await run(resolver, { email: "nope", password: "" });
  const errors = result.errors as Record<string, { message: string }>;
  assert.equal(
    errors.email!.message,
    "translated:login:validation.invalidEmail"
  );
  assert.equal(
    errors.password!.message,
    "translated:login:validation.required(min=1)"
  );
});

test("resolver forwards min/max params to the translator", async () => {
  let received: Record<string, unknown> | undefined;
  const resolver = createAuthResolver(resetPasswordSchema, (_key, params) => {
    received = params;
    return "msg";
  });
  await run(resolver, { password: "123", confirmPassword: "123" });
  assert.deepEqual(received, { min: 6 });
});

test("resolver reports one issue per field", async () => {
  const resolver = createAuthResolver(loginSchema, key("login"));
  const result = await run(resolver, { email: "bad", password: "" });
  const errors = result.errors as Record<string, unknown>;
  assert.equal(Object.keys(result.errors).length, 2);
  assert.ok(errors.email);
  assert.ok(errors.password);
});
