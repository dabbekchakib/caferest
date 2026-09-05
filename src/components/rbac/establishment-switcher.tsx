"use client";

import { Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useAuthorization } from "@/hooks/use-authorization";
import { useToast } from "@/stores/use-toast-store";
import { setCurrentEstablishmentAction } from "@/features/establishment/actions";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

export interface EstablishmentSwitcherProps {
  className?: string;
}

/**
 * Lets the user pick the establishment they operate in for this request.
 * Persisted in the `NEXT_ESTABLISHMENT` cookie by the server action; the page
 * tree is revalidated so the authorization context (roles/permissions) and all
 * establishment-scoped screens refresh.
 */
export function EstablishmentSwitcher({
  className,
}: EstablishmentSwitcherProps) {
  const { context, currentEstablishmentId } = useAuthorization();
  const t = useTranslations("authorization");
  const tRoot = useTranslations();
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const memberships = context.memberships;
  const current =
    memberships.find((m) => m.id === currentEstablishmentId) ?? null;

  if (memberships.length < 2) return null;

  async function handleSwitch(establishmentId: string) {
    if (establishmentId === currentEstablishmentId) return;
    startTransition(async () => {
      const result = await setCurrentEstablishmentAction({
        establishmentId,
      });
      if (result.ok) {
        toast.success({
          title: t("switch.successTitle"),
          description: t("switch.successDescription"),
        });
      } else {
        toast.error({
          title: tc("common.error"),
          description: tRoot(result.key),
        });
      }
      router.refresh();
    });
  }

  const label = current?.name ?? t("switch.placeholder");

  return (
    <Dropdown>
      <DropdownTrigger className={cn("flex items-center gap-2 rounded-lg", className)}>
        <Store className="size-4 text-[var(--color-muted-foreground)]" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownLabel>{t("switch.title")}</DropdownLabel>
        <DropdownSeparator />
        {memberships.map((membership) => (
          <DropdownItem
            key={membership.id}
            onClick={() => void handleSwitch(membership.id)}
            aria-current={membership.id === currentEstablishmentId ? "true" : undefined}
          >
            {membership.name}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}