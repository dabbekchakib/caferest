"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Power, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/stores/use-toast-store";
import { deleteSupplierAction, setSupplierStatusAction } from "@/features/suppliers/actions";
import { SupplierCatalogTab } from "./supplier-catalog-tab";
import { SupplierContactsTab } from "./supplier-contacts-tab";
import { SupplierPricingTab } from "./supplier-pricing-tab";
import { SupplierComparisonTab } from "./supplier-comparison-tab";
import type {
  SupplierWithRelations,
  SupplierContact,
  SupplierCatalogItem,
  SupplierPriceHistoryEntry,
  SupplierComparisonEntry,
} from "@/lib/suppliers/types";
import type { Unit, UnitConversion } from "@/lib/units/types";
import { formatCost } from "@/lib/ingredients/formatters";

interface SupplierDetailProps {
  supplier: SupplierWithRelations;
  contacts: SupplierContact[];
  catalog: SupplierCatalogItem[];
  priceHistory: SupplierPriceHistoryEntry[];
  comparison: SupplierComparisonEntry[];
  ingredients: {
    id: string;
    name: string;
    baseUnitId: string | null;
    baseUnitSymbol: string | null;
  }[];
  units: Unit[];
  conversions: UnitConversion[];
  paymentMethods: { id: string; name: string }[];
  canUpdate: boolean;
  canDelete: boolean;
  canActivate: boolean;
  canManageCatalog: boolean;
  canViewPrices: boolean;
  canUpdatePrices: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-end text-sm font-medium">{children}</dd>
    </div>
  );
}

export function SupplierDetail({
  supplier,
  contacts,
  catalog,
  priceHistory,
  comparison,
  ingredients,
  units,
  conversions,
  paymentMethods,
  canUpdate,
  canDelete,
  canActivate,
  canManageCatalog,
  canViewPrices,
  canUpdatePrices,
}: SupplierDetailProps) {
  const t = useTranslations("supplierDetails");
  const ts = useTranslations("suppliers");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const tActions = useTranslations("supplierActions");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function paymentMethodLabel(id: string | null): string | null {
    if (!id) return null;
    return paymentMethods.find((method) => method.id === id)?.name ?? null;
  }

  async function run(action: () => Promise<{ ok: boolean; key?: string }>, successTitle: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setDeleteOpen(false);
      setToggleOpen(false);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" });

  const fullAddress = [supplier.address_line_1, supplier.address_line_2].filter(Boolean).join(", ");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={supplier.name}
        description={supplier.code ?? undefined}
        breadcrumbs={[
          { label: tn("suppliers"), href: "/suppliers" },
          { label: supplier.name },
        ]}
        actions={
          <>
            {canActivate && (
              <Button variant="outline" onClick={() => setToggleOpen(true)}>
                <Power className="size-4" aria-hidden />
                {tActions(supplier.is_active ? "deactivate" : "activate")}
              </Button>
            )}
            {canUpdate && (
              <Link href={`/suppliers/${supplier.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="size-4" aria-hidden /> {t("edit")}
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                {tActions("delete")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {supplier.is_active ? (
          <Badge variant="success" size="sm" dot>
            {ts("active")}
          </Badge>
        ) : (
          <Badge variant="danger" size="sm" dot>
            {t("inactiveBadge")}
          </Badge>
        )}
        {(supplier.is_preferred || supplier.hasPreferredItems) && (
          <Badge size="sm">{t("preferredBadge")}</Badge>
        )}
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {ts("contacts", {})}{" "}
          <span className="font-medium">{contacts.length}</span> ·{" "}
          {t("catalogCount", { count: catalog.length })}
        </span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="catalog">{t("tabs.catalog")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("tabs.contacts")}</TabsTrigger>
          {canViewPrices && (
            <TabsTrigger value="pricing">{t("tabs.pricing")}</TabsTrigger>
          )}
          {canViewPrices && (
            <TabsTrigger value="comparison">{t("tabs.comparison")}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">
                {t("overview.identification")}
              </h3>
              <dl>
                <Row label={ts("code")}>{supplier.code ?? "—"}</Row>
                <Row label={ts("legalName")}>{supplier.legal_name ?? "—"}</Row>
                <Row label={t("overview.registrationNumber")}>
                  {supplier.registration_number ?? "—"}
                </Row>
                <Row label={t("overview.taxIdentifier")}>
                  {supplier.tax_identifier ?? "—"}
                </Row>
                <Row label={t("overview.website")}>
                  {supplier.website ?? "—"}
                </Row>
              </dl>
            </Card>
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">{t("overview.contact")}</h3>
              <dl>
                <Row label={t("overview.phone")}>{supplier.phone ?? "—"}</Row>
                <Row label={t("overview.mobile")}>{supplier.mobile ?? "—"}</Row>
                <Row label={t("overview.email")}>{supplier.email ?? "—"}</Row>
                <Row label={t("overview.contactPerson")}>
                  {supplier.contact_person ?? "—"}
                </Row>
                <Row label={t("overview.contactEmail")}>
                  {supplier.contact_email ?? "—"}
                </Row>
                <Row label={t("overview.contactPhone")}>
                  {supplier.contact_phone ?? "—"}
                </Row>
              </dl>
            </Card>
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">{t("overview.address")}</h3>
              <dl>
                <Row label={t("overview.address")}>
                  {fullAddress || "—"}
                </Row>
                <Row label={ts("city")}>{supplier.city ?? "—"}</Row>
                <Row label={t("overview.postal")}>
                  {`${supplier.postal_code ?? ""} ${supplier.state ?? ""} ${supplier.country ?? ""}`.trim() || "—"}
                </Row>
              </dl>
            </Card>
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">{t("overview.commercial")}</h3>
              <dl>
                <Row label={t("overview.paymentTerms")}>
                  {supplier.payment_terms ?? "—"}
                </Row>
                <Row label={t("overview.defaultPaymentMethod")}>
                  {paymentMethodLabel(supplier.default_payment_method_id) ?? "—"}
                </Row>
                <Row label={t("overview.deliveryLeadTimeDays")}>
                  {supplier.delivery_lead_time_days != null
                    ? `${supplier.delivery_lead_time_days} ${t("overview.daysSuffix")}`
                    : "—"}
                </Row>
                <Row label={t("overview.minimumOrderAmount")}>
                  {supplier.minimum_order_amount != null
                    ? formatCost(supplier.minimum_order_amount, locale)
                    : "—"}
                </Row>
                {supplier.notes && (
                  <Row label={t("overview.notes")}>{supplier.notes}</Row>
                )}
              </dl>
            </Card>
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">{ts("summary")}</h3>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t("createdAt", { date: date(supplier.created_at) })}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {t("lastUpdated", { date: date(supplier.updated_at) })}
              </p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="catalog">
          <SupplierCatalogTab
            supplierId={supplier.id}
            items={catalog}
            ingredients={ingredients}
            units={units}
            conversions={conversions}
            canManageCatalog={canManageCatalog}
            canViewPrices={canViewPrices}
            canUpdatePrices={canUpdatePrices}
          />
        </TabsContent>

        <TabsContent value="contacts">
          <SupplierContactsTab contacts={contacts} />
        </TabsContent>

        {canViewPrices && (
          <TabsContent value="pricing">
            <SupplierPricingTab history={priceHistory} />
          </TabsContent>
        )}

        {canViewPrices && (
          <TabsContent value="comparison">
            <SupplierComparisonTab comparison={comparison} currentSupplierId={supplier.id} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={toggleOpen}
        onOpenChange={(o) => !o && setToggleOpen(false)}
        title={tActions(supplier.is_active ? "deactivate" : "activate")}
        footer={
          <>
            <Button variant="outline" onClick={() => setToggleOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={supplier.is_active ? "danger" : "success"}
              loading={busy}
              onClick={() =>
                void run(
                  () =>
                    setSupplierStatusAction({
                      supplierId: supplier.id,
                      isActive: !supplier.is_active,
                    }),
                  tActions(supplier.is_active ? "deactivated" : "activated")
                )
              }
            >
              {tc("common.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">{supplier.name}</p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title={catalog.length > 0 ? ts("deleteSoftTitle") : ts("deleteTitle")}
        description={
          catalog.length > 0 ? ts("deleteSoftBody") : ts("deleteBody")
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(
                  () => deleteSupplierAction({ supplierId: supplier.id }),
                  catalog.length > 0
                    ? tActions("softDeleted")
                    : tActions("deleted")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">{supplier.name}</p>
      </Dialog>
    </div>
  );
}