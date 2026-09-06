"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Home, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common.pages");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--color-muted)]">
        <FileQuestion className="size-8 text-[var(--color-muted-foreground)]" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("notFound")}</h1>
        <p className="text-[var(--color-muted-foreground)]">
          {t("notFoundDescription")}
        </p>
      </div>
      <Link href="/dashboard">
        <Button>
          <Home className="size-4" aria-hidden /> {t("backHome")}
        </Button>
      </Link>
    </div>
  );
}
