"use client";

import { useMemo } from "react";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createFormatters } from "@/lib/localization";
import { getDirection, type Locale } from "@/i18n/routing";

export default function I18nDemoPage() {
  const t = useTranslations("uiTest");
  const locale = useLocale() as Locale;
  const fmt = useMemo(() => createFormatters({ locale }), [locale]);
  const direction = getDirection(locale);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("i18n.title")}
        description={t("i18n.description")}
        breadcrumbs={[{ label: t("i18n.title") }]}
        actions={
          <Badge variant="accent">
            <Languages className="size-3.5" aria-hidden />
            {locale}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("i18n.localeLabel")}</CardTitle>
          <CardDescription>{t("i18n.switchLabel")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormatCell label={t("i18n.localeLabel")} value={locale} mono />
          <FormatCell
            label={t("i18n.directionLabel")}
            value={direction.toUpperCase()}
            badge
          />
          <FormatCell
            label={t("i18n.dateLabel")}
            value={fmt.formatDateTime(new Date("2026-09-04T15:30:00"))}
            mono
          />
          <FormatCell
            label={t("i18n.timeLabel")}
            value={fmt.formatTime(new Date("2026-09-04T15:30:00"))}
            mono
          />
          <FormatCell
            label={t("i18n.numberLabel")}
            value={fmt.formatNumber(1234567.89)}
            mono
          />
          <FormatCell
            label={t("i18n.currencyLabel")}
            value={fmt.formatCurrency(1234.567)}
            mono
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("i18n.pluralLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-mono text-lg text-[var(--color-foreground)]">
            {t("i18n.quantityItem", { count: 0 })}
          </p>
          <p className="font-mono text-lg text-[var(--color-foreground)]">
            {t("i18n.quantityItem", { count: 1 })}
          </p>
          <p className="font-mono text-lg text-[var(--color-foreground)]">
            {t("i18n.quantityItem", { count: 7 })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FormatCell({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-4">
      <span className="text-sm text-[var(--color-muted-foreground)]">
        {label}
      </span>
      {badge ? (
        <Badge variant="muted">{value}</Badge>
      ) : (
        <span
          className={`text-base text-[var(--color-foreground)] ${mono ? "font-mono" : "font-medium"}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}
