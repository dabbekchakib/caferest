import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateNormalizedPurchaseCost } from "../src/lib/suppliers/calculations";
import {
  createSupplierSchema,
  updateSupplierSchema,
  createIngredientSupplierSchema,
  updateIngredientSupplierSchema,
  supplierStatusSchema,
} from "../src/validations/suppliers";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";
import {
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLE_CODES,
  isPermissionSlug,
} from "../src/lib/authorization/permissions";
import { canAccess, buildPermissionSet } from "../src/lib/authorization/compute";
import type { UnitConversion } from "../src/lib/units/types";

const EST = "11111111-1111-4111-8111-111111111111";
const SUPPLIER_UUID = "22222222-2222-4222-8222-222222222222";
const INGREDIENT_UUID = "33333333-3333-4333-8333-333333333333";
const UNIT_KG = "44444444-4444-4444-8444-444444444444";
const UNIT_G = "55555555-5555-4555-8555-555555555555";
const UNIT_L = "66666666-6666-4666-8666-666666666666";
const UNIT_ML = "77777777-7777-4777-8777-777777777777";
const UNIT_PC = "88888888-8888-4888-8888-888888888888";
const UNIT_CARTON = "99999999-9999-4999-8999-999999999999";

function conv(
  id: string,
  from: string,
  to: string,
  factor: number
): UnitConversion {
  return {
    id,
    establishment_id: null,
    from_unit_id: from,
    to_unit_id: to,
    factor,
    offset_value: 0,
    is_system: true,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

// System conversions + the demo carton->piece catalog edge (24 per carton).
const catalog: UnitConversion[] = [
  conv("1", UNIT_KG, UNIT_G, 1000),
  conv("2", UNIT_L, UNIT_ML, 1000),
  conv("3", UNIT_CARTON, UNIT_PC, 24),
];

test("normalized cost: 70 TND / 1 kg of coffee -> 0.0700 TND / g", () => {
  const cost = calculateNormalizedPurchaseCost({
    purchasePrice: 70,
    purchaseQuantity: 1,
    purchaseUnitId: UNIT_KG,
    baseUnitId: UNIT_G,
    conversions: catalog,
    baseUnitSymbol: "g",
  });
  assert.ok(cost);
  assert.ok(cost.amount > 0.0699 && cost.amount < 0.0701);
  assert.equal(cost.baseUnitId, UNIT_G);
  assert.equal(cost.baseUnitSymbol, "g");
  assert.equal(cost.pathLabel, "1 step(s)");
});

test("normalized cost: 120 TND / 1 carton of 24 -> 5.0000 TND / piece", () => {
  const cost = calculateNormalizedPurchaseCost({
    purchasePrice: 120,
    purchaseQuantity: 1,
    purchaseUnitId: UNIT_CARTON,
    baseUnitId: UNIT_PC,
    conversions: catalog,
    baseUnitSymbol: "pc",
  });
  assert.ok(cost);
  assert.ok(cost.amount > 4.999 && cost.amount < 5.001);
  assert.equal(cost.baseUnitSymbol, "pc");
});

test("normalized cost: 2.8 TND / 1 L of milk -> 0.0028 TND / ml", () => {
  const cost = calculateNormalizedPurchaseCost({
    purchasePrice: 2.8,
    purchaseQuantity: 1,
    purchaseUnitId: UNIT_L,
    baseUnitId: UNIT_ML,
    conversions: catalog,
    baseUnitSymbol: "ml",
  });
  assert.ok(cost);
  assert.ok(cost.amount > 0.00279 && cost.amount < 0.00281);
});

test("normalized cost: same unit divides by the purchase quantity only", () => {
  const cost = calculateNormalizedPurchaseCost({
    purchasePrice: 100,
    purchaseQuantity: 4,
    purchaseUnitId: UNIT_KG,
    baseUnitId: UNIT_KG,
    conversions: catalog,
    baseUnitSymbol: "kg",
  });
  assert.ok(cost);
  assert.equal(cost.amount, 25);
  assert.equal(cost.pathLabel, null);
});

test("normalized cost returns null when it cannot normalize", () => {
  const params = {
    purchasePrice: 70,
    purchaseQuantity: 1,
    purchaseUnitId: UNIT_KG,
    baseUnitId: UNIT_G,
    conversions: catalog,
  };
  assert.equal(
    calculateNormalizedPurchaseCost({ ...params, baseUnitId: null }),
    null
  );
  assert.equal(
    calculateNormalizedPurchaseCost({ ...params, purchaseUnitId: "" }),
    null
  );
  assert.equal(
    calculateNormalizedPurchaseCost({ ...params, purchaseQuantity: 0 }),
    null
  );
  assert.equal(
    calculateNormalizedPurchaseCost({ ...params, purchasePrice: -1 }),
    null
  );
  // pc -> g have no conversion path.
  assert.equal(
    calculateNormalizedPurchaseCost({ ...params, purchaseUnitId: UNIT_PC }),
    null
  );
});

test("createSupplierSchema accepts a valid supplier", () => {
  const parsed = createSupplierSchema.safeParse({
    establishmentId: EST,
    name: "Café Fournisseur Tunis",
    code: "SUP-0001",
    email: "contact@fournisseur.tn",
    paymentTerms: "30 jours",
    defaultPaymentMethodId: null,
    deliveryLeadTimeDays: 2,
    minimumOrderAmount: 100,
    isActive: true,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.name, "Café Fournisseur Tunis");
  assert.equal(parsed.data.deliveryLeadTimeDays, 2);
});

test("createSupplierSchema rejects bad names, emails and UUIDs", () => {
  assert.equal(
    createSupplierSchema.safeParse({
      establishmentId: "not-a-uuid",
      name: "X",
    }).success,
    false
  );
  assert.equal(
    createSupplierSchema.safeParse({
      establishmentId: EST,
      name: "Fournisseur",
      email: "not-an-email",
    }).success,
    false
  );
  assert.equal(
    createSupplierSchema.safeParse({
      establishmentId: EST,
      name: "Fournisseur",
      deliveryLeadTimeDays: -1,
    }).success,
    false
  );
});

test("updateSupplierSchema requires supplierId + establishmentId", () => {
  const parsed = updateSupplierSchema.safeParse({
    establishmentId: EST,
    supplierId: SUPPLIER_UUID,
    name: "Fournisseur renommé",
    isActive: false,
    contacts: [],
  });
  assert.equal(parsed.success, true);
  assert.equal(
    updateSupplierSchema.safeParse({ name: "sans ids" }).success,
    false
  );
});

test("createIngredientSupplierSchema defaults quantity/price/currency", () => {
  const parsed = createIngredientSupplierSchema.safeParse({
    establishmentId: EST,
    ingredientId: INGREDIENT_UUID,
    supplierId: SUPPLIER_UUID,
    purchaseUnitId: UNIT_KG,
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.purchaseQuantity, 1);
  assert.equal(parsed.data.purchasePrice, 0);
  assert.equal(parsed.data.currencyCode, "TND");
});

test("createIngredientSupplierSchema rejects negative price, zero quantity and bad currency", () => {
  assert.equal(
    createIngredientSupplierSchema.safeParse({
      establishmentId: EST,
      ingredientId: INGREDIENT_UUID,
      supplierId: SUPPLIER_UUID,
      purchaseUnitId: UNIT_KG,
      purchasePrice: -5,
    }).success,
    false
  );
  assert.equal(
    createIngredientSupplierSchema.safeParse({
      establishmentId: EST,
      ingredientId: INGREDIENT_UUID,
      supplierId: SUPPLIER_UUID,
      purchaseUnitId: UNIT_KG,
      purchaseQuantity: 0,
    }).success,
    false
  );
  assert.equal(
    createIngredientSupplierSchema.safeParse({
      establishmentId: EST,
      ingredientId: INGREDIENT_UUID,
      supplierId: SUPPLIER_UUID,
      purchaseUnitId: UNIT_KG,
      currencyCode: "TUNE",
    }).success,
    false
  );
});

test("updateIngredientSupplierSchema tolerates a null price unit and isActive", () => {
  const parsed = updateIngredientSupplierSchema.safeParse({
    establishmentId: EST,
    ingredientSupplierId: SUPPLIER_UUID,
    ingredientId: INGREDIENT_UUID,
    supplierId: SUPPLIER_UUID,
    purchaseUnitId: null,
    isActive: false,
    isPreferred: true,
  });
  assert.equal(parsed.success, true);
});

test("supplierStatusSchema validates the boolean toggle", () => {
  assert.equal(
    supplierStatusSchema.safeParse({
      supplierId: SUPPLIER_UUID,
      establishmentId: EST,
      isActive: true,
    }).success,
    true
  );
  assert.equal(
    supplierStatusSchema.safeParse({
      supplierId: SUPPLIER_UUID,
      establishmentId: EST,
      isActive: "yes",
    }).success,
    false
  );
});

test("supplier DB constraints map to stable domain codes", () => {
  assert.equal(
    toAuthorizationError({ message: "uq_suppliers_establishment_code" }).code,
    "SUPPLIER_DUPLICATE_CODE"
  );
  assert.equal(
    toAuthorizationError({ message: "uq_ingredient_suppliers_item" }).code,
    "INGREDIENT_SUPPLIER_DUPLICATE"
  );
  assert.equal(
    toAuthorizationError({ message: "uq_supplier_contacts_active_primary" }).code,
    "SUPPLIER_CONTACT_INVALID"
  );
  assert.equal(
    toAuthorizationError({ message: "supplier_price_history_price_check" }).code,
    "INGREDIENT_SUPPLIER_NOREFS"
  );
  assert.equal(
    authorizationErrorKey("SUPPLIER_DUPLICATE_CODE"),
    "authorization.errors.supplierDuplicateCode"
  );
  assert.equal(
    authorizationErrorKey("INGREDIENT_SUPPLIER_DUPLICATE"),
    "authorization.errors.ingredientSupplierDuplicate"
  );
});

test("suppliers slugs are registered in the shared permission catalog", () => {
  for (const slug of [
    "suppliers.view",
    "suppliers.create",
    "suppliers.update",
    "suppliers.delete",
    "suppliers.activate",
    "suppliers.manage_catalog",
    "suppliers.view_prices",
    "suppliers.update_prices",
  ]) {
    assert.equal(isPermissionSlug(slug), true, `missing slug ${slug}`);
  }
});

test("role matrix: purchasing and manager hold the full supplier workflow", () => {
  const FULL = [
    "suppliers.view",
    "suppliers.create",
    "suppliers.update",
    "suppliers.delete",
    "suppliers.activate",
    "suppliers.manage_catalog",
    "suppliers.view_prices",
    "suppliers.update_prices",
  ];
  for (const role of ["purchasing", "manager", "admin", "super_admin"] as const) {
    const set = buildPermissionSet(SYSTEM_ROLE_DEFAULT_PERMISSIONS[role]);
    for (const slug of FULL) {
      assert.equal(canAccess(set, slug), true, `${role} should hold ${slug}`);
    }
  }
  const cashierSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.cashier
  );
  assert.equal(canAccess(cashierSet, "suppliers.view"), false);
});

test("role matrix: stock manager reads catalog, accountant reads prices only", () => {
  const stockSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.stock_manager
  );
  assert.equal(canAccess(stockSet, "suppliers.view"), true);
  assert.equal(canAccess(stockSet, "suppliers.manage_catalog"), true);
  assert.equal(canAccess(stockSet, "suppliers.view_prices"), true);
  assert.equal(canAccess(stockSet, "suppliers.update"), false);
  assert.equal(canAccess(stockSet, "suppliers.update_prices"), false);

  const accountantSet = buildPermissionSet(
    SYSTEM_ROLE_DEFAULT_PERMISSIONS.accountant
  );
  assert.equal(canAccess(accountantSet, "suppliers.view"), true);
  assert.equal(canAccess(accountantSet, "suppliers.view_prices"), true);
  assert.equal(canAccess(accountantSet, "suppliers.create"), false);
  assert.equal(canAccess(accountantSet, "suppliers.manage_catalog"), false);

  for (const role of SYSTEM_ROLE_CODES) {
    assert.equal(
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[role].every(isPermissionSlug),
      true,
      `${role} matrix references an unknown slug`
    );
  }
});