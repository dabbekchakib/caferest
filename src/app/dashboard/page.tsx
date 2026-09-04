"use client";

import {
  ArrowUpRight,
  Banknote,
  Download,
  Package,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, BarChart } from "@/components/shared/charts";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Vue générale de votre établissement"
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <>
            <Button variant="outline" size="md">
              <Download className="size-4" aria-hidden /> Exporter
            </Button>
            <Button size="md">
              <RefreshCw className="size-4" aria-hidden /> Actualiser
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chiffre d'affaires"
          value={formatCurrency(12480.5)}
          icon={<Banknote className="size-5" aria-hidden />}
          trend={12.4}
          trendDirection="up"
          trendLabel="vs hier"
        />
        <StatCard
          label="Commandes"
          value="342"
          icon={<ShoppingCart className="size-5" aria-hidden />}
          trend={8.1}
          trendDirection="up"
          trendLabel="vs hier"
        />
        <StatCard
          label="Panier moyen"
          value={formatCurrency(36.5)}
          icon={<ArrowUpRight className="size-5" aria-hidden />}
          trend={-2.3}
          trendDirection="down"
          trendLabel="vs hier"
        />
        <StatCard
          label="Produits vendus"
          value="1 284"
          icon={<Package className="size-5" aria-hidden />}
          trend={5.7}
          trendDirection="up"
          trendLabel="vs hier"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Évolution du chiffre d'affaires</CardTitle>
            <Badge variant="muted">7 derniers jours</Badge>
          </CardHeader>
          <CardContent>
            <LineChart
              data={[3200, 4100, 3800, 5200, 4600, 6800, 7200]}
              labels={["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]}
              height={240}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventes par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={[25, 18, 30, 12, 15]} labels={["Café", "Bar", "Cuisine", "Desserts", "À emporter"]} height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Commandes récentes</CardTitle>
            <Button variant="ghost" size="sm">Voir tout</Button>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock critique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StockAlertItem name="Espresso" remaining={8} threshold={20} />
            <StockAlertItem name="Lait entier" remaining={12} threshold={30} />
            <StockAlertItem name="Glace vanille" remaining={5} threshold={15} />
            <StockAlertItem name="Pain burger" remaining={18} threshold={40} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface Order {
  id: number;
  ref: string;
  table: string;
  items: number;
  total: number;
  status: "payée" | "en cours" | "en attente";
}

const orders: Order[] = [
  { id: 1, ref: "#1042", table: "Table 04", items: 3, total: 28.5, status: "en cours" },
  { id: 2, ref: "#1041", table: "Table 07", items: 2, total: 36.0, status: "payée" },
  { id: 3, ref: "#1040", table: "À emporter", items: 5, total: 52.75, status: "en attente" },
  { id: 4, ref: "#1039", table: "Table 02", items: 4, total: 41.25, status: "payée" },
  { id: 5, ref: "#1038", table: "Table 12", items: 1, total: 8.0, status: "en cours" },
];

const columns: Column<Order>[] = [
  { key: "ref", header: "Référence", accessor: (r) => <span className="font-medium">{r.ref}</span>, sortable: true, sortValue: (r) => r.ref },
  { key: "table", header: "Table", accessor: (r) => r.table, sortable: true },
  { key: "items", header: "Articles", accessor: (r) => r.items, hideOnMobile: true, sortable: true, sortValue: (r) => r.items },
  { key: "total", header: "Total", accessor: (r) => <span className="font-semibold">{formatCurrency(r.total)}</span>, sortable: true, sortValue: (r) => r.total },
  {
    key: "status",
    header: "Statut",
    accessor: (r) =>
      r.status === "payée" ? (
        <StatusBadge status="success" label="Payée" />
      ) : r.status === "en cours" ? (
        <StatusBadge status="warning" label="En cours" />
      ) : (
        <StatusBadge status="info" label="En attente" />
      ),
  },
];

function RecentOrdersTable() {
  return <DataTable columns={columns} data={orders} rowKey={(r) => String(r.id)} />;
}

function StockAlertItem({
  name,
  remaining,
  threshold,
}: {
  name: string;
  remaining: number;
  threshold: number;
}) {
  const percent = Math.min(100, (remaining / threshold) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--color-foreground)]">{name}</span>
        <Badge variant={percent < 40 ? "danger" : "warning"} size="sm">
          {remaining} restant{remaining > 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-danger)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
