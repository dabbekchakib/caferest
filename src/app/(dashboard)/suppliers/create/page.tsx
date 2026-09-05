import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { listPaymentMethods } from "@/services/suppliers-service";
import { SupplierForm } from "@/features/suppliers/supplier-form";

export const metadata: Metadata = {
  title: "New supplier",
};

export default async function CreateSupplierPage() {
  await requirePagePermission("suppliers.create");
  const establishmentId = await requireCurrentEstablishment();

  const [paymentMethods] = await Promise.all([
    listPaymentMethods(establishmentId),
  ]);

  return <SupplierForm mode="create" paymentMethods={paymentMethods} />;
}