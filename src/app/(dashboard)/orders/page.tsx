"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function OrdersPage() {
  const t = useTranslations("orders");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
