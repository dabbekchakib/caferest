import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  CookingPot,
  Martini,
  MapPin,
  Armchair,
  LayoutGrid,
  ListOrdered,
  ReceiptText,
  Wallet,
  Banknote,
  Package,
  FolderTree,
  Wheat,
  BookOpenText,
  Factory,
  Truck,
  ClipboardPlus,
  PackageCheck,
  Boxes,
  ArrowLeftRight,
  ClipboardMinus,
  Users,
  Sparkles,
  BarChart3,
  LineChart,
  UserCog,
  ShieldCheck,
  History,
  Settings,
  BookMarked,
  Ruler,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
  /** Permission slug controlling item visibility (filters sidebar/menus). */
  permission?: string;
}

export interface NavSection {
  labelKey: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    labelKey: "general",
    items: [
      { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "pos",
    items: [
      { labelKey: "newOrder", href: "/pos", icon: ShoppingCart },
      { labelKey: "orders", href: "/orders", icon: ClipboardList, badge: "4" },
      { labelKey: "kitchen", href: "/kitchen", icon: CookingPot },
      { labelKey: "bar", href: "/bar", icon: Martini },
    ],
  },
  {
    labelKey: "dining",
    items: [
      {
        labelKey: "diningAreas",
        href: "/dining-areas",
        icon: MapPin,
        permission: "dining_areas.view",
      },
      {
        labelKey: "tables",
        href: "/tables",
        icon: Armchair,
        permission: "tables.view",
      },
      {
        labelKey: "floorPlan",
        href: "/floor-plan",
        icon: LayoutGrid,
        permission: "tables.floor_plan",
      },
    ],
  },
  {
    labelKey: "sales",
    items: [
      { labelKey: "salesReports", href: "/sales", icon: ReceiptText },
      { labelKey: "tickets", href: "/tickets", icon: ListOrdered },
      { labelKey: "payments", href: "/payments", icon: Wallet },
      { labelKey: "cashRegister", href: "/register", icon: Banknote },
    ],
  },
  {
    labelKey: "products",
    items: [
      { labelKey: "products", href: "/products", icon: Package, permission: "products.view" },
      {
        labelKey: "categories",
        href: "/categories",
        icon: FolderTree,
        permission: "categories.view",
      },
      {
        labelKey: "ingredients",
        href: "/ingredients",
        icon: Wheat,
        permission: "ingredients.view",
      },
      { labelKey: "recipes", href: "/recipes", icon: BookOpenText, permission: "recipes.view" },
      { labelKey: "yields", href: "/yields", icon: Factory },
    ],
  },
  {
    labelKey: "supply",
    items: [
      { labelKey: "suppliers", href: "/suppliers", icon: Truck, permission: "suppliers.view" },
      {
        labelKey: "purchaseRequests",
        href: "/purchase-requests",
        icon: ClipboardPlus,
      },
      {
        labelKey: "purchaseOrders",
        href: "/purchase-orders",
        icon: ClipboardList,
        permission: "purchases.view",
      },
      { labelKey: "receiving", href: "/receipts", icon: PackageCheck, permission: "goods_receipts.view" },
    ],
  },
  {
    labelKey: "stock",
    items: [
      { labelKey: "inventory", href: "/inventory", icon: Boxes },
      {
        labelKey: "stockMovements",
        href: "/stock-movements",
        icon: ArrowLeftRight,
      },
      { labelKey: "stockCounts", href: "/stocktakes", icon: ClipboardMinus, permission: "stocktakes.view" },
      { labelKey: "losses", href: "/stock-adjustments", icon: ClipboardMinus, permission: "stock_adjustments.view" },
      {
        labelKey: "units",
        href: "/units",
        icon: Ruler,
        permission: "units.view",
      },
      {
        labelKey: "unitConversions",
        href: "/unit-conversions",
        icon: ArrowLeftRight,
        permission: "unit_conversions.view",
      },
    ],
  },
  {
    labelKey: "customers",
    items: [
      { labelKey: "customers", href: "/customers", icon: Users },
      { labelKey: "loyalty", href: "/loyalty", icon: Sparkles },
    ],
  },
  {
    labelKey: "reports",
    items: [
      { labelKey: "reports", href: "/reports", icon: BarChart3 },
      { labelKey: "analytics", href: "/analytics", icon: LineChart },
    ],
  },
  {
    labelKey: "administration",
    items: [
      { labelKey: "users", href: "/users", icon: UserCog, permission: "users.view" },
      { labelKey: "roles", href: "/roles", icon: ShieldCheck, permission: "roles.view" },
      { labelKey: "journal", href: "/logs", icon: History, permission: "audit_logs.view" },
    ],
  },
  {
    labelKey: "system",
    items: [
      { labelKey: "settings", href: "/settings", icon: Settings },
      { labelKey: "styleGuide", href: "/style-guide", icon: BookMarked },
    ],
  },
];

export interface BottomNavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

export const bottomNavItems: BottomNavItem[] = [
  { labelKey: "home", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "pos", href: "/pos", icon: ShoppingCart },
  { labelKey: "orders", href: "/orders", icon: ClipboardList },
  { labelKey: "inventory", href: "/inventory", icon: Boxes },
  { labelKey: "more", href: "/menu", icon: LayoutGrid },
];
