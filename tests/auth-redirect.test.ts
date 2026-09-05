import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ROUTES,
  DEFAULT_AUTHENTICATED_ROUTE,
  getSafeRedirect,
  getSignInUrl,
  isPublicPathname,
  isSafeRedirectPath,
  LOGIN_ROUTE,
} from "../src/lib/auth/auth-redirect";

test("isSafeRedirectPath accepts same-origin single-slash paths", () => {
  assert.equal(isSafeRedirectPath("/dashboard"), true);
  assert.equal(isSafeRedirectPath("/orders/42"), true);
  assert.equal(isSafeRedirectPath("/products?tab=active"), true);
});

test("isSafeRedirectPath rejects unsafe targets", () => {
  assert.equal(isSafeRedirectPath(""), false);
  assert.equal(isSafeRedirectPath("dashboard"), false);
  assert.equal(isSafeRedirectPath("//evil.example"), false);
  assert.equal(isSafeRedirectPath("https://evil.example"), false);
  assert.equal(isSafeRedirectPath("javascript:alert(1)"), false);
  assert.equal(isSafeRedirectPath("/\\evil.example"), false);
  assert.equal(isSafeRedirectPath("/path with:colon"), false);
  const tooLong = "/" + "a".repeat(2048);
  assert.equal(isSafeRedirectPath(tooLong), false);
  assert.equal(isSafeRedirectPath(123), false);
  assert.equal(isSafeRedirectPath(null), false);
  assert.equal(isSafeRedirectPath(undefined), false);
});

test("getSafeRedirect falls back to a safe default", () => {
  assert.equal(getSafeRedirect("/tables"), "/tables");
  assert.equal(getSafeRedirect(["/pos"]), "/pos");
  assert.equal(getSafeRedirect(["", "/pos"]), DEFAULT_AUTHENTICATED_ROUTE);
  assert.equal(
    getSafeRedirect("https://evil.example"),
    DEFAULT_AUTHENTICATED_ROUTE
  );
  assert.equal(getSafeRedirect(undefined), DEFAULT_AUTHENTICATED_ROUTE);
});

test("getSignInUrl keeps a safe target and drops unsafe ones", () => {
  assert.equal(getSignInUrl("/orders"), `${LOGIN_ROUTE}?redirect=%2Forders`);
  assert.equal(getSignInUrl("//evil.example"), LOGIN_ROUTE);
  assert.equal(getSignInUrl(undefined), LOGIN_ROUTE);
});

test("isPublicPathname recognizes auth flow and api paths", () => {
  for (const route of AUTH_ROUTES) {
    assert.equal(isPublicPathname(route), true);
  }
  assert.equal(isPublicPathname("/account-disabled"), true);
  assert.equal(isPublicPathname("/api/orders"), true);
  assert.equal(isPublicPathname("/dashboard"), false);
  assert.equal(isPublicPathname("/"), false);
});
