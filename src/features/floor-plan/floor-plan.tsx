"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Grid3X3,
  Hand,
  MousePointer2,
  Plus,
  RefreshCcw,
  Save,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/stores/use-toast-store";
import type {
  DiningAreaWithTranslations,
  DiningTableListItem,
  DiningTableStatus,
} from "@/lib/tables/types";
import {
  TABLE_STATUS_LABEL_KEYS,
  TABLE_STATUS_META,
} from "@/lib/tables/status";
import {
  FLOOR_PLAN_SIZE,
  FLOOR_PLAN_SNAP,
  FLOOR_PLAN_FINE_SNAP,
  clampRotation,
  clampNumber,
  snapRotation,
  withinCanvas,
} from "@/lib/floor-plan/geometry";
import { updateTableFloorPlanAction } from "@/features/tables/actions";

interface FloorPlanProps {
  areas: DiningAreaWithTranslations[];
  tables: DiningTableListItem[];
  canEdit: boolean;
  canCreate: boolean;
}

interface WorkingTable {
  id: string;
  name: string;
  tableNumber: string | null;
  areaId: string | null;
  areaName: string | null;
  areaColor: string | null;
  status: DiningTableStatus;
  color: string | null;
  shape: "round" | "square" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

type WorkingPatch = Pick<
  WorkingTable,
  "areaId" | "areaName" | "areaColor" | "x" | "y" | "width" | "height" | "rotation"
>;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function FloorPlan({
  areas,
  tables,
  canEdit,
  canCreate,
}: FloorPlanProps) {
  const t = useTranslations("floorPlan");
  const tTab = useTranslations("tables");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [gridOn, setGridOn] = useState(true);
  const [snapOn, setSnapOn] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [working, setWorking] = useState<Map<string, WorkingTable>>(() => {
    const map = new Map<string, WorkingTable>();
    for (const table of tables) {
      map.set(table.id, {
        id: table.id,
        name: table.name,
        tableNumber: table.table_number,
        areaId: table.area_id,
        areaName: table.areaName,
        areaColor: table.areaColor,
        status: table.status,
        color: table.color,
        shape: table.shape,
        x: table.position_x ?? 0,
        y: table.position_y ?? 0,
        width: table.width ?? 90,
        height: table.height ?? 90,
        rotation: table.rotation ?? 0,
      });
    }
    return map;
  });

  const areaById = useMemo(() => {
    const map = new Map<string, DiningAreaWithTranslations>();
    for (const area of areas) map.set(area.id, area);
    return map;
  }, [areas]);

  const dirtyList = useMemo(
    () => tables.filter((table) => dirtyIds.has(table.id)),
    [tables, dirtyIds]
  );

  const selected = selectedId ? working.get(selectedId) : null;

  function markDirty(id: string) {
    setDirtyIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function patchTable(id: string, patch: Partial<WorkingPatch>) {
    setWorking((prev) => {
      const current = prev.get(id);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(id, { ...current, ...patch });
      return next;
    });
    markDirty(id);
  }

  function worldPoint(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  function startDrag(
    id: string,
    clientX: number,
    clientY: number,
    event: PointerEvent<HTMLElement>
  ) {
    if (!canEdit) return;
    const table = working.get(id);
    if (!table) return;
    event.preventDefault();
    setSelectedId(id);
    setDragging({
      id,
      startClientX: clientX,
      startClientY: clientY,
      startWorldX: table.x,
      startWorldY: table.y,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!canEdit) return;
    if (!dragging) return;

    const table = working.get(dragging.id);
    if (!table) return;
    const step = snapOn ? FLOOR_PLAN_SNAP : FLOOR_PLAN_FINE_SNAP;
    const dx = (event.clientX - dragging.startClientX) / zoom;
    const dy = (event.clientY - dragging.startClientY) / zoom;
    const nextX = Math.round((dragging.startWorldX + dx) / step) * step;
    const nextY = Math.round((dragging.startWorldY + dy) / step) * step;
    patchTable(dragging.id, {
      x: withinCanvas(nextX, table.width),
      y: withinCanvas(nextY, table.height),
    });
  }

  function finishDrag() {
    setDragging(null);
    setPanning(false);
  }

  function updateSelected(
    field: keyof WorkingPatch,
    raw: string
  ) {
    if (!selectedId || !canEdit) return;
    const table = working.get(selectedId);
    if (!table) return;

    if (field === "areaId") {
      const area = raw ? areaById.get(raw) : undefined;
      patchTable(table.id, {
        areaId: raw || null,
        areaName: area ? area.name : null,
        areaColor: area?.color ?? null,
      });
      return;
    }

    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return;

    if (field === "rotation") {
      patchTable(table.id, { rotation: clampRotation(value) });
      return;
    }
    if (field === "width" || field === "height") {
      patchTable(table.id, {
        [field]: clampNumber(value, 50, FLOOR_PLAN_SIZE),
      });
      return;
    }
    if (field === "x" || field === "y") {
      patchTable(table.id, {
        [field]: withinCanvas(value, field === "x" ? table.width : table.height),
      });
      return;
    }
  }

  async function save() {
    if (dirtyList.length === 0 || !canEdit) return;
    setBusy(true);
    const result = await updateTableFloorPlanAction({
      patches: dirtyList
        .map((table) => {
          const item = working.get(table.id);
          if (!item) return null;
          return {
            tableId: table.id,
            areaId: item.areaId ?? table.area_id,
            positionX: item.x,
            positionY: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
          };
        })
        .filter((patch): patch is NonNullable<typeof patch> => patch !== null),
    });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("saved") });
      setDirtyIds(new Set());
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tn("floorPlan") }]}
        actions={
          <div className="flex items-center gap-2">
            {canCreate && (
              <Link href="/tables/create">
                <Button variant="outline">
                  <Plus className="size-4" aria-hidden /> {t("addTable")}
                </Button>
              </Link>
            )}
            {canEdit && (
              <Button
                onClick={() => void save()}
                loading={busy}
                disabled={dirtyList.length === 0}
              >
                <Save className="size-4" aria-hidden /> {t("save")}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 rounded-t-xl border border-b-0 border-[var(--color-border)] bg-[var(--color-card)] p-2">
            <Button
              variant={tool === "select" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTool("select")}
            >
              <MousePointer2 className="size-4" aria-hidden /> {t("tool.select")}
            </Button>
            <Button
              variant={tool === "pan" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTool("pan")}
            >
              <Hand className="size-4" aria-hidden /> {t("tool.pan")}
            </Button>
            <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
            <Button
              variant={gridOn ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGridOn((v) => !v)}
            >
              <Grid3X3 className="size-4" aria-hidden /> {t("tool.grid")}
            </Button>
            <Button
              variant={snapOn ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSnapOn((v) => !v)}
            >
              {t("tool.snap")}
            </Button>
            <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}
              aria-label={t("tool.zoomOut")}
            >
              <ZoomOut className="size-4" aria-hidden />
            </Button>
            <span className="min-w-10 text-center text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}
              aria-label={t("tool.zoomIn")}
            >
              <ZoomIn className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setZoom(0.8);
                setPan({ x: 24, y: 24 });
              }}
              aria-label={t("tool.reset")}
            >
              <RefreshCcw className="size-4" aria-hidden />
            </Button>
          </div>

          <div
            ref={containerRef}
            className="relative h-[540px] touch-none overflow-hidden rounded-b-xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:h-[620px]"
            style={{
              backgroundImage:
                gridOn
                  ? "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)"
                  : "none",
              backgroundSize: `${FLOOR_PLAN_SNAP * zoom}px ${FLOOR_PLAN_SNAP * zoom}px`,
              cursor: tool === "pan" ? "grab" : dragging ? "grabbing" : "default",
            }}
            onPointerDown={(event) => {
              if (tool === "pan") {
                setPanning(true);
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerMove={(event) => {
              if (panning) {
                setPan((prev) => ({
                  x: prev.x + event.movementX,
                  y: prev.y + event.movementY,
                }));
              }
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onWheel={(event) => {
              if (!event.ctrlKey) return;
              event.preventDefault();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const before = worldPoint(event.clientX, event.clientY);
              const factor = event.deltaY < 0 ? 1.1 : 0.9;
              const nextZoom = Math.min(
                MAX_ZOOM,
                Math.max(MIN_ZOOM, zoom * factor)
              );
              const after = {
                x: (event.clientX - rect.left - pan.x) / nextZoom,
                y: (event.clientY - rect.top - pan.y) / nextZoom,
              };
              setZoom(nextZoom);
              setPan((prev) => ({
                x: prev.x + (after.x - before.x) * nextZoom,
                y: prev.y + (after.y - before.y) * nextZoom,
              }));
            }}
          >
            <div
              className="absolute"
              style={{
                left: pan.x,
                top: pan.y,
                width: FLOOR_PLAN_SIZE * zoom,
                height: FLOOR_PLAN_SIZE * zoom,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {areas.map((area, index) => {
                const zoneHeight = 76;
                const left = 16 + (index % 4) * 30;
                const top = 16 + index * (zoneHeight + 14);
                const zoneWidth = 200 + (index % 3) * 40;
                return (
                  <div
                    key={area.id}
                    className="absolute flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{
                      left,
                      top,
                      width: zoneWidth,
                      height: zoneHeight,
                      borderColor: area.color ?? "#4f46e5",
                      backgroundColor: `${area.color ?? "#4f46e5"}14`,
                    }}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: area.color ?? "#4f46e5" }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">
                      {area.name}
                    </span>
                  </div>
                );
              })}

              {Array.from(working.values()).map((table) => {
                const isSelected = table.id === selectedId;
                const isDirty = dirtyIds.has(table.id);
                return (
                  <button
                    key={table.id}
                    type="button"
                    aria-label={table.name}
                    onPointerDown={(event) => {
                      if (tool === "pan") return;
                      startDrag(table.id, event.clientX, event.clientY, event);
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishDrag}
                    className={[
                      "absolute flex select-none items-center justify-center p-0.5",
                      canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                    ].join(" ")}
                    style={{
                      left: table.x * zoom,
                      top: table.y * zoom,
                      width: table.width * zoom,
                      height: table.height * zoom,
                      transform: `rotate(${table.rotation}deg)`,
                      transformOrigin: "center",
                    }}
                  >
                    {table.areaId && (
                      <span
                        className="pointer-events-none absolute -inset-1.5 rounded-2xl border-2 border-dashed"
                        style={{ borderColor: table.areaColor ?? "transparent", opacity: 0.55 }}
                        aria-hidden
                      />
                    )}
                    <span
                      className={[
                        "flex h-full w-full items-center justify-center rounded-lg border-2",
                        table.shape === "round" ? "rounded-full" : "rounded-md",
                      ].join(" ")}
                      style={{
                        backgroundColor: table.color ?? "#4f46e5",
                        borderColor: isSelected
                          ? "var(--color-primary)"
                          : isDirty
                            ? "var(--color-warning)"
                            : "rgba(255,255,255,0.35)",
                        boxShadow: isSelected
                          ? "0 0 0 3px var(--color-ring)"
                          : "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    >
                      <span className="pointer-events-none px-1 text-center text-[11px] font-semibold leading-tight text-white">
                        {table.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
            <span>
              {tables.length} {t("summary.tables")} · {areas.length}{" "}
              {t("summary.areas")}
            </span>
            {dirtyList.length > 0 && (
              <span className="text-[var(--color-warning)]">
                {dirtyList.length} {t("summary.unsaved")}
              </span>
            )}
            {!canEdit && <span>{t("readonly")}</span>}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("legend.title")}</h2>
            <div className="space-y-2">
              {(Object.keys(TABLE_STATUS_META) as DiningTableStatus[]).map(
                (statusValue) => (
                  <div key={statusValue} className="flex items-center gap-2">
                    <StatusBadge
                      status={TABLE_STATUS_META[statusValue].badge}
                      label={tTab(TABLE_STATUS_LABEL_KEYS[statusValue])}
                      size="sm"
                    />
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {
                        tables.filter(
                          (table) => table.status === statusValue
                        ).length
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("areas.title")}</h2>
            {areas.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t("areas.empty")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {areas.map((area) => {
                  const count = tables.filter(
                    (table) => table.area_id === area.id
                  ).length;
                  return (
                    <li
                      key={area.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: area.color ?? "#4f46e5" }}
                          aria-hidden
                        />
                        <span className="truncate">{area.name}</span>
                      </span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {count} {t("areas.tables")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("properties.title")}</h2>
            {!selected ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t("properties.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{selected.name}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {selected.tableNumber ?? "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("properties.x")} htmlFor="fp-x">
                    <Input
                      id="fp-x"
                      type="number"
                      value={String(selected.x)}
                      disabled={!canEdit}
                      onChange={(e) => updateSelected("x", e.target.value)}
                    />
                  </Field>
                  <Field label={t("properties.y")} htmlFor="fp-y">
                    <Input
                      id="fp-y"
                      type="number"
                      value={String(selected.y)}
                      disabled={!canEdit}
                      onChange={(e) => updateSelected("y", e.target.value)}
                    />
                  </Field>
                  <Field label={t("properties.width")} htmlFor="fp-w">
                    <Input
                      id="fp-w"
                      type="number"
                      value={String(selected.width)}
                      disabled={!canEdit}
                      onChange={(e) => updateSelected("width", e.target.value)}
                    />
                  </Field>
                  <Field label={t("properties.height")} htmlFor="fp-h">
                    <Input
                      id="fp-h"
                      type="number"
                      value={String(selected.height)}
                      disabled={!canEdit}
                      onChange={(e) => updateSelected("height", e.target.value)}
                    />
                  </Field>
                  <Field label={t("properties.rotation")} htmlFor="fp-r">
                    <Input
                      id="fp-r"
                      type="number"
                      value={String(selected.rotation)}
                      disabled={!canEdit}
                      onChange={(e) => updateSelected("rotation", e.target.value)}
                    />
                  </Field>
                  <Field label={t("properties.status")} htmlFor="fp-status">
                    <span className="inline-flex">
                      <StatusBadge
                        status={TABLE_STATUS_META[selected.status].badge}
                        label={tTab(TABLE_STATUS_LABEL_KEYS[selected.status])}
                        size="sm"
                      />
                    </span>
                  </Field>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={t("properties.area")}
                      value={selected.areaId ?? ""}
                      onChange={(e) =>
                        updateSelected("areaId", e.target.value)
                      }
                      className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm"
                    >
                      <option value="">{t("properties.areaNone")}</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!selectedId || !canEdit) return;
                        const table = working.get(selectedId);
                        if (!table) return;
                        patchTable(table.id, {
                          rotation: snapRotation(table.rotation + 15),
                        });
                      }}
                    >
                      {t("properties.rotate")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}