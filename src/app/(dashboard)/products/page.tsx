"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function ProductsPage() {
  const t = useTranslations("products");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
