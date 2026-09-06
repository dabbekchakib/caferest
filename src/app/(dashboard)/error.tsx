"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--color-muted)]">
        <AlertTriangle
          className="size-8 text-[var(--color-danger)]"
          aria-hidden
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("error.title")}
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          {t("error.description")}
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw className="size-4" aria-hidden /> {t("pages.retry")}
      </Button>
    </div>
  );
}
