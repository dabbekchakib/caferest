"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  getStocktakeLocationsAction,
  nextStocktakeNumberAction,
  createStocktakeAction,
  type StocktakeLocationLite,
} from "@/features/stocktakes/actions";
import type { StocktakeMode } from "@/lib/stocktakes/types";

export function StocktakeCreateForm() {
  const tf = useTranslations("stocktakeForm");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tActions = useTranslations("stocktakeActions");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<StocktakeLocationLite[]>([]);
  const [numberPreview, setNumberPreview] = useState<string | null>(null);

  const [locationId, setLocationId] = useState("");
  const [mode, setMode] = useState<StocktakeMode>("standard");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [locationData, numberData] = await Promise.all([
          getStocktakeLocationsAction(),
          nextStocktakeNumberAction(),
        ]);
        if (cancelled) return;
        setLocations(locationData);
        setNumberPreview(numberData || null);
        if (locationData.length > 0) setLocationId(locationData[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!locationId) {
      setErrors((prev) => ({ ...prev, locationId: tf("locationRequired") }));
      return;
    }

    setBusy(true);
    const resultAction = await createStocktakeAction({
      inventoryLocationId: locationId,
      mode,
      notes: notes || null,
    });
    setBusy(false);

    if (resultAction.ok) {
      toast.success({ title: tActions("created") });
      router.push(`/stocktakes/${resultAction.data.id}`);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(
          resultAction.key ?? "authorization.errors.generic"
        ),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={tf("title")}
        breadcrumbs={[
          { label: tn("stockCounts"), href: "/stocktakes" },
          { label: tf("title") },
        ]}
        actions={
          <Link href="/stocktakes">
            <Button variant="ghost">{tc("common.cancel")}</Button>
          </Link>
        }
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          <div className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-[var(--color-muted-foreground)]">
                  {tf("numberPreview")}
                </span>
                <span className="font-medium">
                  {loading ? "—" : (numberPreview ?? "—")}
                </span>
              </div>
            </div>

            <Field
              label={tf("location")}
              htmlFor="stocktake-location"
              required
              error={errors.locationId}
            >
              <Select
                id="stocktake-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={loading || locations.length === 0}
              >
                {locations.length === 0 ? (
                  <option value="">{tf("noLocations")}</option>
                ) : (
                  locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                      {location.code ? ` (${location.code})` : ""}
                    </option>
                  ))
                )}
              </Select>
            </Field>

            <Field label={tf("mode")} htmlFor="stocktake-mode">
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-lg border p-4 text-sm ${
                    mode === "standard"
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                      : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="standard"
                    checked={mode === "standard"}
                    onChange={() => setMode("standard")}
                    className="sr-only"
                  />
                  <span className="block font-medium">{tf("modeStandard")}</span>
                  <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                    {tf("modeStandardHelp")}
                  </span>
                </label>
                <label
                  className={`cursor-pointer rounded-lg border p-4 text-sm ${
                    mode === "blind"
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                      : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="blind"
                    checked={mode === "blind"}
                    onChange={() => setMode("blind")}
                    className="sr-only"
                  />
                  <span className="block font-medium">{tf("modeBlind")}</span>
                  <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                    {tf("modeBlindHelp")}
                  </span>
                </label>
              </div>
            </Field>

            <Field label={tf("notes")} htmlFor="stocktake-notes">
              <Textarea
                id="stocktake-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={tf("notesPlaceholder")}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/stocktakes">
            <Button type="button" variant="outline">
              {tc("common.cancel")}
            </Button>
          </Link>
          <Button type="submit" loading={busy} disabled={loading || locations.length === 0}>
            {tf("submitCreate")}
          </Button>
        </div>
      </div>
    </form>
  );
}