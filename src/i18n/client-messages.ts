import type { Locale } from "@/i18n/routing";
import type { MessageRecord } from "./messages";

import frCommon from "@/locales/fr/common.json";
import frNavigation from "@/locales/fr/navigation.json";
import frDashboard from "@/locales/fr/dashboard.json";
import frPos from "@/locales/fr/pos.json";
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

import enCommon from "@/locales/en/common.json";
import enNavigation from "@/locales/en/navigation.json";
import enDashboard from "@/locales/en/dashboard.json";
import enPos from "@/locales/en/pos.json";
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

import arCommon from "@/locales/ar/common.json";
import arNavigation from "@/locales/ar/navigation.json";
import arDashboard from "@/locales/ar/dashboard.json";
import arPos from "@/locales/ar/pos.json";
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

interface LocaleBundle {
  common: MessageRecord;
  navigation: MessageRecord;
  dashboard: MessageRecord;
  pos: MessageRecord;
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
}

const fr: LocaleBundle = {
  common: frCommon,
  navigation: frNavigation,
  dashboard: frDashboard,
  pos: frPos,
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
};

const en: LocaleBundle = {
  common: enCommon,
  navigation: enNavigation,
  dashboard: enDashboard,
  pos: enPos,
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
};

const ar: LocaleBundle = {
  common: arCommon,
  navigation: arNavigation,
  dashboard: arDashboard,
  pos: arPos,
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
};

export type MessagesBundle = typeof fr;

const bundles: Record<Locale, MessagesBundle> = { fr, en, ar };

/** All locale messages bundled for instant client-side switching (no reload). */
export function getClientMessages(locale: Locale): MessagesBundle {
  return bundles[locale];
}
