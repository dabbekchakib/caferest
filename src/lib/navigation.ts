import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  CookingPot,
  Martini,
  LayoutGrid,
  ListOrdered,
  ReceiptText,
  Wallet,
  Banknote,
  Package,
  FolderTree,
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
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Général",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "POS",
    items: [
      { title: "Nouvelle commande", href: "/pos", icon: ShoppingCart },
      { title: "Commandes", href: "/orders", icon: ClipboardList, badge: "4" },
      { title: "Tables", href: "/tables", icon: LayoutGrid },
      { title: "Cuisine", href: "/kitchen", icon: CookingPot },
      { title: "Bar", href: "/bar", icon: Martini },
    ],
  },
  {
    title: "Ventes",
    items: [
      { title: "Ventes", href: "/sales", icon: ReceiptText },
      { title: "Tickets", href: "/tickets", icon: ListOrdered },
      { title: "Paiements", href: "/payments", icon: Wallet },
      { title: "Caisse", href: "/register", icon: Banknote },
    ],
  },
  {
    title: "Produits",
    items: [
      { title: "Produits", href: "/products", icon: Package },
      { title: "Catégories", href: "/categories", icon: FolderTree },
      { title: "Recettes", href: "/recipes", icon: BookOpenText },
      { title: "Rendements", href: "/yields", icon: Factory },
    ],
  },
  {
    title: "Approvisionnement",
    items: [
      { title: "Fournisseurs", href: "/suppliers", icon: Truck },
      { title: "Demandes d'achat", href: "/purchase-requests", icon: ClipboardPlus },
      { title: "Commandes", href: "/purchase-orders", icon: ClipboardList },
      { title: "Réceptions", href: "/receiving", icon: PackageCheck },
    ],
  },
  {
    title: "Stock",
    items: [
      { title: "Stock", href: "/inventory", icon: Boxes },
      { title: "Mouvements", href: "/stock-movements", icon: ArrowLeftRight },
      { title: "Inventaires", href: "/stock-counts", icon: ClipboardMinus },
      { title: "Pertes", href: "/losses", icon: ClipboardMinus },
    ],
  },
  {
    title: "Clients",
    items: [
      { title: "Clients", href: "/customers", icon: Users },
      { title: "Fidélité", href: "/loyalty", icon: Sparkles },
    ],
  },
  {
    title: "Rapports",
    items: [
      { title: "Rapports", href: "/reports", icon: BarChart3 },
      { title: "Analyses", href: "/analytics", icon: LineChart },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Utilisateurs", href: "/users", icon: UserCog },
      { title: "Permissions", href: "/permissions", icon: ShieldCheck },
      { title: "Journal", href: "/logs", icon: History },
    ],
  },
  {
    title: "Système",
    items: [
      { title: "Configuration", href: "/settings", icon: Settings },
      { title: "Style Guide", href: "/style-guide", icon: BookMarked },
    ],
  },
];

export interface BottomNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const bottomNavItems: BottomNavItem[] = [
  { title: "Accueil", href: "/dashboard", icon: LayoutDashboard },
  { title: "POS", href: "/pos", icon: ShoppingCart },
  { title: "Commandes", href: "/orders", icon: ClipboardList },
  { title: "Stock", href: "/inventory", icon: Boxes },
  { title: "Plus", href: "/menu", icon: LayoutGrid },
];
