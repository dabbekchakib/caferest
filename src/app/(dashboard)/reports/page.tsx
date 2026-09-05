"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function ReportsPage() {
  const t = useTranslations("reports");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
