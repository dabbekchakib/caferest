"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function CustomersPage() {
  const t = useTranslations("customers");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
