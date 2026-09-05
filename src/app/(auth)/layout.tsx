import type { ReactNode } from "react";
import { Coffee } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ToastViewport } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)]">
      <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2 text-base font-bold text-[var(--color-foreground)]">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
            <Coffee className="size-4" aria-hidden />
          </span>
          {APP_NAME}
        </span>
        <LanguageSwitcher className="hidden sm:flex" />
      </header>

      <main className="flex min-w-0 flex-1 items-start justify-center sm:items-center">
        {children}
      </main>

      <footer className="shrink-0 px-4 py-4 text-center text-xs text-[var(--color-muted-foreground)]">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>

      <ToastViewport />
    </div>
  );
}
