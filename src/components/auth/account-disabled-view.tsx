"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, TriangleAlert } from "lucide-react";
import { signOut } from "@/lib/auth/auth-service";
import { createClient } from "@/lib/supabase/client";
import type { AuthClientLike } from "@/lib/auth/auth-types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "./auth-shell";

/**
 * Shown when the user's profile is inactive (`profiles.is_active = false`).
 * Offers a language switcher and a guaranteed way to clear the session.
 * Branding pulls from the theme's primary color via the design tokens.
 */
export function AccountDisabledView() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(createClient() as unknown as AuthClientLike);
    } catch {
      /* session may already be gone — proceed to login anyway */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <AuthShell
      title={t("accountDisabled.title")}
      subtitle={t("accountDisabled.subtitle")}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <Alert variant="warning">{t("accountDisabled.description")}</Alert>

        <Button
          variant="accent"
          fullWidth
          onClick={() => {
            window.location.href = `mailto:?subject=${encodeURIComponent(t("accountDisabled.contactAdmin"))}`;
          }}
        >
          {t("accountDisabled.contactAdmin")}
        </Button>

        <Button
          variant="outline"
          fullWidth
          loading={busy}
          onClick={handleSignOut}
        >
          <LogOut className="size-4" aria-hidden />
          {t("accountDisabled.signOut")}
        </Button>
      </div>
    </AuthShell>
  );
}
