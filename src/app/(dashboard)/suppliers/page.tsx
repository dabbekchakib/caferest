import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getSuppliersPage } from "@/services/suppliers-service";
import { SupplierList } from "@/features/suppliers/supplier-list";

export const metadata: Metadata = {
  title: "Suppliers",
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    preferred?: string;
    page?: string;
  }>;
}) {
  await requirePagePermission("suppliers.view");
  const establishmentId = await requireCurrentEstablishment();

  const sp = await searchParams;
  const status = sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;
  const preferred = sp.preferred === "1";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, canCreate, canUpdate, canDelete, canActivate] = await Promise.all([
    getSuppliersPage(establishmentId, {
      page,
      query: sp.q,
      activeOnly: status === "active",
      inactiveOnly: status === "inactive",
      preferredOnly: preferred,
    }),
    hasPermission("suppliers.create"),
    hasPermission("suppliers.update"),
    hasPermission("suppliers.delete"),
    hasPermission("suppliers.activate"),
  ]);

  return (
    <SupplierList
      result={result}
      query={sp.q ?? ""}
      status={status ?? "all"}
      preferred={preferred}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canActivate={canActivate}
    />
  );
}