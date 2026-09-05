import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "../src/validations/auth";

test("loginSchema accepts valid credentials", () => {
  const result = loginSchema.safeParse({
    email: "chef@cafe.rest",
    password: "secret",
  });
  assert.equal(result.success, true);
});

test("loginSchema rejects a malformed email", () => {
  const result = loginSchema.safeParse({
    email: "not-an-email",
    password: "secret",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const emailIssue = result.error.issues.find(
      (i) => i.path.join(".") === "email"
    );
    assert.equal(emailIssue?.message, "validation.invalidEmail");
  }
});

test("loginSchema requires every field", () => {
  const result = loginSchema.safeParse({ email: "", password: "" });
  assert.equal(result.success, false);
  if (!result.success) {
    const messages = Array.from(
      new Set(result.error.issues.map((i) => i.message))
    ).sort();
    assert.deepEqual(messages, [
      "validation.invalidEmail",
      "validation.required",
    ]);
  }
});

test("forgotPasswordSchema only needs a valid email", () => {
  assert.equal(
    forgotPasswordSchema.safeParse({ email: "chef@cafe.rest" }).success,
    true
  );
  assert.equal(forgotPasswordSchema.safeParse({ email: "bad" }).success, false);
});

test("resetPasswordSchema enforces length and reports the min param", () => {
  const result = resetPasswordSchema.safeParse({
    password: "123",
    confirmPassword: "123",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const issue = result.error.issues.find(
      (i) => i.path.join(".") === "password"
    );
    assert.equal(issue?.message, "validation.passwordTooShortCount");
    const candidate = issue as typeof issue & { minimum?: number };
    assert.equal(candidate.minimum, 6);
  }
});

test("resetPasswordSchema requires matching passwords", () => {
  const result = resetPasswordSchema.safeParse({
    password: "longEnough",
    confirmPassword: "different",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const issue = result.error.issues.find(
      (i) => i.path.join(".") === "confirmPassword"
    );
    assert.equal(issue?.message, "validation.passwordMismatch");
  }
});

test("resetPasswordSchema accepts a valid pair", () => {
  assert.equal(
    resetPasswordSchema.safeParse({
      password: "longEnough",
      confirmPassword: "longEnough",
    }).success,
    true
  );
});
