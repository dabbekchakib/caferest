import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import {
  getSupplier,
  listPaymentMethods,
} from "@/services/suppliers-service";
import { SupplierForm } from "@/features/suppliers/supplier-form";

export const metadata: Metadata = {
  title: "Edit supplier",
};

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("suppliers.update");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [supplier, paymentMethods] = await Promise.all([
    getSupplier(establishmentId, id),
    listPaymentMethods(establishmentId),
  ]);
  if (!supplier) notFound();

  return (
    <SupplierForm
      mode="edit"
      supplier={supplier}
      paymentMethods={paymentMethods}
    />
  );
}