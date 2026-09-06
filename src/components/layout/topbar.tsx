"use client";

import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Menu,
  PanelLeft,
  Settings,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/stores/use-app-store";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar } from "@/components/ui/avatar";
import { ConnectionStatus } from "@/components/shared/connection-status";
import { NotificationItem } from "@/components/shared/notification-item";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EstablishmentSwitcher } from "@/components/rbac/establishment-switcher";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useToast } from "@/stores/use-toast-store";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/auth/auth-service";
import { createClient } from "@/lib/supabase/client";
import type { AuthClientLike } from "@/lib/auth/auth-types";
import { APP_NAME } from "@/lib/constants";
import { resolveNavLabelKey } from "@/lib/navigation";

function getInitials(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "U";
  const parts = cleaned.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Topbar({ title }: { title?: string }) {
  const toggleMobileNav = useAppStore((state) => state.toggleMobileNav);
  const toggleSidebarCollapsed = useAppStore(
    (state) => state.toggleSidebarCollapsed
  );
  const toast = useToast();
  const t = useTranslations();
  const tc = useTranslations("common");
  const tn = useTranslations("navigation");
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useAuth();

  const segment = pathname.split("/")[1] ?? "";
  const navKey = segment ? resolveNavLabelKey(pathname) ?? undefined : undefined;
  const resolvedTitle = navKey ? tn(navKey) : (title ?? APP_NAME);

  const displayName = profile?.full_name?.trim() || user?.email || "CafeRest";
  const displayEmail = user?.email ?? "";
  const initials = getInitials(displayName);

  const notifications = [
    {
      id: "1",
      title: t("notifications.newOrder", { number: "1042" }),
      description: t("notifications.tableItems", { table: "04", count: 3 }),
      time: t("notifications.timeAgoMin", { min: "2" }),
      unread: true,
    },
    {
      id: "2",
      title: t("notifications.lowStockEspresso"),
      description: t("notifications.unitRemaining", { count: 8 }),
      time: t("notifications.timeAgoMin", { min: "15" }),
      unread: true,
    },
    {
      id: "3",
      title: t("notifications.cashRegisterClosed"),
      description: t("notifications.sessionValidated"),
      time: t("notifications.timeAgoHour"),
      unread: false,
    },
  ];

  async function handleSignOut() {
    try {
      await signOut(createClient() as unknown as AuthClientLike);
    } catch {
      /* session may already be gone — proceed to login anyway */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-[var(--color-header-border)] bg-[var(--color-header)] px-4 text-[var(--color-header-foreground)]">
      <button
        type="button"
        onClick={toggleMobileNav}
        className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] lg:hidden"
        aria-label={tc("common.openMenu")}
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className="hidden size-10 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] lg:inline-flex"
        aria-label={tc("common.toggleSidebar")}
      >
        <PanelLeft className="size-5" aria-hidden />
      </button>

      <div className="hidden min-w-0 sm:block">
        <Breadcrumbs className="mb-0.5" />
        <h1 className="truncate text-base font-semibold">{resolvedTitle}</h1>
      </div>

      <div className="ms-auto flex items-center gap-2">
        <ConnectionStatus status="online" className="hidden md:inline-flex" />

        <EstablishmentSwitcher className="hidden lg:flex" />

        <LanguageSwitcher className="hidden sm:flex" />

        <ThemeToggle className="hidden sm:inline-flex" />

        <Popover>
          <PopoverTrigger className="relative inline-flex size-10 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            <Bell className="size-5" aria-hidden />
            <span className="absolute end-1.5 top-1.5 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-danger)] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[var(--color-danger)]" />
            </span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-sm font-semibold">
                {t("notifications.topbarTitle")}
              </p>
              <Badge variant="muted" size="sm">
                3
              </Badge>
            </div>
            <div className="mt-1 space-y-1">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  title={n.title}
                  description={n.description}
                  time={n.time}
                  unread={n.unread}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Dropdown>
          <DropdownTrigger className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-[var(--color-muted)]">
            <Avatar
              size="sm"
              src={profile?.avatar_url ?? undefined}
              fallback={initials}
            />
            <span className="hidden max-w-40 text-start sm:block">
              <span className="block truncate text-sm font-medium leading-tight text-[var(--color-foreground)]">
                {displayName}
              </span>
              <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                {displayEmail || t("auth.roleManager")}
              </span>
            </span>
            <ChevronsUpDown
              className="hidden size-4 text-[var(--color-muted-foreground)] sm:block"
              aria-hidden
            />
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownLabel>{displayName}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem
              onClick={() =>
                toast.info({
                  title: t("auth.profile"),
                  description: t("auth.profileComingSoon"),
                })
              }
            >
              <UserRound className="size-4" aria-hidden /> {t("auth.profile")}
            </DropdownItem>
            <DropdownItem
              onClick={() =>
                toast.info({
                  title: t("auth.settings"),
                  description: t("auth.settingsComingSoon"),
                })
              }
            >
              <Settings className="size-4" aria-hidden /> {t("auth.settings")}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              onClick={() => {
                void handleSignOut();
              }}
            >
              <LogOut className="size-4" aria-hidden /> {t("auth.signOut")}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
