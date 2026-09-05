"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function TablesPage() {
  const t = useTranslations("tables");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
