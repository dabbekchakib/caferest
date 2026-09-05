"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee } from "lucide-react";
import { useTranslations } from "next-intl";
import { navSections } from "@/lib/navigation";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthorization } from "@/hooks/use-authorization";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const t = useTranslations("navigation");
  const { can } = useAuthorization();

  return (
    <aside
      className="hidden h-full w-[var(--sidebar-width)] flex-col border-e border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] transition-[width] duration-300 lg:flex"
      style={{
        width: collapsed ? "var(--sidebar-width-collapsed)" : undefined,
      }}
      aria-label={t("label")}
    >
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center gap-2 px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-sidebar-primary)] text-[var(--color-sidebar-primary-foreground)]">
              <Coffee className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold text-[var(--color-sidebar-foreground)]">
              Cafe
              <span className="text-[var(--color-sidebar-primary)]">Rest</span>
            </span>
          </div>
        ) : (
          <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-[var(--color-sidebar-primary)] text-[var(--color-sidebar-primary-foreground)]">
            <Coffee className="size-5" aria-hidden />
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const items = section.items.filter(
            (item) => !item.permission || can(item.permission)
          );
          if (items.length === 0) return null;
          return (
            <div key={section.labelKey}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sidebar-muted)]">
                  {t(section.labelKey)}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                const content = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-primary)]"
                        : "text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-accent)] hover:text-[var(--color-sidebar-foreground)]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-5 shrink-0 transition-colors",
                        active && "text-[var(--color-sidebar-primary)]"
                      )}
                      aria-hidden
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate text-start">
                        {t(item.labelKey)}
                      </span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="rounded-full bg-[var(--color-sidebar-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-sidebar-primary-foreground)]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
                return (
                  <li
                    key={item.href}
                    className={cn(collapsed && "flex justify-center")}
                  >
                    {collapsed ? (
                      <Tooltip content={t(item.labelKey)} side="right">
                        {content}
                      </Tooltip>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-sidebar-border)] p-3">
        {!collapsed ? (
          <div className="rounded-lg bg-[var(--color-sidebar-accent)] p-3">
            <p className="text-xs font-medium text-[var(--color-sidebar-foreground)]">
              {t("demo")}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-sidebar-muted)]">
              {t("demoPhase")}
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <Tooltip content={t("demo")} side="right">
              <span className="size-2 rounded-full bg-[var(--color-success)]" />
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
}
