"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { bottomNavItems } from "@/lib/navigation";
import { useAuthorization } from "@/hooks/use-authorization";
import { cn } from "@/lib/utils";

export function BottomNavigation() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const { can } = useAuthorization();
  const items = bottomNavItems.filter(
    (item) => !item.permission || can(item.permission)
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-[var(--color-border)] bg-[var(--color-header)] lg:hidden"
      aria-label={t("mobileLabel")}
    >
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              active
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            )}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="size-5" aria-hidden />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
