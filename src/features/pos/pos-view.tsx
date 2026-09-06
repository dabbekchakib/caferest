"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import { CatalogPanel } from "./components/catalog-panel";
import { CartPanel } from "./components/cart-panel";
import { PosHeader } from "./components/pos-header";
import { TablePicker } from "./components/table-picker";
import { OpenOrdersPanel } from "./components/open-orders-panel";
import { createPosOrderAction, listPosCustomersAction } from "./actions";
import { usePosStore } from "@/stores/pos-store";
import type {
  PosAreaRef,
  PosCatalog,
  PosOrderSummary,
  PosSettings,
} from "@/lib/pos/types";

interface PosViewProps {
  catalog: PosCatalog;
  settings: PosSettings;
  areas: PosAreaRef[];
  initialOpenOrders: PosOrderSummary[];
}

export function PosView({
  catalog,
  settings,
  areas,
  initialOpenOrders,
}: PosViewProps) {
  const t = useTranslations("pos");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const {
    saleType,
    tableId,
    diningAreaId,
    customerId,
    notes,
    discountAmount,
    lines,
    addProduct,
    changeLineQuantity,
    removeLine,
    clearCart,
    setSaleType,
    setTable,
    setCustomer,
    setNotes,
    setDiscountAmount,
    ensureOperationId,
    resetAfterOrder,
  } = usePosStore();

  const [tablesOpen, setTablesOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedTable = areas
    .flatMap((area) => area.tables)
    .find((table) => table.id === tableId);
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId
  );
  const withoutTable = saleType === "takeaway" || saleType === "delivery";

  const loadCustomers = useCallback(async () => {
    const result = await listPosCustomersAction();
    if (result.ok) {
      setCustomers(result.data);
    } else {
      toast.error({ title: tRoot(result.key) });
    }
  }, [tRoot, toast]);

  function openCustomers() {
    if (customers.length === 0) loadCustomers();
    setCustomersOpen(true);
  }

  async function placeOrder() {
    if (lines.length === 0) return;
    setSubmitting(true);
    const result = await createPosOrderAction({
      clientOperationId: ensureOperationId(),
      orderType: saleType,
      tableId: withoutTable ? null : tableId,
      diningAreaId: withoutTable ? null : diningAreaId,
      customerId,
      notes,
      discountAmount,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      })),
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success({
        title: t("orderCreated", { number: result.data.orderNumber }),
      });
      resetAfterOrder();
      router.refresh();
    } else {
      toast.error({ title: tRoot(result.key) });
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4 lg:h-[calc(100vh-4rem)]">
      <PosHeader
        saleType={saleType}
        onSaleTypeChange={setSaleType}
        tableNumber={selectedTable?.tableNumber ?? null}
        customerName={selectedCustomer?.name ?? null}
        notes={notes}
        onNotesChange={setNotes}
        linesCount={lines.reduce((sum, line) => sum + line.quantity, 0)}
        linesTotal={lines.reduce(
          (sum, line) => sum + line.unitPrice * line.quantity,
          0
        )}
        onOpenTables={() => setTablesOpen(true)}
        onOpenCustomers={openCustomers}
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-5">
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
          <div className="min-h-0 flex-1 overflow-hidden">
            <CatalogPanel catalog={catalog} onAdd={addProduct} />
          </div>
        </div>
        <div className="min-h-0 lg:col-span-2">
          <CartPanel
            lines={lines}
            discountAmount={discountAmount}
            allowDiscount={settings.allowDiscount}
            submitting={submitting}
            onSetDiscount={setDiscountAmount}
            onQuantity={changeLineQuantity}
            onRemove={removeLine}
            onClear={clearCart}
            onSubmit={placeOrder}
          />
        </div>
        <div className="min-h-0 lg:col-span-1">
          <OpenOrdersPanel orders={initialOpenOrders} />
        </div>
      </div>

      <Dialog
        open={tablesOpen}
        onOpenChange={setTablesOpen}
        size="lg"
        title={t("selectTable")}
      >
        <TablePicker
          areas={areas}
          selectedTableId={tableId}
          selectedAreaId={diningAreaId}
          onSelect={(tid, aid) => {
            setTable(tid, aid);
            setTablesOpen(false);
          }}
        />
      </Dialog>

      <Dialog
        open={customersOpen}
        onOpenChange={setCustomersOpen}
        size="md"
        title={t("selectCustomer")}
      >
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setCustomer(null);
              setCustomersOpen(false);
            }}
          >
            {t("noCustomer")}
          </Button>
          {customers.map((customer) => (
            <Button
              key={customer.id}
              variant={customerId === customer.id ? "primary" : "outline"}
              className="w-full justify-start"
              onClick={() => {
                setCustomer(customer.id);
                setCustomersOpen(false);
              }}
            >
              {customer.name}
            </Button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}