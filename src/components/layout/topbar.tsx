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
import { useAppStore } from "@/stores/use-app-store";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/components/ui/avatar";
import { ConnectionStatus } from "@/components/shared/connection-status";
import { NotificationItem } from "@/components/shared/notification-item";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useToast } from "@/stores/use-toast-store";
import { Badge } from "@/components/ui/badge";

const notifications = [
  {
    id: "1",
    title: "Nouvelle commande #1042",
    description: "Table 04 — 3 articles",
    time: "Il y a 2 min",
    unread: true,
  },
  {
    id: "2",
    title: "Stock bas : Espresso",
    description: "Il reste 8 unités",
    time: "Il y a 15 min",
    unread: true,
  },
  {
    id: "3",
    title: "Caisse clôturée",
    description: "Session du jour validée",
    time: "Il y a 1 h",
    unread: false,
  },
];

export function Topbar({ title }: { title?: string }) {
  const toggleMobileNav = useAppStore((state) => state.toggleMobileNav);
  const toggleSidebarCollapsed = useAppStore((state) => state.toggleSidebarCollapsed);
  const toast = useToast();

  return (
    <header className="sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-[var(--color-header-border)] bg-[var(--color-header)] px-4 text-[var(--color-header-foreground)]">
      <button
        type="button"
        onClick={toggleMobileNav}
        className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className="hidden size-10 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] lg:inline-flex"
        aria-label="Réduire / agrandir la sidebar"
      >
        <PanelLeft className="size-5" aria-hidden />
      </button>

      <h1 className="hidden truncate text-base font-semibold sm:block">{title ?? "Dashboard"}</h1>

      <div className="ms-auto flex items-center gap-2">
        <ConnectionStatus status="online" className="hidden md:inline-flex" />

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
              <p className="text-sm font-semibold">Notifications</p>
              <Badge variant="muted" size="sm">3</Badge>
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
            <Avatar size="sm" fallback="KA" />
            <span className="hidden text-start sm:block">
              <span className="block text-sm font-medium leading-tight text-[var(--color-foreground)]">Karim Ahmed</span>
              <span className="block text-xs text-[var(--color-muted-foreground)]">Manager</span>
            </span>
            <ChevronsUpDown className="hidden size-4 text-[var(--color-muted-foreground)] sm:block" aria-hidden />
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownLabel>Karim Ahmed</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onClick={() => toast.info({ title: "Profil", description: "Page profil à venir." })}>
              <UserRound className="size-4" aria-hidden /> Mon profil
            </DropdownItem>
            <DropdownItem onClick={() => toast.info({ title: "Paramètres", description: "Page paramètres à venir." })}>
              <Settings className="size-4" aria-hidden /> Paramètres
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onClick={() => toast.warning({ title: "Déconnexion", description: "Fonctionnalité à venir." })}>
              <LogOut className="size-4" aria-hidden /> Déconnexion
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
