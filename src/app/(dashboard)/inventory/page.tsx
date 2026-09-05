"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function InventoryPage() {
  const t = useTranslations("inventory");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
