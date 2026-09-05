"use client";

import { useTranslations } from "next-intl";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function MenuPage() {
  const t = useTranslations("menu");
  return <PlaceholderPage title={t("title")} breadcrumb={t("breadcrumb")} />;
}
