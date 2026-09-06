/**
 * Agrégats du tableau de bord (purs, testables).
 *
 * Ne fait aucune I/O : reçoit les commandes du jour/historique et calcule
 * les indicateurs affichés par le dashboard (/dashboard).
 */

import type { PosOrderStatus, PosOrderSummary } from "../pos/types";

/** Statuts considérés comme « encaissés » pour le chiffre d'affaires. */
export const REVENUE_STATUSES: readonly PosOrderStatus[] = [
  "completed",
  "served",
];

export interface DashboardStats {
  /** CA du jour (commandes achevées/servies clôturées aujourd'hui). */
  revenue: number;
  /** Nombre de commandes créées aujourd'hui (tous statuts). */
  ordersCount: number;
  /** Panier moyen = CA du jour / commandes encaissées du jour. */
  averageOrder: number;
  /** Articles vendus aujourd'hui (commandes encaissées). */
  productsSold: number;
  /** Commandes actuellement ouvertes (en cours / en attente). */
  openOrdersCount: number;
}

export interface RevenueBucket {
  /** Début de journée (minuit local) — à mapper sur le label par le client. */
  dayStart: Date;
  total: number;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(order: PosOrderSummary, now: Date): boolean {
  return isSameDay(new Date(order.createdAt), now);
}

function isRevenue(order: PosOrderSummary): boolean {
  return REVENUE_STATUSES.includes(order.status);
}

export function computeDashboardStats(
  orders: readonly PosOrderSummary[],
  openOrdersCount: number,
  now: Date
): DashboardStats {
  let revenue = 0;
  let ordersCount = 0;
  let revenueOrders = 0;
  let productsSold = 0;

  for (const order of orders) {
    if (!isToday(order, now)) continue;
    ordersCount += 1;
    if (!isRevenue(order)) continue;
    revenue += order.total;
    revenueOrders += 1;
    productsSold += order.quantity;
  }

  return {
    revenue,
    ordersCount,
    averageOrder: revenueOrders > 0 ? revenue / revenueOrders : 0,
    productsSold,
    openOrdersCount,
  };
}

/**
 * CA par journée (dernières `days` journées, la plus récente en dernier).
 * Seules les commandes encaissées sont comptées.
 */
export function revenueByDay(
  orders: readonly PosOrderSummary[],
  now: Date,
  days = 7
): RevenueBucket[] {
  const today = startOfDay(now);
  const buckets: RevenueBucket[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - i);
    buckets.push({ dayStart, total: 0 });
  }

  for (const order of orders) {
    if (!isRevenue(order)) continue;
    const created = new Date(order.createdAt);
    for (const bucket of buckets) {
      const end = new Date(bucket.dayStart);
      end.setDate(bucket.dayStart.getDate() + 1);
      if (created >= bucket.dayStart && created < end) {
        bucket.total += order.total;
        break;
      }
    }
  }

  return buckets;
}

/** CA par type de vente pour les commandes encaissées du jour. */
export function revenueByType(
  orders: readonly PosOrderSummary[],
  now: Date
): Partial<Record<PosOrderSummary["orderType"], number>> {
  const totals: Partial<Record<PosOrderSummary["orderType"], number>> = {};
  for (const order of orders) {
    if (!isToday(order, now) || !isRevenue(order)) continue;
    totals[order.orderType] = (totals[order.orderType] ?? 0) + order.total;
  }
  return totals;
}