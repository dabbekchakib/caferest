import type { Metadata } from "next";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { listSuppliers } from "@/services/suppliers-service";
import { listUnits } from "@/services/units-service";
import { listTaxes } from "@/services/products-service";
import { PurchaseOrderForm } from "@/features/purchases/purchase-order-form";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";

export const metadata: Metadata = {
  title: "New purchase order",
};

export default async function CreatePurchaseOrderPage() {
  await requirePermission("purchases.create");
  const establishmentId = await requireCurrentEstablishment();

  const [suppliers, taxes, units, defaultCurrency] = await Promise.all([
    listSuppliers(establishmentId, { activeOnly: true }),
    listTaxes(establishmentId),
    listUnits(establishmentId),
    getDefaultCurrencyCode(establishmentId),
  ]);

  return (
    <PurchaseOrderForm
      mode="create"
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      taxes={taxes.map((t) => ({ id: t.id, name: t.name, rate: t.rate }))}
      units={units.map((u) => ({ id: u.id, symbol: u.symbol }))}
      defaultCurrency={defaultCurrency}
    />
  );
}