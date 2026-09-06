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
import frIngredients from "../src/locales/fr/ingredients.json";
import enIngredients from "../src/locales/en/ingredients.json";
import arIngredients from "../src/locales/ar/ingredients.json";
import frRecipes from "../src/locales/fr/recipes.json";
import enRecipes from "../src/locales/en/recipes.json";
import arRecipes from "../src/locales/ar/recipes.json";
import frRecipeForm from "../src/locales/fr/recipeForm.json";
import enRecipeForm from "../src/locales/en/recipeForm.json";
import arRecipeForm from "../src/locales/ar/recipeForm.json";
import frRecipeBuilder from "../src/locales/fr/recipeBuilder.json";
import enRecipeBuilder from "../src/locales/en/recipeBuilder.json";
import arRecipeBuilder from "../src/locales/ar/recipeBuilder.json";
import frRecipeDetails from "../src/locales/fr/recipeDetails.json";
import enRecipeDetails from "../src/locales/en/recipeDetails.json";
import arRecipeDetails from "../src/locales/ar/recipeDetails.json";
import frRecipeStatus from "../src/locales/fr/recipeStatus.json";
import enRecipeStatus from "../src/locales/en/recipeStatus.json";
import arRecipeStatus from "../src/locales/ar/recipeStatus.json";
import frRecipeActions from "../src/locales/fr/recipeActions.json";
import enRecipeActions from "../src/locales/en/recipeActions.json";
import arRecipeActions from "../src/locales/ar/recipeActions.json";
import frRecipeValidation from "../src/locales/fr/recipeValidation.json";
import enRecipeValidation from "../src/locales/en/recipeValidation.json";
import arRecipeValidation from "../src/locales/ar/recipeValidation.json";
import frRecipeCost from "../src/locales/fr/recipeCost.json";
import enRecipeCost from "../src/locales/en/recipeCost.json";
import arRecipeCost from "../src/locales/ar/recipeCost.json";
import frRecipeVersions from "../src/locales/fr/recipeVersions.json";
import enRecipeVersions from "../src/locales/en/recipeVersions.json";
import arRecipeVersions from "../src/locales/ar/recipeVersions.json";
import frRecipeYield from "../src/locales/fr/recipeYield.json";
import enRecipeYield from "../src/locales/en/recipeYield.json";
import arRecipeYield from "../src/locales/ar/recipeYield.json";
import frYield from "../src/locales/fr/yield.json";
import enYield from "../src/locales/en/yield.json";
import arYield from "../src/locales/ar/yield.json";
import frYieldForm from "../src/locales/fr/yieldForm.json";
import enYieldForm from "../src/locales/en/yieldForm.json";
import arYieldForm from "../src/locales/ar/yieldForm.json";
import frYieldTypes from "../src/locales/fr/yieldTypes.json";
import enYieldTypes from "../src/locales/en/yieldTypes.json";
import arYieldTypes from "../src/locales/ar/yieldTypes.json";
import frYieldValidation from "../src/locales/fr/yieldValidation.json";
import enYieldValidation from "../src/locales/en/yieldValidation.json";
import arYieldValidation from "../src/locales/ar/yieldValidation.json";
import frYieldCalculator from "../src/locales/fr/yieldCalculator.json";
import enYieldCalculator from "../src/locales/en/yieldCalculator.json";
import arYieldCalculator from "../src/locales/ar/yieldCalculator.json";
import frYieldPreview from "../src/locales/fr/yieldPreview.json";
import enYieldPreview from "../src/locales/en/yieldPreview.json";
import arYieldPreview from "../src/locales/ar/yieldPreview.json";
import frYieldConsumption from "../src/locales/fr/yieldConsumption.json";
import enYieldConsumption from "../src/locales/en/yieldConsumption.json";
import arYieldConsumption from "../src/locales/ar/yieldConsumption.json";
import frYieldRange from "../src/locales/fr/yieldRange.json";
import enYieldRange from "../src/locales/en/yieldRange.json";
import arYieldRange from "../src/locales/ar/yieldRange.json";
import frYieldBatch from "../src/locales/fr/yieldBatch.json";
import enYieldBatch from "../src/locales/en/yieldBatch.json";
import arYieldBatch from "../src/locales/ar/yieldBatch.json";
import frYieldPortion from "../src/locales/fr/yieldPortion.json";
import enYieldPortion from "../src/locales/en/yieldPortion.json";
import arYieldPortion from "../src/locales/ar/yieldPortion.json";
import frSuppliers from "../src/locales/fr/suppliers.json";
import enSuppliers from "../src/locales/en/suppliers.json";
import arSuppliers from "../src/locales/ar/suppliers.json";
import frSupplierForm from "../src/locales/fr/supplierForm.json";
import enSupplierForm from "../src/locales/en/supplierForm.json";
import arSupplierForm from "../src/locales/ar/supplierForm.json";
import frSupplierDetails from "../src/locales/fr/supplierDetails.json";
import enSupplierDetails from "../src/locales/en/supplierDetails.json";
import arSupplierDetails from "../src/locales/ar/supplierDetails.json";
import frSupplierCatalog from "../src/locales/fr/supplierCatalog.json";
import enSupplierCatalog from "../src/locales/en/supplierCatalog.json";
import arSupplierCatalog from "../src/locales/ar/supplierCatalog.json";
import frSupplierContacts from "../src/locales/fr/supplierContacts.json";
import enSupplierContacts from "../src/locales/en/supplierContacts.json";
import arSupplierContacts from "../src/locales/ar/supplierContacts.json";
import frSupplierPricing from "../src/locales/fr/supplierPricing.json";
import enSupplierPricing from "../src/locales/en/supplierPricing.json";
import arSupplierPricing from "../src/locales/ar/supplierPricing.json";
import frSupplierFilters from "../src/locales/fr/supplierFilters.json";
import enSupplierFilters from "../src/locales/en/supplierFilters.json";
import arSupplierFilters from "../src/locales/ar/supplierFilters.json";
import frSupplierValidation from "../src/locales/fr/supplierValidation.json";
import enSupplierValidation from "../src/locales/en/supplierValidation.json";
import arSupplierValidation from "../src/locales/ar/supplierValidation.json";
import frSupplierActions from "../src/locales/fr/supplierActions.json";
import enSupplierActions from "../src/locales/en/supplierActions.json";
import arSupplierActions from "../src/locales/ar/supplierActions.json";
import frSupplierComparison from "../src/locales/fr/supplierComparison.json";
import enSupplierComparison from "../src/locales/en/supplierComparison.json";
import arSupplierComparison from "../src/locales/ar/supplierComparison.json";
import frPurchaseOrders from "../src/locales/fr/purchaseOrders.json";
import enPurchaseOrders from "../src/locales/en/purchaseOrders.json";
import arPurchaseOrders from "../src/locales/ar/purchaseOrders.json";
import frPurchaseOrderForm from "../src/locales/fr/purchaseOrderForm.json";
import enPurchaseOrderForm from "../src/locales/en/purchaseOrderForm.json";
import arPurchaseOrderForm from "../src/locales/ar/purchaseOrderForm.json";
import frPurchaseOrderDetails from "../src/locales/fr/purchaseOrderDetails.json";
import enPurchaseOrderDetails from "../src/locales/en/purchaseOrderDetails.json";
import arPurchaseOrderDetails from "../src/locales/ar/purchaseOrderDetails.json";
import frPurchaseOrderItems from "../src/locales/fr/purchaseOrderItems.json";
import enPurchaseOrderItems from "../src/locales/en/purchaseOrderItems.json";
import arPurchaseOrderItems from "../src/locales/ar/purchaseOrderItems.json";
import frPurchaseOrderStatus from "../src/locales/fr/purchaseOrderStatus.json";
import enPurchaseOrderStatus from "../src/locales/en/purchaseOrderStatus.json";
import arPurchaseOrderStatus from "../src/locales/ar/purchaseOrderStatus.json";
import frPurchaseOrderActions from "../src/locales/fr/purchaseOrderActions.json";
import enPurchaseOrderActions from "../src/locales/en/purchaseOrderActions.json";
import arPurchaseOrderActions from "../src/locales/ar/purchaseOrderActions.json";
import frPurchaseOrderValidation from "../src/locales/fr/purchaseOrderValidation.json";
import enPurchaseOrderValidation from "../src/locales/en/purchaseOrderValidation.json";
import arPurchaseOrderValidation from "../src/locales/ar/purchaseOrderValidation.json";
import frPurchaseOrderTotals from "../src/locales/fr/purchaseOrderTotals.json";
import enPurchaseOrderTotals from "../src/locales/en/purchaseOrderTotals.json";
import arPurchaseOrderTotals from "../src/locales/ar/purchaseOrderTotals.json";
import frPurchaseOrderFilters from "../src/locales/fr/purchaseOrderFilters.json";
import enPurchaseOrderFilters from "../src/locales/en/purchaseOrderFilters.json";
import arPurchaseOrderFilters from "../src/locales/ar/purchaseOrderFilters.json";
import frPurchaseOrderPrint from "../src/locales/fr/purchaseOrderPrint.json";
import enPurchaseOrderPrint from "../src/locales/en/purchaseOrderPrint.json";
import arPurchaseOrderPrint from "../src/locales/ar/purchaseOrderPrint.json";
import frPurchaseOrderHistory from "../src/locales/fr/purchaseOrderHistory.json";
import enPurchaseOrderHistory from "../src/locales/en/purchaseOrderHistory.json";
import arPurchaseOrderHistory from "../src/locales/ar/purchaseOrderHistory.json";
import frReceipts from "../src/locales/fr/receipts.json";
import enReceipts from "../src/locales/en/receipts.json";
import arReceipts from "../src/locales/ar/receipts.json";
import frReceiptForm from "../src/locales/fr/receiptForm.json";
import enReceiptForm from "../src/locales/en/receiptForm.json";
import arReceiptForm from "../src/locales/ar/receiptForm.json";
import frReceiptDetails from "../src/locales/fr/receiptDetails.json";
import enReceiptDetails from "../src/locales/en/receiptDetails.json";
import arReceiptDetails from "../src/locales/ar/receiptDetails.json";
import frReceiptItems from "../src/locales/fr/receiptItems.json";
import enReceiptItems from "../src/locales/en/receiptItems.json";
import arReceiptItems from "../src/locales/ar/receiptItems.json";
import frReceiptStatus from "../src/locales/fr/receiptStatus.json";
import enReceiptStatus from "../src/locales/en/receiptStatus.json";
import arReceiptStatus from "../src/locales/ar/receiptStatus.json";
import frReceiptActions from "../src/locales/fr/receiptActions.json";
import enReceiptActions from "../src/locales/en/receiptActions.json";
import arReceiptActions from "../src/locales/ar/receiptActions.json";
import frReceiptValidation from "../src/locales/fr/receiptValidation.json";
import enReceiptValidation from "../src/locales/en/receiptValidation.json";
import arReceiptValidation from "../src/locales/ar/receiptValidation.json";
import frReceiptTotals from "../src/locales/fr/receiptTotals.json";
import enReceiptTotals from "../src/locales/en/receiptTotals.json";
import arReceiptTotals from "../src/locales/ar/receiptTotals.json";
import frReceiptFilters from "../src/locales/fr/receiptFilters.json";
import enReceiptFilters from "../src/locales/en/receiptFilters.json";
import arReceiptFilters from "../src/locales/ar/receiptFilters.json";
import frReceiptPrint from "../src/locales/fr/receiptPrint.json";
import enReceiptPrint from "../src/locales/en/receiptPrint.json";
import arReceiptPrint from "../src/locales/ar/receiptPrint.json";
import frReceiptHistory from "../src/locales/fr/receiptHistory.json";
import enReceiptHistory from "../src/locales/en/receiptHistory.json";
import arReceiptHistory from "../src/locales/ar/receiptHistory.json";
import frStockReceipt from "../src/locales/fr/stockReceipt.json";
import enStockReceipt from "../src/locales/en/stockReceipt.json";
import arStockReceipt from "../src/locales/ar/stockReceipt.json";
import frStocktakes from "../src/locales/fr/stocktakes.json";
import enStocktakes from "../src/locales/en/stocktakes.json";
import arStocktakes from "../src/locales/ar/stocktakes.json";
import frStocktakeForm from "../src/locales/fr/stocktakeForm.json";
import enStocktakeForm from "../src/locales/en/stocktakeForm.json";
import arStocktakeForm from "../src/locales/ar/stocktakeForm.json";
import frStocktakeCount from "../src/locales/fr/stocktakeCount.json";
import enStocktakeCount from "../src/locales/en/stocktakeCount.json";
import arStocktakeCount from "../src/locales/ar/stocktakeCount.json";
import frStocktakeReview from "../src/locales/fr/stocktakeReview.json";
import enStocktakeReview from "../src/locales/en/stocktakeReview.json";
import arStocktakeReview from "../src/locales/ar/stocktakeReview.json";
import frStocktakeDetails from "../src/locales/fr/stocktakeDetails.json";
import enStocktakeDetails from "../src/locales/en/stocktakeDetails.json";
import arStocktakeDetails from "../src/locales/ar/stocktakeDetails.json";
import frStocktakeStatus from "../src/locales/fr/stocktakeStatus.json";
import enStocktakeStatus from "../src/locales/en/stocktakeStatus.json";
import arStocktakeStatus from "../src/locales/ar/stocktakeStatus.json";
import frStocktakeActions from "../src/locales/fr/stocktakeActions.json";
import enStocktakeActions from "../src/locales/en/stocktakeActions.json";
import arStocktakeActions from "../src/locales/ar/stocktakeActions.json";
import frStocktakeValidation from "../src/locales/fr/stocktakeValidation.json";
import enStocktakeValidation from "../src/locales/en/stocktakeValidation.json";
import arStocktakeValidation from "../src/locales/ar/stocktakeValidation.json";
import frStocktakeVariance from "../src/locales/fr/stocktakeVariance.json";
import enStocktakeVariance from "../src/locales/en/stocktakeVariance.json";
import arStocktakeVariance from "../src/locales/ar/stocktakeVariance.json";
import frStocktakeFilters from "../src/locales/fr/stocktakeFilters.json";
import enStocktakeFilters from "../src/locales/en/stocktakeFilters.json";
import arStocktakeFilters from "../src/locales/ar/stocktakeFilters.json";
import frStocktakeHistory from "../src/locales/fr/stocktakeHistory.json";
import enStocktakeHistory from "../src/locales/en/stocktakeHistory.json";
import arStocktakeHistory from "../src/locales/ar/stocktakeHistory.json";
import frStocktakePrint from "../src/locales/fr/stocktakePrint.json";
import enStocktakePrint from "../src/locales/en/stocktakePrint.json";
import arStocktakePrint from "../src/locales/ar/stocktakePrint.json";

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
  ["ingredients", enIngredients, frIngredients, arIngredients],
  ["recipes", enRecipes, frRecipes, arRecipes],
  ["recipeForm", enRecipeForm, frRecipeForm, arRecipeForm],
  ["recipeBuilder", enRecipeBuilder, frRecipeBuilder, arRecipeBuilder],
  ["recipeDetails", enRecipeDetails, frRecipeDetails, arRecipeDetails],
  ["recipeStatus", enRecipeStatus, frRecipeStatus, arRecipeStatus],
  ["recipeActions", enRecipeActions, frRecipeActions, arRecipeActions],
  ["recipeValidation", enRecipeValidation, frRecipeValidation, arRecipeValidation],
  ["recipeCost", enRecipeCost, frRecipeCost, arRecipeCost],
  ["recipeVersions", enRecipeVersions, frRecipeVersions, arRecipeVersions],
  ["recipeYield", enRecipeYield, frRecipeYield, arRecipeYield],
  ["yield", enYield, frYield, arYield],
  ["yieldForm", enYieldForm, frYieldForm, arYieldForm],
  ["yieldTypes", enYieldTypes, frYieldTypes, arYieldTypes],
  ["yieldValidation", enYieldValidation, frYieldValidation, arYieldValidation],
  ["yieldCalculator", enYieldCalculator, frYieldCalculator, arYieldCalculator],
  ["yieldPreview", enYieldPreview, frYieldPreview, arYieldPreview],
  ["yieldConsumption", enYieldConsumption, frYieldConsumption, arYieldConsumption],
  ["yieldRange", enYieldRange, frYieldRange, arYieldRange],
  ["yieldBatch", enYieldBatch, frYieldBatch, arYieldBatch],
  ["yieldPortion", enYieldPortion, frYieldPortion, arYieldPortion],
  ["suppliers", enSuppliers, frSuppliers, arSuppliers],
  ["supplierForm", enSupplierForm, frSupplierForm, arSupplierForm],
  ["supplierDetails", enSupplierDetails, frSupplierDetails, arSupplierDetails],
  ["supplierCatalog", enSupplierCatalog, frSupplierCatalog, arSupplierCatalog],
  ["supplierContacts", enSupplierContacts, frSupplierContacts, arSupplierContacts],
  ["supplierPricing", enSupplierPricing, frSupplierPricing, arSupplierPricing],
  ["supplierFilters", enSupplierFilters, frSupplierFilters, arSupplierFilters],
  ["supplierValidation", enSupplierValidation, frSupplierValidation, arSupplierValidation],
  ["supplierActions", enSupplierActions, frSupplierActions, arSupplierActions],
  ["supplierComparison", enSupplierComparison, frSupplierComparison, arSupplierComparison],
  ["purchaseOrders", enPurchaseOrders, frPurchaseOrders, arPurchaseOrders],
  ["purchaseOrderForm", enPurchaseOrderForm, frPurchaseOrderForm, arPurchaseOrderForm],
  ["purchaseOrderDetails", enPurchaseOrderDetails, frPurchaseOrderDetails, arPurchaseOrderDetails],
  ["purchaseOrderItems", enPurchaseOrderItems, frPurchaseOrderItems, arPurchaseOrderItems],
  ["purchaseOrderStatus", enPurchaseOrderStatus, frPurchaseOrderStatus, arPurchaseOrderStatus],
  ["purchaseOrderActions", enPurchaseOrderActions, frPurchaseOrderActions, arPurchaseOrderActions],
  ["purchaseOrderValidation", enPurchaseOrderValidation, frPurchaseOrderValidation, arPurchaseOrderValidation],
  ["purchaseOrderTotals", enPurchaseOrderTotals, frPurchaseOrderTotals, arPurchaseOrderTotals],
  ["purchaseOrderFilters", enPurchaseOrderFilters, frPurchaseOrderFilters, arPurchaseOrderFilters],
  ["purchaseOrderPrint", enPurchaseOrderPrint, frPurchaseOrderPrint, arPurchaseOrderPrint],
  ["purchaseOrderHistory", enPurchaseOrderHistory, frPurchaseOrderHistory, arPurchaseOrderHistory],
  ["receipts", enReceipts, frReceipts, arReceipts],
  ["receiptForm", enReceiptForm, frReceiptForm, arReceiptForm],
  ["receiptDetails", enReceiptDetails, frReceiptDetails, arReceiptDetails],
  ["receiptItems", enReceiptItems, frReceiptItems, arReceiptItems],
  ["receiptStatus", enReceiptStatus, frReceiptStatus, arReceiptStatus],
  ["receiptActions", enReceiptActions, frReceiptActions, arReceiptActions],
  ["receiptValidation", enReceiptValidation, frReceiptValidation, arReceiptValidation],
  ["receiptTotals", enReceiptTotals, frReceiptTotals, arReceiptTotals],
  ["receiptFilters", enReceiptFilters, frReceiptFilters, arReceiptFilters],
  ["receiptPrint", enReceiptPrint, frReceiptPrint, arReceiptPrint],
  ["receiptHistory", enReceiptHistory, frReceiptHistory, arReceiptHistory],
  ["stockReceipt", enStockReceipt, frStockReceipt, arStockReceipt],
  ["stocktakes", enStocktakes, frStocktakes, arStocktakes],
  ["stocktakeForm", enStocktakeForm, frStocktakeForm, arStocktakeForm],
  ["stocktakeCount", enStocktakeCount, frStocktakeCount, arStocktakeCount],
  ["stocktakeReview", enStocktakeReview, frStocktakeReview, arStocktakeReview],
  ["stocktakeDetails", enStocktakeDetails, frStocktakeDetails, arStocktakeDetails],
  ["stocktakeStatus", enStocktakeStatus, frStocktakeStatus, arStocktakeStatus],
  ["stocktakeActions", enStocktakeActions, frStocktakeActions, arStocktakeActions],
  ["stocktakeValidation", enStocktakeValidation, frStocktakeValidation, arStocktakeValidation],
  ["stocktakeVariance", enStocktakeVariance, frStocktakeVariance, arStocktakeVariance],
  ["stocktakeFilters", enStocktakeFilters, frStocktakeFilters, arStocktakeFilters],
  ["stocktakeHistory", enStocktakeHistory, frStocktakeHistory, arStocktakeHistory],
  ["stocktakePrint", enStocktakePrint, frStocktakePrint, arStocktakePrint],
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