import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getPosCatalog, getPosSettings, listPosReferences } from "@/services/pos-service";
import { listOpenOrders } from "@/services/pos-service";
import { PosView } from "@/features/pos/pos-view";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Point de vente",
};

export default async function PosPage() {
  await requirePagePermission("pos.access");
  const establishmentId = await requireCurrentEstablishment();
  const locale = await getLocale();

  const [catalog, settings, areas, openOrders] = await Promise.all([
    getPosCatalog(establishmentId, locale),
    getPosSettings(establishmentId),
    listPosReferences(establishmentId, locale),
    listOpenOrders(establishmentId),
  ]);

  return (
    <PosView
      catalog={catalog}
      settings={settings}
      areas={areas}
      initialOpenOrders={openOrders}
    />
  );
}