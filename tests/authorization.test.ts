import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSION_MODULES,
  PERMISSION_SLUGS,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLE_LEVELS,
  ADMIN_ROLE_CODES,
  PERMISSIONS_BY_MODULE,
  SUPER_ADMIN_CODE,
  isPermissionSlug,
  getPermissionsByModule,
} from "../src/lib/authorization/permissions";
import {
  canAccess,
  canAccessAny,
  canAccessAll,
  buildPermissionSet,
  mergeRoles,
  maxRoleLevel,
  canManageLevel,
} from "../src/lib/authorization/compute";
import {
  AuthorizationError,
  isAuthorizationError,
  toAuthorizationError,
  authorizationErrorKey,
  AUTHORIZATION_ERROR_CODES,
  DB_CONSTRAINT_TO_CODE,
} from "../src/lib/authorization/errors";
import { ok, okVoid, fail } from "../src/lib/authorization/action-result";

test("permission slugs are unique", () => {
  assert.equal(new Set(PERMISSION_SLUGS).size, PERMISSION_SLUGS.length);
});

test("every slug follows <module>.<action> with a known module", () => {
  for (const slug of PERMISSION_SLUGS) {
    const token = slug.split(".")[0];
    // `audit_logs.view` belongs to the `audit` module in the UI matrix.
    assert.ok(
      PERMISSION_MODULES.includes(token as (typeof PERMISSION_MODULES)[number]) ||
        token === "audit_logs",
      `unexpected slug ${slug}`
    );
    assert.ok(slug.split(".").length === 2, `malformed slug ${slug}`);
  }
});

test("getPermissionsByModule covers every module and reuses the catalog", () => {
  const grouped = getPermissionsByModule();
  for (const mod of PERMISSION_MODULES) {
    assert.ok(grouped[mod].length >= 0, `missing module ${mod}`);
  }
  const flattened = Object.values(grouped).flat();
  assert.equal(flattened.length, PERMISSION_SLUGS.length - 1); // audit_logs.view is aliased
  for (const slug of flattened) {
    assert.ok(isPermissionSlug(slug), `unknown slug ${slug}`);
  }
});

test("system role matrices reference valid slugs", () => {
  for (const code of SYSTEM_ROLE_CODES) {
    const matrix = SYSTEM_ROLE_DEFAULT_PERMISSIONS[code];
    for (const slug of matrix) {
      assert.ok(isPermissionSlug(slug), `${code} has unknown slug ${slug}`);
    }
  }
});

test("super admin and admin hold the full catalog", () => {
  assert.equal(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.super_admin.length,
    PERMISSION_SLUGS.length
  );
  assert.equal(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.admin.length,
    PERMISSION_SLUGS.length
  );
});

test("admin role codes are known system roles with levels", () => {
  for (const code of ADMIN_ROLE_CODES) {
    assert.ok(code in SYSTEM_ROLE_LEVELS, `missing level for ${code}`);
    assert.ok(SYSTEM_ROLE_CODES.includes(code as never), `unknown code ${code}`);
  }
  assert.equal(ADMIN_ROLE_CODES[0], SUPER_ADMIN_CODE);
});

test("canAccess is deny-by-default", () => {
  const empty = buildPermissionSet([]);
  assert.equal(canAccess(empty, "users.view"), false);
  assert.equal(canAccess(empty, ""), false);
  assert.equal(canAccess(buildPermissionSet(["roles.view"]), "orders.view"), false);
  assert.equal(
    canAccess(buildPermissionSet(["users.view"]), "users.view"),
    true
  );
});

test("canAccessAny / canAccessAll", () => {
  const set = buildPermissionSet(["users.view", "roles.update"]);
  assert.equal(canAccessAny(set, ["orders.view", "roles.view"]), false);
  assert.equal(canAccessAny(set, ["orders.view", "users.view"]), true);
  assert.equal(canAccessAll(set, ["users.view", "roles.update"]), true);
  assert.equal(canAccessAll(set, ["users.view", "users.delete"]), false);
});

test("mergeRoles unions matrices", () => {
  const merged = mergeRoles([
    ["users.view"],
    ["users.view", "roles.view"],
    ["orders.create"],
  ]);
  assert.equal(merged.size, 3);
  assert.equal(canAccess(merged, "orders.create"), true);
});

test("maxRoleLevel returns highest and 0 for empty", () => {
  assert.equal(maxRoleLevel([]), 0);
  assert.equal(
    maxRoleLevel([
      { level: 40 },
      { level: 80 },
      { level: 60 },
    ]),
    80
  );
});

test("canManageLevel is strictly greater", () => {
  assert.equal(canManageLevel(80, 60), true);
  assert.equal(canManageLevel(60, 80), false);
  assert.equal(canManageLevel(80, 80), false);
});

test("errors translate to stable keys and map db constraints", () => {
  const err = new AuthorizationError("ROLE_HIERARCHY");
  assert.equal(isAuthorizationError(err), true);
  assert.equal(authorizationErrorKey("ROLE_HIERARCHY"), "authorization.errors.roleHierarchy");

  for (const [constraint, code] of Object.entries(DB_CONSTRAINT_TO_CODE)) {
    const converted = toAuthorizationError({ message: constraint });
    assert.equal(converted.code, code, `constraint ${constraint}`);
  }

  const generic = toAuthorizationError(new Error("boom"));
  assert.equal(generic.code, "GENERIC");
  assert.equal(
    authorizationErrorKey("GENERIC"),
    "authorization.errors.generic"
  );
});

test("action results keep ok/fail shapes", () => {
  assert.deepEqual(okVoid(), { ok: true, data: undefined });
  assert.deepEqual(ok({ id: "abc" }), { ok: true, data: { id: "abc" } });

  const failed = fail(new AuthorizationError("SELF_MODIFICATION"));
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.code, "SELF_MODIFICATION");
    assert.equal(failed.key, "authorization.errors.selfModification");
  }

  const generic = fail(new Error("nope"));
  assert.equal(generic.ok, false);
  if (!generic.ok) {
    assert.equal(generic.code, "GENERIC");
  }
});