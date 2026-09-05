"use client";

import { Check, Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/hooks/use-locale";
import { localeMeta, type Locale } from "@/i18n/routing";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from "@/components/ui/dropdown";

export interface LanguageSwitcherProps {
  className?: string;
}

/**
 * Global language selector.
 *
 * Desktop: icon + short code (FR / EN / AR).
 * Mobile: the dropdown still works and shows full language names.
 * Disabled locales (from the establishment config) are not rendered.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, availableLocales, setLocale } = useLocale();
  const t = useTranslations("common");

  return (
    <Dropdown className={className}>
      <DropdownTrigger
        aria-label={t("common.language")}
        title={t("common.language")}
        className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <span className="inline-flex items-center gap-1.5">
          <Languages className="size-5" aria-hidden />
          <span className="hidden text-xs font-semibold sm:inline">
            {localeMeta[locale].short}
          </span>
        </span>
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-40">
        {availableLocales.map((l: Locale) => (
          <DropdownItem
            key={l}
            onClick={() => setLocale(l)}
            className="justify-between"
          >
            <span>{localeMeta[l].native}</span>
            {l === locale && (
              <Check
                className="size-4 text-[var(--color-primary)]"
                aria-hidden
              />
            )}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
