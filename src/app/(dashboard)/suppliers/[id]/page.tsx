import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  getSupplier,
  getSupplierContacts,
  getSupplierCatalog,
  getSupplierComparison,
  getSupplierPriceHistoryBySupplier,
  listPaymentMethods,
} from "@/services/suppliers-service";
import { listIngredients } from "@/services/ingredients-service";
import { listUnits } from "@/services/units-service";
import { getConversionsCached } from "@/services/units-cache";
import { SupplierDetail } from "@/features/suppliers/supplier-detail";

export const metadata: Metadata = {
  title: "Supplier details",
};

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("suppliers.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [
    supplier,
    canUpdate,
    canDelete,
    canActivate,
    canManageCatalog,
    canViewPrices,
    canUpdatePrices,
  ] = await Promise.all([
    getSupplier(establishmentId, id),
    hasPermission("suppliers.update"),
    hasPermission("suppliers.delete"),
    hasPermission("suppliers.activate"),
    hasPermission("suppliers.manage_catalog"),
    hasPermission("suppliers.view_prices"),
    hasPermission("suppliers.update_prices"),
  ]);
  if (!supplier) notFound();

  const contacts = await getSupplierContacts(establishmentId, id);
  const catalog = await getSupplierCatalog(establishmentId, id);

  const [ingredients, units, conversions, paymentMethods] = await Promise.all([
    listIngredients(establishmentId),
    listUnits(establishmentId),
    getConversionsCached(establishmentId),
    listPaymentMethods(establishmentId),
  ]);

  const ingredientIds: string[] = [];
  for (const item of catalog) {
    if (!ingredientIds.includes(item.ingredient_id)) {
      ingredientIds.push(item.ingredient_id);
    }
  }

  const priceHistory = canViewPrices
    ? await getSupplierPriceHistoryBySupplier(establishmentId, id)
    : [];
  const comparison = canViewPrices
    ? await getSupplierComparison(establishmentId, ingredientIds)
    : [];

  return (
    <SupplierDetail
      supplier={supplier}
      contacts={contacts}
      catalog={catalog}
      priceHistory={priceHistory}
      comparison={comparison}
      ingredients={ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        baseUnitId: ingredient.base_unit_id,
        baseUnitSymbol: ingredient.base_unit_id
          ? units.find((unit) => unit.id === ingredient.base_unit_id)?.symbol ?? null
          : null,
      }))}
      units={units}
      conversions={conversions}
      paymentMethods={paymentMethods.map((method) => ({
        id: method.id,
        name: method.name,
      }))}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canActivate={canActivate}
      canManageCatalog={canManageCatalog}
      canViewPrices={canViewPrices}
      canUpdatePrices={canUpdatePrices}
    />
  );
}