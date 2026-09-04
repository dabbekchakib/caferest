import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Boxes,
  Building2,
  Coins,
  Languages,
  Palette,
  Percent,
  Printer,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSectionKey =
  | "general"
  | "branding"
  | "localization"
  | "currency"
  | "taxes"
  | "pos"
  | "inventory"
  | "printing"
  | "notifications";

export interface SettingsSectionMeta {
  key: SettingsSectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { key: "general", label: "Général", description: "Identité de l'établissement", icon: Building2 },
  { key: "branding", label: "Branding", description: "Logo, favicon & couleurs", icon: Palette },
  { key: "localization", label: "Langue & région", description: "Langues, RTL, fuseau, formats", icon: Languages },
  { key: "currency", label: "Devise", description: "Devise et formats numériques", icon: Coins },
  { key: "taxes", label: "Taxes", description: "Taux et taxe par défaut", icon: Percent },
  { key: "pos", label: "POS", description: "Comportement du point de vente", icon: ShoppingCart },
  { key: "inventory", label: "Stock", description: "Règles et seuils de stock", icon: Boxes },
  { key: "printing", label: "Impression", description: "Tickets de caisse", icon: Printer },
  { key: "notifications", label: "Notifications", description: "Alertes et notifications", icon: Bell },
];

interface SettingsNavProps {
  active: SettingsSectionKey;
  onSelect: (key: SettingsSectionKey) => void;
}

export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  return (
    <nav
      aria-label="Sections de configuration"
      className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = section.key === active;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            aria-current={isActive ? "page" : undefined}
            title={section.label}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              isActive
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
