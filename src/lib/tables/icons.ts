import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Building2,
  Crown,
  DoorOpen,
  LayoutDashboard,
  Martini,
  TreePalm,
  UtensilsCrossed,
} from "lucide-react";

export const DINING_AREA_ICONS = [
  "salon",
  "salle",
  "terrasse",
  "bar",
  "vip",
  "etage",
  "exterieur",
] as const;

export type DiningAreaIconKey = (typeof DINING_AREA_ICONS)[number];

const ICON_MAP: Record<DiningAreaIconKey, LucideIcon> = {
  salon: Armchair,
  salle: DoorOpen,
  terrasse: TreePalm,
  bar: Martini,
  vip: Crown,
  etage: Building2,
  exterieur: UtensilsCrossed,
};

export function diningAreaIcon(icon: string | null | undefined): LucideIcon {
  const key = icon as DiningAreaIconKey | null | undefined;
  if (key && key in ICON_MAP) return ICON_MAP[key];
  return LayoutDashboard;
}

export function isDiningAreaIconKey(value: string | null | undefined): boolean {
  return value != null && (DINING_AREA_ICONS as readonly string[]).includes(value);
}