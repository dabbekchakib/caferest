import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { StocktakeCreateForm } from "@/features/stocktakes/stocktake-create-form";

export const metadata: Metadata = {
  title: "New stocktake",
};

export default async function StocktakeCreatePage() {
  await requirePagePermission("stocktakes.create");
  await requireCurrentEstablishment();
  return <StocktakeCreateForm />;
}