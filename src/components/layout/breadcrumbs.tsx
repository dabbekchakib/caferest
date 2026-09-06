"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Home } from "lucide-react";
import { resolveBreadcrumbTrail } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Fil d'Ariane dérivé du registre central (lib/navigation). */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const tc = useTranslations("common");
  const trail = resolveBreadcrumbTrail(pathname);

  return (
    <nav
      aria-label={tc("breadcrumb.ariaLabel")}
      className={cn(
        "flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]",
        className
      )}
    >
      {trail.map((step, index) => {
        const isLast = index === trail.length - 1;
        return (
          <span key={step.href || step.labelKey} className="inline-flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="size-3 rtl:rotate-180" aria-hidden />
            )}
            {step.href ? (
              <Link
                href={step.href}
                className="inline-flex items-center gap-1 hover:text-[var(--color-foreground)]"
              >
                {index === 0 && <Home className="size-3" aria-hidden />}
                <span>{t(step.labelKey)}</span>
              </Link>
            ) : (
              <span
                className={cn(
                  isLast
                    ? "font-medium text-[var(--color-foreground)]"
                    : undefined
                )}
              >
                {t(step.labelKey)}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}