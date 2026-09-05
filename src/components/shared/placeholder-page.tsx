import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export interface PlaceholderPageProps {
  title: string;
  description?: string;
  breadcrumb: string;
  children?: ReactNode;
}

export function PlaceholderPage({
  title,
  description,
  breadcrumb,
  children,
}: PlaceholderPageProps) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description ?? t("empty.comingSoon")}
        breadcrumbs={[{ label: breadcrumb }]}
      />
      {children ?? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.placeholder")}
          icon={<Construction className="size-7" aria-hidden />}
        />
      )}
    </div>
  );
}
