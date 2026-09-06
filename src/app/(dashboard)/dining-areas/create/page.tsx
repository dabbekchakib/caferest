import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { DiningAreaForm } from "@/features/dining-areas/dining-area-form";

export const metadata: Metadata = {
  title: "New dining area",
};

export default async function CreateDiningAreaPage() {
  await requirePagePermission("dining_areas.create");
  await requireCurrentEstablishment();

  return <DiningAreaForm mode="create" />;
}