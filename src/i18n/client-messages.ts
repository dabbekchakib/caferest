import type { Locale } from "@/i18n/routing";
import type { MessageRecord } from "./messages";

import frCommon from "@/locales/fr/common.json";
import frNavigation from "@/locales/fr/navigation.json";
import frDashboard from "@/locales/fr/dashboard.json";
import frPos from "@/locales/fr/pos.json";
import frProducts from "@/locales/fr/products.json";
import frInventory from "@/locales/fr/inventory.json";
import frRecipes from "@/locales/fr/recipes.json";
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

import enCommon from "@/locales/en/common.json";
import enNavigation from "@/locales/en/navigation.json";
import enDashboard from "@/locales/en/dashboard.json";
import enPos from "@/locales/en/pos.json";
import enProducts from "@/locales/en/products.json";
import enInventory from "@/locales/en/inventory.json";
import enRecipes from "@/locales/en/recipes.json";
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

import arCommon from "@/locales/ar/common.json";
import arNavigation from "@/locales/ar/navigation.json";
import arDashboard from "@/locales/ar/dashboard.json";
import arPos from "@/locales/ar/pos.json";
import arProducts from "@/locales/ar/products.json";
import arInventory from "@/locales/ar/inventory.json";
import arRecipes from "@/locales/ar/recipes.json";
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

interface LocaleBundle {
  common: MessageRecord;
  navigation: MessageRecord;
  dashboard: MessageRecord;
  pos: MessageRecord;
  products: MessageRecord;
  inventory: MessageRecord;
  recipes: MessageRecord;
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
}

const fr: LocaleBundle = {
  common: frCommon,
  navigation: frNavigation,
  dashboard: frDashboard,
  pos: frPos,
  products: frProducts,
  inventory: frInventory,
  recipes: frRecipes,
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
};

const en: LocaleBundle = {
  common: enCommon,
  navigation: enNavigation,
  dashboard: enDashboard,
  pos: enPos,
  products: enProducts,
  inventory: enInventory,
  recipes: enRecipes,
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
};

const ar: LocaleBundle = {
  common: arCommon,
  navigation: arNavigation,
  dashboard: arDashboard,
  pos: arPos,
  products: arProducts,
  inventory: arInventory,
  recipes: arRecipes,
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
};

export type MessagesBundle = typeof fr;

const bundles: Record<Locale, MessagesBundle> = { fr, en, ar };

/** All locale messages bundled for instant client-side switching (no reload). */
export function getClientMessages(locale: Locale): MessagesBundle {
  return bundles[locale];
}
