"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export interface SystemTestRow {
  route: string;
  module: string;
  ok: boolean;
}

interface SystemTestViewProps {
  rows: SystemTestRow[];
  registered: Set<string>;
}

export function SystemTestView({ rows, registered }: SystemTestViewProps) {
  const t = useTranslations("systemTest");
  const tn = useTranslations("navigation");

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tn("systemTest") }]}
      />

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {t("module")}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {t("route")}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {t("status")}
                </th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {t("nav")}
                </th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {t("open")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.route}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{row.module}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs">
                      {row.route}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <RouteBadge
                      value={row.ok}
                      readyLabel={t("statusOk")}
                      missingLabel={t("statusMissing")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RouteBadge
                      value={registered.has(row.route)}
                      readyLabel={t("navYes")}
                      missingLabel={t("navNo")}
                    />
                  </td>
                  <td className="px-4 py-3 text-end">
                    {row.ok ? (
                      <Link href={row.route}>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="size-4" aria-hidden />{" "}
                          {t("open")}
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        {t("footnote")}
      </p>
    </div>
  );
}

function RouteBadge({
  value,
  readyLabel,
  missingLabel,
}: {
  value: boolean;
  readyLabel: string;
  missingLabel: string;
}): ReactNode {
  return value ? (
    <Badge variant="success" size="sm" dot>
      {readyLabel}
    </Badge>
  ) : (
    <Badge variant="danger" size="sm" dot>
      {missingLabel}
    </Badge>
  );
}
