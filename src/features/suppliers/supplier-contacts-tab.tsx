"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { SupplierContact } from "@/lib/suppliers/types";

export function SupplierContactsTab({ contacts }: { contacts: SupplierContact[] }) {
  const t = useTranslations("supplierContacts");

  const columns: Column<SupplierContact>[] = [
    {
      key: "name",
      header: t("columns.name"),
      accessor: (contact) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">
            {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—"}
          </span>
          {contact.is_primary && <Badge size="sm">{t("primary")}</Badge>}
        </span>
      ),
      sortable: true,
      sortValue: (contact) =>
        [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    },
    {
      key: "jobTitle",
      header: t("columns.jobTitle"),
      accessor: (contact) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {contact.job_title ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "email",
      header: t("columns.email"),
      accessor: (contact) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {contact.email ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "phone",
      header: t("columns.phone"),
      accessor: (contact) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {contact.phone ?? contact.mobile ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("columns.status"),
      accessor: (contact) =>
        contact.is_active ? (
          <Badge variant="success" size="sm" dot>
            {t("active")}
          </Badge>
        ) : (
          <Badge variant="danger" size="sm" dot>
            {t("inactive")}
          </Badge>
        ),
    },
  ];

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold">{t("title")}</h3>
      {contacts.length === 0 ? (
        <p className="py-6 text-sm text-[var(--color-muted-foreground)]">
          {t("noData")}
        </p>
      ) : (
        <DataTable columns={columns} data={contacts} rowKey={(contact) => contact.id} striped />
      )}
    </Card>
  );
}