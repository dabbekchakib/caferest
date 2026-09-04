"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Coffee, X } from "lucide-react";
import { navSections } from "@/lib/navigation";
import { useAppStore } from "@/stores/use-app-store";
import { useLockBody } from "@/hooks/use-lock-body";
import { cn } from "@/lib/utils";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function MobileDrawer() {
  const open = useAppStore((state) => state.mobileNavOpen);
  const setOpen = useAppStore((state) => state.setMobileNavOpen);
  const pathname = usePathname();
  useLockBody(open);
  const mounted = useMounted();

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] lg:hidden">
      <div
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        className={cn(
          "absolute inset-y-0 start-0 flex w-72 max-w-[85%] flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)] shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
      >
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-sidebar-primary)] text-white">
              <Coffee className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold">
              Cafe<span className="text-[var(--color-sidebar-primary)]">Rest</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-accent)] hover:text-[var(--color-sidebar-foreground)]"
            aria-label="Fermer le menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-sidebar-muted)]">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-primary)]"
                            : "text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-accent)] hover:text-[var(--color-sidebar-foreground)]"
                        )}
                      >
                        <item.icon className="size-5 shrink-0" aria-hidden />
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <span className="rounded-full bg-[var(--color-sidebar-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>,
    document.body
  );
}
