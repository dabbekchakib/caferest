import type { Locale } from "@/i18n/routing";
import type { MessageRecord } from "./messages";

import frCommon from "@/locales/fr/common.json";
import frNavigation from "@/locales/fr/navigation.json";
import frDashboard from "@/locales/fr/dashboard.json";
import frPos from "@/locales/fr/pos.json";
import frCart from "@/locales/fr/cart.json";
import frProducts from "@/locales/fr/products.json";
import frInventory from "@/locales/fr/inventory.json";
import frRecipes from "@/locales/fr/recipes.json";
import frRecipeForm from "@/locales/fr/recipeForm.json";
import frRecipeBuilder from "@/locales/fr/recipeBuilder.json";
import frRecipeDetails from "@/locales/fr/recipeDetails.json";
import frRecipeStatus from "@/locales/fr/recipeStatus.json";
import frRecipeActions from "@/locales/fr/recipeActions.json";
import frRecipeValidation from "@/locales/fr/recipeValidation.json";
import frRecipeCost from "@/locales/fr/recipeCost.json";
import frRecipeVersions from "@/locales/fr/recipeVersions.json";
import frRecipeYield from "@/locales/fr/recipeYield.json";
import frPurchasing from "@/locales/fr/purchasing.json";
import frOrders from "@/locales/fr/orders.json";
import frCustomers from "@/locales/fr/customers.json";
import frCashRegister from "@/locales/fr/cashRegister.json";
import frSuppliers from "@/locales/fr/suppliers.json";
import frTables from "@/locales/fr/tables.json";
import frDiningAreas from "@/locales/fr/diningAreas.json";
import frFloorPlan from "@/locales/fr/floorPlan.json";
import frReports from "@/locales/fr/reports.json";
import frKitchen from "@/locales/fr/kitchen.json";
import frBar from "@/locales/fr/bar.json";
import frMenu from "@/locales/fr/menu.json";
import frSettings from "@/locales/fr/settings.json";
import frAuth from "@/locales/fr/auth.json";
import frValidation from "@/locales/fr/validation.json";
import frNotifications from "@/locales/fr/notifications.json";
import frStyleGuide from "@/locales/fr/styleGuide.json";
import frUiTest from "@/locales/fr/uiTest.json";
import frForm from "@/locales/fr/form.json";
import frUsers from "@/locales/fr/users.json";
import frRoles from "@/locales/fr/roles.json";
import frPermissions from "@/locales/fr/permissions.json";
import frAuthorization from "@/locales/fr/authorization.json";
import frUnits from "@/locales/fr/units.json";
import frUnitConversions from "@/locales/fr/unitConversions.json";
import frCategories from "@/locales/fr/categories.json";
import frYield from "@/locales/fr/yield.json";
import frYieldForm from "@/locales/fr/yieldForm.json";
import frYieldTypes from "@/locales/fr/yieldTypes.json";
import frYieldValidation from "@/locales/fr/yieldValidation.json";
import frYieldCalculator from "@/locales/fr/yieldCalculator.json";
import frYieldPreview from "@/locales/fr/yieldPreview.json";
import frYieldConsumption from "@/locales/fr/yieldConsumption.json";
import frYieldRange from "@/locales/fr/yieldRange.json";
import frYieldBatch from "@/locales/fr/yieldBatch.json";
import frYieldPortion from "@/locales/fr/yieldPortion.json";
import frSupplierForm from "@/locales/fr/supplierForm.json";
import frSupplierDetails from "@/locales/fr/supplierDetails.json";
import frSupplierCatalog from "@/locales/fr/supplierCatalog.json";
import frSupplierContacts from "@/locales/fr/supplierContacts.json";
import frSupplierPricing from "@/locales/fr/supplierPricing.json";
import frSupplierFilters from "@/locales/fr/supplierFilters.json";
import frSupplierValidation from "@/locales/fr/supplierValidation.json";
import frSupplierActions from "@/locales/fr/supplierActions.json";
import frSupplierComparison from "@/locales/fr/supplierComparison.json";
import frPurchaseOrders from "@/locales/fr/purchaseOrders.json";
import frPurchaseOrderForm from "@/locales/fr/purchaseOrderForm.json";
import frPurchaseOrderDetails from "@/locales/fr/purchaseOrderDetails.json";
import frPurchaseOrderItems from "@/locales/fr/purchaseOrderItems.json";
import frPurchaseOrderStatus from "@/locales/fr/purchaseOrderStatus.json";
import frPurchaseOrderActions from "@/locales/fr/purchaseOrderActions.json";
import frPurchaseOrderValidation from "@/locales/fr/purchaseOrderValidation.json";
import frPurchaseOrderTotals from "@/locales/fr/purchaseOrderTotals.json";
import frPurchaseOrderFilters from "@/locales/fr/purchaseOrderFilters.json";
import frPurchaseOrderPrint from "@/locales/fr/purchaseOrderPrint.json";
import frPurchaseOrderHistory from "@/locales/fr/purchaseOrderHistory.json";
import frReceipts from "@/locales/fr/receipts.json";
import frReceiptForm from "@/locales/fr/receiptForm.json";
import frReceiptDetails from "@/locales/fr/receiptDetails.json";
import frReceiptItems from "@/locales/fr/receiptItems.json";
import frReceiptStatus from "@/locales/fr/receiptStatus.json";
import frReceiptActions from "@/locales/fr/receiptActions.json";
import frReceiptValidation from "@/locales/fr/receiptValidation.json";
import frReceiptTotals from "@/locales/fr/receiptTotals.json";
import frReceiptFilters from "@/locales/fr/receiptFilters.json";
import frReceiptPrint from "@/locales/fr/receiptPrint.json";
import frReceiptHistory from "@/locales/fr/receiptHistory.json";
import frStockReceipt from "@/locales/fr/stockReceipt.json";
import frStocktakes from "@/locales/fr/stocktakes.json";
import frStocktakeForm from "@/locales/fr/stocktakeForm.json";
import frStocktakeCount from "@/locales/fr/stocktakeCount.json";
import frStocktakeReview from "@/locales/fr/stocktakeReview.json";
import frStocktakeDetails from "@/locales/fr/stocktakeDetails.json";
import frStocktakeStatus from "@/locales/fr/stocktakeStatus.json";
import frStocktakeActions from "@/locales/fr/stocktakeActions.json";
import frStocktakeValidation from "@/locales/fr/stocktakeValidation.json";
import frStocktakeVariance from "@/locales/fr/stocktakeVariance.json";
import frStocktakeFilters from "@/locales/fr/stocktakeFilters.json";
import frStocktakeHistory from "@/locales/fr/stocktakeHistory.json";
import frStocktakePrint from "@/locales/fr/stocktakePrint.json";
import frStockAdjustments from "@/locales/fr/stockAdjustments.json";
import frStockAdjustmentForm from "@/locales/fr/stockAdjustmentForm.json";
import frStockAdjustmentItems from "@/locales/fr/stockAdjustmentItems.json";
import frStockAdjustmentDetails from "@/locales/fr/stockAdjustmentDetails.json";
import frStockAdjustmentStatus from "@/locales/fr/stockAdjustmentStatus.json";
import frStockAdjustmentActions from "@/locales/fr/stockAdjustmentActions.json";
import frStockAdjustmentValidation from "@/locales/fr/stockAdjustmentValidation.json";
import frStockAdjustmentTotals from "@/locales/fr/stockAdjustmentTotals.json";
import frStockAdjustmentFilters from "@/locales/fr/stockAdjustmentFilters.json";
import frStockAdjustmentHistory from "@/locales/fr/stockAdjustmentHistory.json";
import frStockAdjustmentPrint from "@/locales/fr/stockAdjustmentPrint.json";
import frStockAdjustmentTypes from "@/locales/fr/stockAdjustmentTypes.json";

import enCommon from "@/locales/en/common.json";
import enNavigation from "@/locales/en/navigation.json";
import enDashboard from "@/locales/en/dashboard.json";
import enPos from "@/locales/en/pos.json";
import enCart from "@/locales/en/cart.json";
import enProducts from "@/locales/en/products.json";
import enInventory from "@/locales/en/inventory.json";
import enRecipes from "@/locales/en/recipes.json";
import enRecipeForm from "@/locales/en/recipeForm.json";
import enRecipeBuilder from "@/locales/en/recipeBuilder.json";
import enRecipeDetails from "@/locales/en/recipeDetails.json";
import enRecipeStatus from "@/locales/en/recipeStatus.json";
import enRecipeActions from "@/locales/en/recipeActions.json";
import enRecipeValidation from "@/locales/en/recipeValidation.json";
import enRecipeCost from "@/locales/en/recipeCost.json";
import enRecipeVersions from "@/locales/en/recipeVersions.json";
import enRecipeYield from "@/locales/en/recipeYield.json";
import enPurchasing from "@/locales/en/purchasing.json";
import enOrders from "@/locales/en/orders.json";
import enCustomers from "@/locales/en/customers.json";
import enCashRegister from "@/locales/en/cashRegister.json";
import enSuppliers from "@/locales/en/suppliers.json";
import enTables from "@/locales/en/tables.json";
import enDiningAreas from "@/locales/en/diningAreas.json";
import enFloorPlan from "@/locales/en/floorPlan.json";
import enReports from "@/locales/en/reports.json";
import enKitchen from "@/locales/en/kitchen.json";
import enBar from "@/locales/en/bar.json";
import enMenu from "@/locales/en/menu.json";
import enSettings from "@/locales/en/settings.json";
import enAuth from "@/locales/en/auth.json";
import enValidation from "@/locales/en/validation.json";
import enNotifications from "@/locales/en/notifications.json";
import enStyleGuide from "@/locales/en/styleGuide.json";
import enUiTest from "@/locales/en/uiTest.json";
import enForm from "@/locales/en/form.json";
import enUsers from "@/locales/en/users.json";
import enRoles from "@/locales/en/roles.json";
import enPermissions from "@/locales/en/permissions.json";
import enAuthorization from "@/locales/en/authorization.json";
import enUnits from "@/locales/en/units.json";
import enUnitConversions from "@/locales/en/unitConversions.json";
import enCategories from "@/locales/en/categories.json";
import enYield from "@/locales/en/yield.json";
import enYieldForm from "@/locales/en/yieldForm.json";
import enYieldTypes from "@/locales/en/yieldTypes.json";
import enYieldValidation from "@/locales/en/yieldValidation.json";
import enYieldCalculator from "@/locales/en/yieldCalculator.json";
import enYieldPreview from "@/locales/en/yieldPreview.json";
import enYieldConsumption from "@/locales/en/yieldConsumption.json";
import enYieldRange from "@/locales/en/yieldRange.json";
import enYieldBatch from "@/locales/en/yieldBatch.json";
import enYieldPortion from "@/locales/en/yieldPortion.json";
import enSupplierForm from "@/locales/en/supplierForm.json";
import enSupplierDetails from "@/locales/en/supplierDetails.json";
import enSupplierCatalog from "@/locales/en/supplierCatalog.json";
import enSupplierContacts from "@/locales/en/supplierContacts.json";
import enSupplierPricing from "@/locales/en/supplierPricing.json";
import enSupplierFilters from "@/locales/en/supplierFilters.json";
import enSupplierValidation from "@/locales/en/supplierValidation.json";
import enSupplierActions from "@/locales/en/supplierActions.json";
import enSupplierComparison from "@/locales/en/supplierComparison.json";
import enPurchaseOrders from "@/locales/en/purchaseOrders.json";
import enPurchaseOrderForm from "@/locales/en/purchaseOrderForm.json";
import enPurchaseOrderDetails from "@/locales/en/purchaseOrderDetails.json";
import enPurchaseOrderItems from "@/locales/en/purchaseOrderItems.json";
import enPurchaseOrderStatus from "@/locales/en/purchaseOrderStatus.json";
import enPurchaseOrderActions from "@/locales/en/purchaseOrderActions.json";
import enPurchaseOrderValidation from "@/locales/en/purchaseOrderValidation.json";
import enPurchaseOrderTotals from "@/locales/en/purchaseOrderTotals.json";
import enPurchaseOrderFilters from "@/locales/en/purchaseOrderFilters.json";
import enPurchaseOrderPrint from "@/locales/en/purchaseOrderPrint.json";
import enPurchaseOrderHistory from "@/locales/en/purchaseOrderHistory.json";
import enReceipts from "@/locales/en/receipts.json";
import enReceiptForm from "@/locales/en/receiptForm.json";
import enReceiptDetails from "@/locales/en/receiptDetails.json";
import enReceiptItems from "@/locales/en/receiptItems.json";
import enReceiptStatus from "@/locales/en/receiptStatus.json";
import enReceiptActions from "@/locales/en/receiptActions.json";
import enReceiptValidation from "@/locales/en/receiptValidation.json";
import enReceiptTotals from "@/locales/en/receiptTotals.json";
import enReceiptFilters from "@/locales/en/receiptFilters.json";
import enReceiptPrint from "@/locales/en/receiptPrint.json";
import enReceiptHistory from "@/locales/en/receiptHistory.json";
import enStockReceipt from "@/locales/en/stockReceipt.json";
import enStocktakes from "@/locales/en/stocktakes.json";
import enStocktakeForm from "@/locales/en/stocktakeForm.json";
import enStocktakeCount from "@/locales/en/stocktakeCount.json";
import enStocktakeReview from "@/locales/en/stocktakeReview.json";
import enStocktakeDetails from "@/locales/en/stocktakeDetails.json";
import enStocktakeStatus from "@/locales/en/stocktakeStatus.json";
import enStocktakeActions from "@/locales/en/stocktakeActions.json";
import enStocktakeValidation from "@/locales/en/stocktakeValidation.json";
import enStocktakeVariance from "@/locales/en/stocktakeVariance.json";
import enStocktakeFilters from "@/locales/en/stocktakeFilters.json";
import enStocktakeHistory from "@/locales/en/stocktakeHistory.json";
import enStocktakePrint from "@/locales/en/stocktakePrint.json";
import enStockAdjustments from "@/locales/en/stockAdjustments.json";
import enStockAdjustmentForm from "@/locales/en/stockAdjustmentForm.json";
import enStockAdjustmentItems from "@/locales/en/stockAdjustmentItems.json";
import enStockAdjustmentDetails from "@/locales/en/stockAdjustmentDetails.json";
import enStockAdjustmentStatus from "@/locales/en/stockAdjustmentStatus.json";
import enStockAdjustmentActions from "@/locales/en/stockAdjustmentActions.json";
import enStockAdjustmentValidation from "@/locales/en/stockAdjustmentValidation.json";
import enStockAdjustmentTotals from "@/locales/en/stockAdjustmentTotals.json";
import enStockAdjustmentFilters from "@/locales/en/stockAdjustmentFilters.json";
import enStockAdjustmentHistory from "@/locales/en/stockAdjustmentHistory.json";
import enStockAdjustmentPrint from "@/locales/en/stockAdjustmentPrint.json";
import enStockAdjustmentTypes from "@/locales/en/stockAdjustmentTypes.json";

import arCommon from "@/locales/ar/common.json";
import arNavigation from "@/locales/ar/navigation.json";
import arDashboard from "@/locales/ar/dashboard.json";
import arPos from "@/locales/ar/pos.json";
import arCart from "@/locales/ar/cart.json";
import arProducts from "@/locales/ar/products.json";
import arInventory from "@/locales/ar/inventory.json";
import arRecipes from "@/locales/ar/recipes.json";
import arRecipeForm from "@/locales/ar/recipeForm.json";
import arRecipeBuilder from "@/locales/ar/recipeBuilder.json";
import arRecipeDetails from "@/locales/ar/recipeDetails.json";
import arRecipeStatus from "@/locales/ar/recipeStatus.json";
import arRecipeActions from "@/locales/ar/recipeActions.json";
import arRecipeValidation from "@/locales/ar/recipeValidation.json";
import arRecipeCost from "@/locales/ar/recipeCost.json";
import arRecipeVersions from "@/locales/ar/recipeVersions.json";
import arRecipeYield from "@/locales/ar/recipeYield.json";
import arPurchasing from "@/locales/ar/purchasing.json";
import arOrders from "@/locales/ar/orders.json";
import arCustomers from "@/locales/ar/customers.json";
import arCashRegister from "@/locales/ar/cashRegister.json";
import arSuppliers from "@/locales/ar/suppliers.json";
import arTables from "@/locales/ar/tables.json";
import arDiningAreas from "@/locales/ar/diningAreas.json";
import arFloorPlan from "@/locales/ar/floorPlan.json";
import arReports from "@/locales/ar/reports.json";
import arKitchen from "@/locales/ar/kitchen.json";
import arBar from "@/locales/ar/bar.json";
import arMenu from "@/locales/ar/menu.json";
import arSettings from "@/locales/ar/settings.json";
import arAuth from "@/locales/ar/auth.json";
import arValidation from "@/locales/ar/validation.json";
import arNotifications from "@/locales/ar/notifications.json";
import arStyleGuide from "@/locales/ar/styleGuide.json";
import arUiTest from "@/locales/ar/uiTest.json";
import arForm from "@/locales/ar/form.json";
import arUsers from "@/locales/ar/users.json";
import arRoles from "@/locales/ar/roles.json";
import arPermissions from "@/locales/ar/permissions.json";
import arAuthorization from "@/locales/ar/authorization.json";
import arUnits from "@/locales/ar/units.json";
import arUnitConversions from "@/locales/ar/unitConversions.json";
import arCategories from "@/locales/ar/categories.json";
import arYield from "@/locales/ar/yield.json";
import arYieldForm from "@/locales/ar/yieldForm.json";
import arYieldTypes from "@/locales/ar/yieldTypes.json";
import arYieldValidation from "@/locales/ar/yieldValidation.json";
import arYieldCalculator from "@/locales/ar/yieldCalculator.json";
import arYieldPreview from "@/locales/ar/yieldPreview.json";
import arYieldConsumption from "@/locales/ar/yieldConsumption.json";
import arYieldRange from "@/locales/ar/yieldRange.json";
import arYieldBatch from "@/locales/ar/yieldBatch.json";
import arYieldPortion from "@/locales/ar/yieldPortion.json";
import arSupplierForm from "@/locales/ar/supplierForm.json";
import arSupplierDetails from "@/locales/ar/supplierDetails.json";
import arSupplierCatalog from "@/locales/ar/supplierCatalog.json";
import arSupplierContacts from "@/locales/ar/supplierContacts.json";
import arSupplierPricing from "@/locales/ar/supplierPricing.json";
import arSupplierFilters from "@/locales/ar/supplierFilters.json";
import arSupplierValidation from "@/locales/ar/supplierValidation.json";
import arSupplierActions from "@/locales/ar/supplierActions.json";
import arSupplierComparison from "@/locales/ar/supplierComparison.json";
import arPurchaseOrders from "@/locales/ar/purchaseOrders.json";
import arPurchaseOrderForm from "@/locales/ar/purchaseOrderForm.json";
import arPurchaseOrderDetails from "@/locales/ar/purchaseOrderDetails.json";
import arPurchaseOrderItems from "@/locales/ar/purchaseOrderItems.json";
import arPurchaseOrderStatus from "@/locales/ar/purchaseOrderStatus.json";
import arPurchaseOrderActions from "@/locales/ar/purchaseOrderActions.json";
import arPurchaseOrderValidation from "@/locales/ar/purchaseOrderValidation.json";
import arPurchaseOrderTotals from "@/locales/ar/purchaseOrderTotals.json";
import arPurchaseOrderFilters from "@/locales/ar/purchaseOrderFilters.json";
import arPurchaseOrderPrint from "@/locales/ar/purchaseOrderPrint.json";
import arPurchaseOrderHistory from "@/locales/ar/purchaseOrderHistory.json";
import arReceipts from "@/locales/ar/receipts.json";
import arReceiptForm from "@/locales/ar/receiptForm.json";
import arReceiptDetails from "@/locales/ar/receiptDetails.json";
import arReceiptItems from "@/locales/ar/receiptItems.json";
import arReceiptStatus from "@/locales/ar/receiptStatus.json";
import arReceiptActions from "@/locales/ar/receiptActions.json";
import arReceiptValidation from "@/locales/ar/receiptValidation.json";
import arReceiptTotals from "@/locales/ar/receiptTotals.json";
import arReceiptFilters from "@/locales/ar/receiptFilters.json";
import arReceiptPrint from "@/locales/ar/receiptPrint.json";
import arReceiptHistory from "@/locales/ar/receiptHistory.json";
import arStockReceipt from "@/locales/ar/stockReceipt.json";
import arStocktakes from "@/locales/ar/stocktakes.json";
import arStocktakeForm from "@/locales/ar/stocktakeForm.json";
import arStocktakeCount from "@/locales/ar/stocktakeCount.json";
import arStocktakeReview from "@/locales/ar/stocktakeReview.json";
import arStocktakeDetails from "@/locales/ar/stocktakeDetails.json";
import arStocktakeStatus from "@/locales/ar/stocktakeStatus.json";
import arStocktakeActions from "@/locales/ar/stocktakeActions.json";
import arStocktakeValidation from "@/locales/ar/stocktakeValidation.json";
import arStocktakeVariance from "@/locales/ar/stocktakeVariance.json";
import arStocktakeFilters from "@/locales/ar/stocktakeFilters.json";
import arStocktakeHistory from "@/locales/ar/stocktakeHistory.json";
import arStocktakePrint from "@/locales/ar/stocktakePrint.json";
import arStockAdjustments from "@/locales/ar/stockAdjustments.json";
import arStockAdjustmentForm from "@/locales/ar/stockAdjustmentForm.json";
import arStockAdjustmentItems from "@/locales/ar/stockAdjustmentItems.json";
import arStockAdjustmentDetails from "@/locales/ar/stockAdjustmentDetails.json";
import arStockAdjustmentStatus from "@/locales/ar/stockAdjustmentStatus.json";
import arStockAdjustmentActions from "@/locales/ar/stockAdjustmentActions.json";
import arStockAdjustmentValidation from "@/locales/ar/stockAdjustmentValidation.json";
import arStockAdjustmentTotals from "@/locales/ar/stockAdjustmentTotals.json";
import arStockAdjustmentFilters from "@/locales/ar/stockAdjustmentFilters.json";
import arStockAdjustmentHistory from "@/locales/ar/stockAdjustmentHistory.json";
import arStockAdjustmentPrint from "@/locales/ar/stockAdjustmentPrint.json";
import arStockAdjustmentTypes from "@/locales/ar/stockAdjustmentTypes.json";

interface LocaleBundle {
  common: MessageRecord;
  navigation: MessageRecord;
  dashboard: MessageRecord;
  pos: MessageRecord;
  cart: MessageRecord;
  products: MessageRecord;
  inventory: MessageRecord;
  recipes: MessageRecord;
  recipeForm: MessageRecord;
  recipeBuilder: MessageRecord;
  recipeDetails: MessageRecord;
  recipeStatus: MessageRecord;
  recipeActions: MessageRecord;
  recipeValidation: MessageRecord;
  recipeCost: MessageRecord;
  recipeVersions: MessageRecord;
  recipeYield: MessageRecord;
  purchasing: MessageRecord;
  orders: MessageRecord;
  customers: MessageRecord;
  cashRegister: MessageRecord;
  suppliers: MessageRecord;
  tables: MessageRecord;
  diningAreas: MessageRecord;
  floorPlan: MessageRecord;
  reports: MessageRecord;
  kitchen: MessageRecord;
  bar: MessageRecord;
  menu: MessageRecord;
  settings: MessageRecord;
  auth: MessageRecord;
  validation: MessageRecord;
  notifications: MessageRecord;
  styleGuide: MessageRecord;
  uiTest: MessageRecord;
  form: MessageRecord;
  users: MessageRecord;
  roles: MessageRecord;
  permissions: MessageRecord;
  authorization: MessageRecord;
  units: MessageRecord;
  unitConversions: MessageRecord;
  categories: MessageRecord;
  yield: MessageRecord;
  yieldForm: MessageRecord;
  yieldTypes: MessageRecord;
  yieldValidation: MessageRecord;
  yieldCalculator: MessageRecord;
  yieldPreview: MessageRecord;
  yieldConsumption: MessageRecord;
  yieldRange: MessageRecord;
  yieldBatch: MessageRecord;
  yieldPortion: MessageRecord;
  supplierForm: MessageRecord;
  supplierDetails: MessageRecord;
  supplierCatalog: MessageRecord;
  supplierContacts: MessageRecord;
  supplierPricing: MessageRecord;
  supplierFilters: MessageRecord;
  supplierValidation: MessageRecord;
  supplierActions: MessageRecord;
  supplierComparison: MessageRecord;
  purchaseOrders: MessageRecord;
  purchaseOrderForm: MessageRecord;
  purchaseOrderDetails: MessageRecord;
  purchaseOrderItems: MessageRecord;
  purchaseOrderStatus: MessageRecord;
  purchaseOrderActions: MessageRecord;
  purchaseOrderValidation: MessageRecord;
  purchaseOrderTotals: MessageRecord;
  purchaseOrderFilters: MessageRecord;
  purchaseOrderPrint: MessageRecord;
  purchaseOrderHistory: MessageRecord;
  receipts: MessageRecord;
  receiptForm: MessageRecord;
  receiptDetails: MessageRecord;
  receiptItems: MessageRecord;
  receiptStatus: MessageRecord;
  receiptActions: MessageRecord;
  receiptValidation: MessageRecord;
  receiptTotals: MessageRecord;
  receiptFilters: MessageRecord;
  receiptPrint: MessageRecord;
  receiptHistory: MessageRecord;
  stockReceipt: MessageRecord;
  stocktakes: MessageRecord;
  stocktakeForm: MessageRecord;
  stocktakeCount: MessageRecord;
  stocktakeReview: MessageRecord;
  stocktakeDetails: MessageRecord;
  stocktakeStatus: MessageRecord;
  stocktakeActions: MessageRecord;
  stocktakeValidation: MessageRecord;
  stocktakeVariance: MessageRecord;
  stocktakeFilters: MessageRecord;
  stocktakeHistory: MessageRecord;
  stocktakePrint: MessageRecord;
  stockAdjustments: MessageRecord;
  stockAdjustmentForm: MessageRecord;
  stockAdjustmentItems: MessageRecord;
  stockAdjustmentDetails: MessageRecord;
  stockAdjustmentStatus: MessageRecord;
  stockAdjustmentActions: MessageRecord;
  stockAdjustmentValidation: MessageRecord;
  stockAdjustmentTotals: MessageRecord;
  stockAdjustmentFilters: MessageRecord;
  stockAdjustmentHistory: MessageRecord;
  stockAdjustmentPrint: MessageRecord;
  stockAdjustmentTypes: MessageRecord;
}

const fr: LocaleBundle = {
  common: frCommon,
  navigation: frNavigation,
  dashboard: frDashboard,
  pos: frPos,
  cart: frCart,
  products: frProducts,
  inventory: frInventory,
  recipes: frRecipes,
  recipeForm: frRecipeForm,
  recipeBuilder: frRecipeBuilder,
  recipeDetails: frRecipeDetails,
  recipeStatus: frRecipeStatus,
  recipeActions: frRecipeActions,
  recipeValidation: frRecipeValidation,
  recipeCost: frRecipeCost,
  recipeVersions: frRecipeVersions,
  recipeYield: frRecipeYield,
  purchasing: frPurchasing,
  orders: frOrders,
  customers: frCustomers,
  cashRegister: frCashRegister,
  suppliers: frSuppliers,
  tables: frTables,
  diningAreas: frDiningAreas,
  floorPlan: frFloorPlan,
  reports: frReports,
  kitchen: frKitchen,
  bar: frBar,
  menu: frMenu,
  settings: frSettings,
  auth: frAuth,
  validation: frValidation,
  notifications: frNotifications,
  styleGuide: frStyleGuide,
  uiTest: frUiTest,
  form: frForm,
  users: frUsers,
  roles: frRoles,
  permissions: frPermissions,
  authorization: frAuthorization,
  units: frUnits,
  unitConversions: frUnitConversions,
  categories: frCategories,
  yield: frYield,
  yieldForm: frYieldForm,
  yieldTypes: frYieldTypes,
  yieldValidation: frYieldValidation,
  yieldCalculator: frYieldCalculator,
  yieldPreview: frYieldPreview,
  yieldConsumption: frYieldConsumption,
  yieldRange: frYieldRange,
  yieldBatch: frYieldBatch,
  yieldPortion: frYieldPortion,
  supplierForm: frSupplierForm,
  supplierDetails: frSupplierDetails,
  supplierCatalog: frSupplierCatalog,
  supplierContacts: frSupplierContacts,
  supplierPricing: frSupplierPricing,
  supplierFilters: frSupplierFilters,
  supplierValidation: frSupplierValidation,
  supplierActions: frSupplierActions,
  supplierComparison: frSupplierComparison,
  purchaseOrders: frPurchaseOrders,
  purchaseOrderForm: frPurchaseOrderForm,
  purchaseOrderDetails: frPurchaseOrderDetails,
  purchaseOrderItems: frPurchaseOrderItems,
  purchaseOrderStatus: frPurchaseOrderStatus,
  purchaseOrderActions: frPurchaseOrderActions,
  purchaseOrderValidation: frPurchaseOrderValidation,
  purchaseOrderTotals: frPurchaseOrderTotals,
  purchaseOrderFilters: frPurchaseOrderFilters,
  purchaseOrderPrint: frPurchaseOrderPrint,
  purchaseOrderHistory: frPurchaseOrderHistory,
  receipts: frReceipts,
  receiptForm: frReceiptForm,
  receiptDetails: frReceiptDetails,
  receiptItems: frReceiptItems,
  receiptStatus: frReceiptStatus,
  receiptActions: frReceiptActions,
  receiptValidation: frReceiptValidation,
  receiptTotals: frReceiptTotals,
  receiptFilters: frReceiptFilters,
  receiptPrint: frReceiptPrint,
  receiptHistory: frReceiptHistory,
  stockReceipt: frStockReceipt,
  stocktakes: frStocktakes,
  stocktakeForm: frStocktakeForm,
  stocktakeCount: frStocktakeCount,
  stocktakeReview: frStocktakeReview,
  stocktakeDetails: frStocktakeDetails,
  stocktakeStatus: frStocktakeStatus,
  stocktakeActions: frStocktakeActions,
  stocktakeValidation: frStocktakeValidation,
  stocktakeVariance: frStocktakeVariance,
  stocktakeFilters: frStocktakeFilters,
  stocktakeHistory: frStocktakeHistory,
  stocktakePrint: frStocktakePrint,
  stockAdjustments: frStockAdjustments,
  stockAdjustmentForm: frStockAdjustmentForm,
  stockAdjustmentItems: frStockAdjustmentItems,
  stockAdjustmentDetails: frStockAdjustmentDetails,
  stockAdjustmentStatus: frStockAdjustmentStatus,
  stockAdjustmentActions: frStockAdjustmentActions,
  stockAdjustmentValidation: frStockAdjustmentValidation,
  stockAdjustmentTotals: frStockAdjustmentTotals,
  stockAdjustmentFilters: frStockAdjustmentFilters,
  stockAdjustmentHistory: frStockAdjustmentHistory,
  stockAdjustmentPrint: frStockAdjustmentPrint,
  stockAdjustmentTypes: frStockAdjustmentTypes,
};

const en: LocaleBundle = {
  common: enCommon,
  navigation: enNavigation,
  dashboard: enDashboard,
  pos: enPos,
  cart: enCart,
  products: enProducts,
  inventory: enInventory,
  recipes: enRecipes,
  recipeForm: enRecipeForm,
  recipeBuilder: enRecipeBuilder,
  recipeDetails: enRecipeDetails,
  recipeStatus: enRecipeStatus,
  recipeActions: enRecipeActions,
  recipeValidation: enRecipeValidation,
  recipeCost: enRecipeCost,
  recipeVersions: enRecipeVersions,
  recipeYield: enRecipeYield,
  purchasing: enPurchasing,
  orders: enOrders,
  customers: enCustomers,
  cashRegister: enCashRegister,
  suppliers: enSuppliers,
  tables: enTables,
  diningAreas: enDiningAreas,
  floorPlan: enFloorPlan,
  reports: enReports,
  kitchen: enKitchen,
  bar: enBar,
  menu: enMenu,
  settings: enSettings,
  auth: enAuth,
  validation: enValidation,
  notifications: enNotifications,
  styleGuide: enStyleGuide,
  uiTest: enUiTest,
  form: enForm,
  users: enUsers,
  roles: enRoles,
  permissions: enPermissions,
  authorization: enAuthorization,
  units: enUnits,
  unitConversions: enUnitConversions,
  categories: enCategories,
  yield: enYield,
  yieldForm: enYieldForm,
  yieldTypes: enYieldTypes,
  yieldValidation: enYieldValidation,
  yieldCalculator: enYieldCalculator,
  yieldPreview: enYieldPreview,
  yieldConsumption: enYieldConsumption,
  yieldRange: enYieldRange,
  yieldBatch: enYieldBatch,
  yieldPortion: enYieldPortion,
  supplierForm: enSupplierForm,
  supplierDetails: enSupplierDetails,
  supplierCatalog: enSupplierCatalog,
  supplierContacts: enSupplierContacts,
  supplierPricing: enSupplierPricing,
  supplierFilters: enSupplierFilters,
  supplierValidation: enSupplierValidation,
  supplierActions: enSupplierActions,
  supplierComparison: enSupplierComparison,
  purchaseOrders: enPurchaseOrders,
  purchaseOrderForm: enPurchaseOrderForm,
  purchaseOrderDetails: enPurchaseOrderDetails,
  purchaseOrderItems: enPurchaseOrderItems,
  purchaseOrderStatus: enPurchaseOrderStatus,
  purchaseOrderActions: enPurchaseOrderActions,
  purchaseOrderValidation: enPurchaseOrderValidation,
  purchaseOrderTotals: enPurchaseOrderTotals,
  purchaseOrderFilters: enPurchaseOrderFilters,
  purchaseOrderPrint: enPurchaseOrderPrint,
  purchaseOrderHistory: enPurchaseOrderHistory,
  receipts: enReceipts,
  receiptForm: enReceiptForm,
  receiptDetails: enReceiptDetails,
  receiptItems: enReceiptItems,
  receiptStatus: enReceiptStatus,
  receiptActions: enReceiptActions,
  receiptValidation: enReceiptValidation,
  receiptTotals: enReceiptTotals,
  receiptFilters: enReceiptFilters,
  receiptPrint: enReceiptPrint,
  receiptHistory: enReceiptHistory,
  stockReceipt: enStockReceipt,
  stocktakes: enStocktakes,
  stocktakeForm: enStocktakeForm,
  stocktakeCount: enStocktakeCount,
  stocktakeReview: enStocktakeReview,
  stocktakeDetails: enStocktakeDetails,
  stocktakeStatus: enStocktakeStatus,
  stocktakeActions: enStocktakeActions,
  stocktakeValidation: enStocktakeValidation,
  stocktakeVariance: enStocktakeVariance,
  stocktakeFilters: enStocktakeFilters,
  stocktakeHistory: enStocktakeHistory,
  stocktakePrint: enStocktakePrint,
  stockAdjustments: enStockAdjustments,
  stockAdjustmentForm: enStockAdjustmentForm,
  stockAdjustmentItems: enStockAdjustmentItems,
  stockAdjustmentDetails: enStockAdjustmentDetails,
  stockAdjustmentStatus: enStockAdjustmentStatus,
  stockAdjustmentActions: enStockAdjustmentActions,
  stockAdjustmentValidation: enStockAdjustmentValidation,
  stockAdjustmentTotals: enStockAdjustmentTotals,
  stockAdjustmentFilters: enStockAdjustmentFilters,
  stockAdjustmentHistory: enStockAdjustmentHistory,
  stockAdjustmentPrint: enStockAdjustmentPrint,
  stockAdjustmentTypes: enStockAdjustmentTypes,
};

const ar: LocaleBundle = {
  common: arCommon,
  navigation: arNavigation,
  dashboard: arDashboard,
  pos: arPos,
  cart: arCart,
  products: arProducts,
  inventory: arInventory,
  recipes: arRecipes,
  recipeForm: arRecipeForm,
  recipeBuilder: arRecipeBuilder,
  recipeDetails: arRecipeDetails,
  recipeStatus: arRecipeStatus,
  recipeActions: arRecipeActions,
  recipeValidation: arRecipeValidation,
  recipeCost: arRecipeCost,
  recipeVersions: arRecipeVersions,
  recipeYield: arRecipeYield,
  purchasing: arPurchasing,
  orders: arOrders,
  customers: arCustomers,
  cashRegister: arCashRegister,
  suppliers: arSuppliers,
  tables: arTables,
  diningAreas: arDiningAreas,
  floorPlan: arFloorPlan,
  reports: arReports,
  kitchen: arKitchen,
  bar: arBar,
  menu: arMenu,
  settings: arSettings,
  auth: arAuth,
  validation: arValidation,
  notifications: arNotifications,
  styleGuide: arStyleGuide,
  uiTest: arUiTest,
  form: arForm,
  users: arUsers,
  roles: arRoles,
  permissions: arPermissions,
  authorization: arAuthorization,
  units: arUnits,
  unitConversions: arUnitConversions,
  categories: arCategories,
  yield: arYield,
  yieldForm: arYieldForm,
  yieldTypes: arYieldTypes,
  yieldValidation: arYieldValidation,
  yieldCalculator: arYieldCalculator,
  yieldPreview: arYieldPreview,
  yieldConsumption: arYieldConsumption,
  yieldRange: arYieldRange,
  yieldBatch: arYieldBatch,
  yieldPortion: arYieldPortion,
  supplierForm: arSupplierForm,
  supplierDetails: arSupplierDetails,
  supplierCatalog: arSupplierCatalog,
  supplierContacts: arSupplierContacts,
  supplierPricing: arSupplierPricing,
  supplierFilters: arSupplierFilters,
  supplierValidation: arSupplierValidation,
  supplierActions: arSupplierActions,
  supplierComparison: arSupplierComparison,
  purchaseOrders: arPurchaseOrders,
  purchaseOrderForm: arPurchaseOrderForm,
  purchaseOrderDetails: arPurchaseOrderDetails,
  purchaseOrderItems: arPurchaseOrderItems,
  purchaseOrderStatus: arPurchaseOrderStatus,
  purchaseOrderActions: arPurchaseOrderActions,
  purchaseOrderValidation: arPurchaseOrderValidation,
  purchaseOrderTotals: arPurchaseOrderTotals,
  purchaseOrderFilters: arPurchaseOrderFilters,
  purchaseOrderPrint: arPurchaseOrderPrint,
  purchaseOrderHistory: arPurchaseOrderHistory,
  receipts: arReceipts,
  receiptForm: arReceiptForm,
  receiptDetails: arReceiptDetails,
  receiptItems: arReceiptItems,
  receiptStatus: arReceiptStatus,
  receiptActions: arReceiptActions,
  receiptValidation: arReceiptValidation,
  receiptTotals: arReceiptTotals,
  receiptFilters: arReceiptFilters,
  receiptPrint: arReceiptPrint,
  receiptHistory: arReceiptHistory,
  stockReceipt: arStockReceipt,
  stocktakes: arStocktakes,
  stocktakeForm: arStocktakeForm,
  stocktakeCount: arStocktakeCount,
  stocktakeReview: arStocktakeReview,
  stocktakeDetails: arStocktakeDetails,
  stocktakeStatus: arStocktakeStatus,
  stocktakeActions: arStocktakeActions,
  stocktakeValidation: arStocktakeValidation,
  stocktakeVariance: arStocktakeVariance,
  stocktakeFilters: arStocktakeFilters,
  stocktakeHistory: arStocktakeHistory,
  stocktakePrint: arStocktakePrint,
  stockAdjustments: arStockAdjustments,
  stockAdjustmentForm: arStockAdjustmentForm,
  stockAdjustmentItems: arStockAdjustmentItems,
  stockAdjustmentDetails: arStockAdjustmentDetails,
  stockAdjustmentStatus: arStockAdjustmentStatus,
  stockAdjustmentActions: arStockAdjustmentActions,
  stockAdjustmentValidation: arStockAdjustmentValidation,
  stockAdjustmentTotals: arStockAdjustmentTotals,
  stockAdjustmentFilters: arStockAdjustmentFilters,
  stockAdjustmentHistory: arStockAdjustmentHistory,
  stockAdjustmentPrint: arStockAdjustmentPrint,
  stockAdjustmentTypes: arStockAdjustmentTypes,
};

export type MessagesBundle = typeof fr;

const bundles: Record<Locale, MessagesBundle> = { fr, en, ar };

/** All locale messages bundled for instant client-side switching (no reload). */
export function getClientMessages(locale: Locale): MessagesBundle {
  return bundles[locale];
}
