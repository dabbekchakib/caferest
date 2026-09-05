"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function KitchenPage() {
  const t = useTranslations("kitchen");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
