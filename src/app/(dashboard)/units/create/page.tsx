import type { Metadata } from "next";
import { requirePagePermission } from "@/services/authorization";
import { UnitForm } from "@/features/units/unit-form";

export const metadata: Metadata = {
  title: "New unit",
};

export default async function CreateUnitPage() {
  await requirePagePermission("units.create");

  return <UnitForm mode="create" />;
}