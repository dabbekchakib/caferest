import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  MapPin,
  Armchair,
  LayoutGrid,
  Package,
  FolderTree,
  Wheat,
  BookOpenText,
  Truck,
  ClipboardList as ClipboardListAlt,
  PackageCheck,
  ClipboardMinus,
  Ruler,
  ArrowLeftRight,
  UserCog,
  ShieldCheck,
  Settings,
  BookMarked,
  ClipboardCheck,
} from "lucide-react";

/**
 * Registre central de navigation (Phase 20).
 *
 * Source unique de vérité pour le menu, le drawer mobile, la bottom-nav, les
 * breadcrumbs et la matrice du /system-test. Trois règles strictes :
 *   - chaque `href` pointe vers une route RÉELLE et fonctionnelle ;
 *   - aucun lien mort, aucune route inventée, aucun placeholder fonctionnel ;
 *   - chaque item porte sa permission (masqué si non accordée).
 */

export interface NavItem {
  /** Clé i18n (namespace navigation) pour l'étiquette. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Permission slug contrôlant la visibilité. */
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
      {
        labelKey: "newOrder",
        href: "/pos",
        icon: ShoppingCart,
        permission: "pos.access",
      },
      {
        labelKey: "orders",
        href: "/orders",
        icon: ClipboardList,
        permission: "orders.view",
      },
    ],
  },
  {
    labelKey: "dining",
    items: [
      {
        labelKey: "floorPlan",
        href: "/floor-plan",
        icon: LayoutGrid,
        permission: "tables.floor_plan",
      },
      {
        labelKey: "tables",
        href: "/tables",
        icon: Armchair,
        permission: "tables.view",
      },
      {
        labelKey: "diningAreas",
        href: "/dining-areas",
        icon: MapPin,
        permission: "dining_areas.view",
      },
    ],
  },
  {
    labelKey: "catalog",
    items: [
      {
        labelKey: "products",
        href: "/products",
        icon: Package,
        permission: "products.view",
      },
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
      {
        labelKey: "recipes",
        href: "/recipes",
        icon: BookOpenText,
        permission: "recipes.view",
      },
    ],
  },
  {
    labelKey: "supply",
    items: [
      {
        labelKey: "suppliers",
        href: "/suppliers",
        icon: Truck,
        permission: "suppliers.view",
      },
      {
        labelKey: "purchaseOrders",
        href: "/purchase-orders",
        icon: ClipboardListAlt,
        permission: "purchases.view",
      },
      {
        labelKey: "receiving",
        href: "/receipts",
        icon: PackageCheck,
        permission: "goods_receipts.view",
      },
    ],
  },
  {
    labelKey: "stock",
    items: [
      {
        labelKey: "stockCounts",
        href: "/stocktakes",
        icon: ClipboardCheck,
        permission: "stocktakes.view",
      },
      {
        labelKey: "losses",
        href: "/stock-adjustments",
        icon: ClipboardMinus,
        permission: "stock_adjustments.view",
      },
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
    labelKey: "administration",
    items: [
      {
        labelKey: "users",
        href: "/users",
        icon: UserCog,
        permission: "users.view",
      },
      {
        labelKey: "roles",
        href: "/roles",
        icon: ShieldCheck,
        permission: "roles.view",
      },
    ],
  },
  {
    labelKey: "system",
    items: [
      { labelKey: "settings", href: "/settings", icon: Settings },
      { labelKey: "styleGuide", href: "/style-guide", icon: BookMarked },
      { labelKey: "uiTest", href: "/ui-test", icon: ClipboardCheck },
      {
        labelKey: "systemTest",
        href: "/system-test",
        icon: ShieldCheck,
        permission: "settings.view",
      },
    ],
  },
];

/** Toutes les entrées à plat (pour le drawer mobile / bottom-nav / tests). */
export function flattenNavItems(): NavItem[] {
  return navSections.flatMap((section) => section.items);
}

/** Tous les chemins réels référencés par le registre (aucun doublon). */
export function registeredRoutes(): string[] {
  return Array.from(new Set(flattenNavItems().map((item) => item.href)));
}

export interface BreadcrumbStep {
  href: string;
  labelKey: string;
}

/**
 * Résout le fil d'Ariane d'un pathname depuis le registre central : accueil,
 * puis l'entrée de menu dont le href est le PLUS LONG préfixe du pathname, puis
 * (éventuellement) un jalon « detail » pour les segments dynamiques
 * (/orders/123, /products/456/edit, …).
 */
export function resolveBreadcrumbTrail(pathname: string): BreadcrumbStep[] {
  const home: BreadcrumbStep = { href: "/dashboard", labelKey: "home" };
  if (pathname === "/dashboard" || pathname === "/") return [home];

  let best: BreadcrumbStep | null = null;
  for (const item of flattenNavItems()) {
    if (pathname === item.href) {
      best = { href: item.href, labelKey: item.labelKey };
      break;
    }
    if (
      pathname.startsWith(item.href + "/") &&
      (!best || item.href.length > best.href.length)
    ) {
      best = { href: item.href, labelKey: item.labelKey };
    }
  }
  if (!best) return [home];

  const trail: BreadcrumbStep[] = [home, best];
  const rest = pathname.slice(best.href.length).split("/").filter(Boolean);
  if (rest.length > 0) {
    trail.push({ href: "", labelKey: "detail" });
  }
  return trail;
}

/** Clé i18n du titre de topbar pour un pathname (dérivé du registre). */
export function resolveNavLabelKey(pathname: string): string | null {
  const trail = resolveBreadcrumbTrail(pathname);
  if (trail.length <= 1) return null;
  const moduleStep = trail[1];
  return moduleStep.labelKey === "home" ? null : moduleStep.labelKey;
}

export interface BottomNavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

export const bottomNavItems: BottomNavItem[] = [
  { labelKey: "home", href: "/dashboard", icon: LayoutDashboard },
  {
    labelKey: "pos",
    href: "/pos",
    icon: ShoppingCart,
    permission: "pos.access",
  },
  {
    labelKey: "orders",
    href: "/orders",
    icon: ClipboardList,
    permission: "orders.view",
  },
  {
    labelKey: "settings",
    href: "/settings",
    icon: Settings,
  },
];