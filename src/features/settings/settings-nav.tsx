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
import { useTranslations } from "next-intl";
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

export const SETTINGS_SECTIONS: {
  key: SettingsSectionKey;
  icon: LucideIcon;
}[] = [
  { key: "general", icon: Building2 },
  { key: "branding", icon: Palette },
  { key: "localization", icon: Languages },
  { key: "currency", icon: Coins },
  { key: "taxes", icon: Percent },
  { key: "pos", icon: ShoppingCart },
  { key: "inventory", icon: Boxes },
  { key: "printing", icon: Printer },
  { key: "notifications", icon: Bell },
];

interface SettingsNavProps {
  active: SettingsSectionKey;
  onSelect: (key: SettingsSectionKey) => void;
}

export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  const t = useTranslations("settings");
  return (
    <nav
      aria-label={t("navAria")}
      className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = section.key === active;
        const label = t(`nav.${section.key}`);
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            aria-current={isActive ? "page" : undefined}
            title={label}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              isActive
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
