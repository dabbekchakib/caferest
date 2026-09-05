import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ERROR_KEYS,
  isResumableNetworkError,
  resolveAuthFaultKey,
} from "../src/lib/auth/auth-errors";

test("resolveAuthFaultKey maps Supabase error codes", () => {
  assert.equal(
    resolveAuthFaultKey({ message: "no", code: "invalid_credentials" }),
    AUTH_ERROR_KEYS.invalidCredentials
  );
  assert.equal(
    resolveAuthFaultKey({ message: "no", code: "email_not_confirmed" }),
    AUTH_ERROR_KEYS.emailNotConfirmed
  );
  assert.equal(
    resolveAuthFaultKey({
      message: "rate limit",
      code: "over_request_rate_limit",
    }),
    AUTH_ERROR_KEYS.tooManyRequests
  );
});

test("resolveAuthFaultKey prefers HTTP status codes", () => {
  assert.equal(
    resolveAuthFaultKey({ message: "no", status: 429 }),
    AUTH_ERROR_KEYS.tooManyRequests
  );
  assert.equal(
    resolveAuthFaultKey({ message: "no", status: 503 }),
    AUTH_ERROR_KEYS.network
  );
  assert.equal(
    resolveAuthFaultKey({ message: "no", status: 401 }),
    AUTH_ERROR_KEYS.invalidCredentials
  );
});

test("resolveAuthFaultKey inspects messages as a last resort", () => {
  assert.equal(
    resolveAuthFaultKey({ message: "invalid login credentials" }),
    AUTH_ERROR_KEYS.invalidCredentials
  );
  assert.equal(
    resolveAuthFaultKey({ message: "Email not confirmed yet" }),
    AUTH_ERROR_KEYS.emailNotConfirmed
  );
  assert.equal(
    resolveAuthFaultKey({ message: "you hit a rate limit" }),
    AUTH_ERROR_KEYS.tooManyRequests
  );
});

test("resolveAuthFaultKey falls back to generic", () => {
  assert.equal(
    resolveAuthFaultKey({ message: "boom" }),
    AUTH_ERROR_KEYS.generic
  );
  assert.equal(resolveAuthFaultKey(null), AUTH_ERROR_KEYS.unknown);
  assert.equal(resolveAuthFaultKey(undefined), AUTH_ERROR_KEYS.unknown);
});

test("isResumableNetworkError flags offline and 5xx/429", () => {
  assert.equal(isResumableNetworkError({ status: 0 }), true);
  assert.equal(isResumableNetworkError({ status: 429 }), true);
  assert.equal(isResumableNetworkError({ status: 502 }), true);
  assert.equal(isResumableNetworkError({ status: 503 }), true);
  assert.equal(isResumableNetworkError({ status: 504 }), true);
  assert.equal(isResumableNetworkError({ status: 400 }), false);
  assert.equal(isResumableNetworkError({ message: "no" }), true);
  assert.equal(isResumableNetworkError(null), false);
});
