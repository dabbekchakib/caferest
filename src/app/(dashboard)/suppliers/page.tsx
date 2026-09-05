"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function SuppliersPage() {
  const t = useTranslations("suppliers");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
