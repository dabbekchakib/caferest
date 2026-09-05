"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useThemeStore } from "@/stores/use-theme-store";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const t = useTranslations("common");

  const resolved = useThemeStore((state) => state.resolvedTheme);

  const options = [
    { value: "light" as const, label: t("theme.light"), Icon: Sun },
    { value: "dark" as const, label: t("theme.dark"), Icon: Moon },
    { value: "system" as const, label: t("theme.system"), Icon: Monitor },
  ];

  const effective = theme === "system" ? resolved : theme;

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5",
        className
      )}
      role="group"
      aria-label={t("theme.ariaLabel")}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md transition-colors",
            effective === value
              ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
