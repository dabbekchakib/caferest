import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
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
  description = "Ce module sera développé dans une prochaine phase.",
  breadcrumb,
  children,
}: PlaceholderPageProps) {
  return (
    <AppShell title={title}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={title}
          description={description}
          breadcrumbs={[{ label: breadcrumb }]}
        />
        {children ?? (
          <EmptyState
            title={`${title} — à venir`}
            description="Ceci est un espace réservé. La fonctionnalité sera implémentée dans les phases suivantes."
            icon={<Construction className="size-7" aria-hidden />}
          />
        )}
      </div>
    </AppShell>
  );
}
