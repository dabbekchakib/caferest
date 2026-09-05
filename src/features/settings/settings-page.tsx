"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/shared/field";
import { useToast } from "@/stores/use-toast-store";
import { SettingsNav, type SettingsSectionKey } from "./settings-nav";

interface SettingsState {
  // establishment (general)
  name: string;
  legalName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  taxIdentifier: string;
  receiptHeader: string;
  receiptFooter: string;
  // branding
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  darkMode: string;
  // localization
  defaultLocale: string;
  availableLocales: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
  rtlEnabled: string;
  // currency
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: string;
  decimalPlaces: string;
  thousandSeparator: string;
  decimalSeparator: string;
  // taxes
  defaultTaxRate: string;
  // pos
  posRequireConfirmation: boolean;
  posAllowDiscount: boolean;
  posAllowNegativeStock: boolean;
  // inventory
  inventoryAllowNegativeStock: boolean;
  lowStockThreshold: string;
  // printing
  receiptWidth: string;
  printShowTax: boolean;
  printShowServer: boolean;
  // notifications
  notifStockAlerts: boolean;
  notifNewOrders: boolean;
  notifCashRegister: boolean;
  notifPurchasing: boolean;
}

const DEFAULTS: SettingsState = {
  name: "",
  legalName: "",
  address: "",
  city: "",
  postalCode: "",
  phone: "",
  email: "",
  website: "",
  taxIdentifier: "",
  receiptHeader: "",
  receiptFooter: "",
  primaryColor: "#2563eb",
  secondaryColor: "#7c3aed",
  accentColor: "#f59e0b",
  successColor: "#16a34a",
  warningColor: "#d97706",
  dangerColor: "#dc2626",
  darkMode: "system",
  defaultLocale: "fr",
  availableLocales: '["fr","en","ar"]',
  timezone: "Africa/Tunis",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "HH:mm",
  firstDayOfWeek: "1",
  rtlEnabled: "auto",
  currencyCode: "TND",
  currencySymbol: "TND",
  currencyPosition: "after",
  decimalPlaces: "3",
  thousandSeparator: ",",
  decimalSeparator: ".",
  defaultTaxRate: "7",
  posRequireConfirmation: true,
  posAllowDiscount: true,
  posAllowNegativeStock: false,
  inventoryAllowNegativeStock: false,
  lowStockThreshold: "5",
  receiptWidth: "80",
  printShowTax: true,
  printShowServer: true,
  notifStockAlerts: true,
  notifNewOrders: true,
  notifCashRegister: true,
  notifPurchasing: true,
};

interface SettingsPageProps {
  initial?: Partial<SettingsState>;
  establishmentName?: string;
  connected: boolean;
}

export function SettingsPage({
  initial,
  establishmentName,
  connected,
}: SettingsPageProps) {
  const [active, setActive] = useState<SettingsSectionKey>("general");
  const [values, setValues] = useState<SettingsState>({
    ...DEFAULTS,
    ...initial,
  });
  const toast = useToast();
  const t = useTranslations("settings");

  const set = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!connected) {
      toast.warning({
        title: t("requiresConnection"),
        description: t("requiresConnectionDesc"),
      });
      return;
    }
    toast.success({ title: t("saved"), description: t("savedDesc") });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("breadcrumb") }]}
        actions={<Button onClick={handleSave}>{t("saveChanges")}</Button>}
      />

      {!connected && (
        <Alert variant="warning" title={t("demoTitle")}>
          {t("demoDesc")}
        </Alert>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <SettingsNav active={active} onSelect={setActive} />
        </aside>
        <div className="min-w-0 flex-1">
          {active === "general" && (
            <GeneralSection
              v={values}
              set={set}
              establishmentName={establishmentName}
              onSave={handleSave}
            />
          )}
          {active === "branding" && (
            <BrandingSection
              v={values}
              set={set}
              onSave={handleSave}
              connected={connected}
            />
          )}
          {active === "localization" && (
            <LocalizationSection v={values} set={set} onSave={handleSave} />
          )}
          {active === "currency" && (
            <CurrencySection v={values} set={set} onSave={handleSave} />
          )}
          {active === "taxes" && (
            <TaxesSection v={values} set={set} onSave={handleSave} />
          )}
          {active === "pos" && (
            <PosSection v={values} set={set} onSave={handleSave} />
          )}
          {active === "inventory" && (
            <InventorySection v={values} set={set} onSave={handleSave} />
          )}
          {active === "printing" && (
            <PrintingSection v={values} set={set} onSave={handleSave} />
          )}
          {active === "notifications" && (
            <NotificationsSection v={values} set={set} onSave={handleSave} />
          )}
        </div>
      </div>
    </div>
  );
}

type SetFn = <K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K]
) => void;

interface SectionProps {
  v: SettingsState;
  set: SetFn;
  onSave: () => void;
  connected?: boolean;
  establishmentName?: string;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function SectionFooter({ onSave }: { onSave: () => void }) {
  const t = useTranslations("settings");
  return (
    <div className="flex justify-end">
      <Button onClick={onSave}>{t("genericSave")}</Button>
    </div>
  );
}

function GeneralSection({ v, set, establishmentName, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const g = t.raw("general") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={g.title} description={g.titleDesc}>
        <Field label={g.establishmentName} required>
          <Input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={establishmentName || g.myCafe}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={g.legalName}>
            <Input
              value={v.legalName}
              onChange={(e) => set("legalName", e.target.value)}
            />
          </Field>
          <Field label={g.registrationNumber}>
            <Input
              value={v.taxIdentifier}
              onChange={(e) => set("taxIdentifier", e.target.value)}
            />
          </Field>
          <Field label={g.phone}>
            <Input
              value={v.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label={g.email}>
            <Input
              type="email"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label={g.website}>
            <Input
              value={v.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </Field>
          <Field label={g.taxNumber}>
            <Input
              value={v.taxIdentifier}
              onChange={(e) => set("taxIdentifier", e.target.value)}
            />
          </Field>
        </div>
        <Field label={g.address}>
          <Input
            value={v.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={g.city}>
            <Input
              value={v.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
          <Field label={g.postalCode}>
            <Input
              value={v.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </Field>
          <Field label={g.country}>
            <Input defaultValue={g.tunisia} disabled />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={g.receiptHeaderFooter}
        description={g.receiptHeaderFooterDesc}
      >
        <Field label={g.receiptHeader} helpText={g.headerHelp}>
          <Textarea
            value={v.receiptHeader}
            onChange={(e) => set("receiptHeader", e.target.value)}
            rows={3}
          />
        </Field>
        <Field label={g.receiptFooter}>
          <Textarea
            value={v.receiptFooter}
            onChange={(e) => set("receiptFooter", e.target.value)}
            rows={3}
          />
        </Field>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <span
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)]"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-16 cursor-pointer p-1"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
      </div>
    </Field>
  );
}

function BrandingSection({ v, set, onSave, connected }: SectionProps) {
  const t = useTranslations("settings");
  const b = t.raw("branding") as Record<string, string>;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{b.title}</CardTitle>
          <CardDescription>{b.titleDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={b.logo} description={b.storageUrl}>
              <Input
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="branding/logo/..."
              />
            </Field>
            <Field label={b.favicon} description={b.storageUrl}>
              <Input
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="branding/favicon/..."
              />
            </Field>
          </div>
          {!connected && (
            <Alert variant="info" title={b.upload}>
              {b.uploadDesc}
            </Alert>
          )}
        </CardContent>
      </Card>

      <SectionCard title={b.colors} description={b.colorsDesc}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label={b.primary}
            value={v.primaryColor}
            onChange={(c) => set("primaryColor", c)}
          />
          <ColorField
            label={b.secondary}
            value={v.secondaryColor}
            onChange={(c) => set("secondaryColor", c)}
          />
          <ColorField
            label={b.accent}
            value={v.accentColor}
            onChange={(c) => set("accentColor", c)}
          />
          <ColorField
            label={b.success}
            value={v.successColor}
            onChange={(c) => set("successColor", c)}
          />
          <ColorField
            label={b.warning}
            value={v.warningColor}
            onChange={(c) => set("warningColor", c)}
          />
          <ColorField
            label={b.danger}
            value={v.dangerColor}
            onChange={(c) => set("dangerColor", c)}
          />
        </div>
        <Field label={b.darkMode}>
          <Select
            value={v.darkMode}
            onChange={(e) => set("darkMode", e.target.value)}
          >
            <option value="light">{b.light}</option>
            <option value="dark">{b.dark}</option>
            <option value="system">{b.system}</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{b.preview}</Badge>
          <span
            className="inline-flex size-6 rounded-full"
            style={{ backgroundColor: v.primaryColor }}
            aria-hidden
          />
          <span
            className="inline-flex size-6 rounded-full"
            style={{ backgroundColor: v.secondaryColor }}
            aria-hidden
          />
          <span
            className="inline-flex size-6 rounded-full"
            style={{ backgroundColor: v.accentColor }}
            aria-hidden
          />
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function LocalizationSection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const l = t.raw("localization") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={l.language} description={l.languageDesc}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={l.defaultLocale} helpText={l.rtlHelp}>
            <Select
              value={v.defaultLocale}
              onChange={(e) => set("defaultLocale", e.target.value)}
            >
              <option value="fr">{l.francais}</option>
              <option value="en">{l.english}</option>
              <option value="ar">{l.arabic}</option>
            </Select>
          </Field>
          <Field label={l.rtl}>
            <Select
              value={v.rtlEnabled}
              onChange={(e) => set("rtlEnabled", e.target.value)}
            >
              <option value="auto">{l.auto}</option>
              <option value="true">{l.enabled}</option>
              <option value="false">{l.disabled}</option>
            </Select>
          </Field>
        </div>
        <Field label={l.availableLocales} description={l.localesDesc}>
          <Input
            value={v.availableLocales}
            onChange={(e) => set("availableLocales", e.target.value)}
          />
        </Field>
      </SectionCard>

      <SectionCard title={l.region} description={l.regionDesc}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={l.timezone}>
            <Select
              value={v.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            >
              <option value="Africa/Tunis">UTC+1 — Tunis</option>
              <option value="Africa/Casablanca">UTC+0 — Casablanca</option>
              <option value="UTC">UTC</option>
              <option value="Europe/Paris">UTC+1/+2 — Paris</option>
            </Select>
          </Field>
          <Field label={l.firstDayOfWeek}>
            <Select
              value={v.firstDayOfWeek}
              onChange={(e) => set("firstDayOfWeek", e.target.value)}
            >
              <option value="1">{l.monday}</option>
              <option value="6">{l.saturday}</option>
              <option value="0">{l.sunday}</option>
            </Select>
          </Field>
          <Field label={l.dateFormat}>
            <Input
              value={v.dateFormat}
              onChange={(e) => set("dateFormat", e.target.value)}
            />
          </Field>
          <Field label={l.timeFormat}>
            <Input
              value={v.timeFormat}
              onChange={(e) => set("timeFormat", e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function CurrencySection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const c = t.raw("currency") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={c.currency} description={c.currencyDesc}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.code}>
            <Input
              value={v.currencyCode}
              onChange={(e) => set("currencyCode", e.target.value)}
              placeholder="TND"
            />
          </Field>
          <Field label={c.symbol}>
            <Input
              value={v.currencySymbol}
              onChange={(e) => set("currencySymbol", e.target.value)}
              placeholder="د.ت"
            />
          </Field>
          <Field label={c.position}>
            <Select
              value={v.currencyPosition}
              onChange={(e) => set("currencyPosition", e.target.value)}
            >
              <option value="before">{c.before}</option>
              <option value="after">{c.after}</option>
            </Select>
          </Field>
          <Field label={c.decimalPlaces}>
            <Input
              type="number"
              min={0}
              max={4}
              value={v.decimalPlaces}
              onChange={(e) => set("decimalPlaces", e.target.value)}
            />
          </Field>
          <Field label={c.thousandSeparator}>
            <Input
              value={v.thousandSeparator}
              onChange={(e) => set("thousandSeparator", e.target.value)}
            />
          </Field>
          <Field label={c.decimalSeparator}>
            <Input
              value={v.decimalSeparator}
              onChange={(e) => set("decimalSeparator", e.target.value)}
            />
          </Field>
        </div>
        <Alert variant="info" title={c.preview}>
          1 234,567 {v.currencyCode || "TND"}
        </Alert>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function TaxesSection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const x = t.raw("taxes") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={x.taxes} description={x.taxesDesc}>
        <Field label={x.defaultRate}>
          <Input
            type="number"
            min={0}
            value={v.defaultTaxRate}
            onChange={(e) => set("defaultTaxRate", e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {v.defaultTaxRate || 0}% {x.default}
          </Badge>
          <Badge variant="outline">{x.zero}</Badge>
          <Badge variant="outline">{x.seven}</Badge>
          <Badge variant="outline">{x.thirteen}</Badge>
          <Badge variant="outline">{x.nineteen}</Badge>
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-[var(--color-foreground)]">
          {title}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}

function PosSection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const p = t.raw("pos") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={p.title} description={p.titleDesc}>
        <div className="space-y-3">
          <ToggleRow
            title={p.requireConfirmation}
            description={p.requireConfirmationDesc}
            checked={v.posRequireConfirmation}
            onCheckedChange={(c) => set("posRequireConfirmation", c)}
          />
          <ToggleRow
            title={p.allowDiscount}
            description={p.allowDiscountDesc}
            checked={v.posAllowDiscount}
            onCheckedChange={(c) => set("posAllowDiscount", c)}
          />
          <ToggleRow
            title={p.allowNegativeStock}
            description={p.allowNegativeStockDesc}
            checked={v.posAllowNegativeStock}
            onCheckedChange={(c) => set("posAllowNegativeStock", c)}
          />
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function InventorySection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const i = t.raw("inventory") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={i.title} description={i.titleDesc}>
        <div className="space-y-3">
          <ToggleRow
            title={i.allowNegativeStock}
            description={i.allowNegativeStockDesc}
            checked={v.inventoryAllowNegativeStock}
            onCheckedChange={(c) => set("inventoryAllowNegativeStock", c)}
          />
        </div>
        <Field label={i.lowStockThreshold} helpText={i.thresholdHelp}>
          <Input
            type="number"
            min={0}
            value={v.lowStockThreshold}
            onChange={(e) => set("lowStockThreshold", e.target.value)}
          />
        </Field>
        <Field label={i.valuationMethod}>
          <Select defaultValue="average" disabled>
            <option value="average">{i.averageCost}</option>
            <option value="fifo">{i.fifo}</option>
          </Select>
        </Field>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function PrintingSection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const pr = t.raw("printing") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={pr.title} description={pr.titleDesc}>
        <Field label={pr.receiptWidth}>
          <Input
            type="number"
            min={50}
            max={120}
            value={v.receiptWidth}
            onChange={(e) => set("receiptWidth", e.target.value)}
          />
        </Field>
        <div className="space-y-3">
          <ToggleRow
            title={pr.showTax}
            description={pr.showTaxDesc}
            checked={v.printShowTax}
            onCheckedChange={(c) => set("printShowTax", c)}
          />
          <ToggleRow
            title={pr.showServer}
            description={pr.showServerDesc}
            checked={v.printShowServer}
            onCheckedChange={(c) => set("printShowServer", c)}
          />
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function NotificationsSection({ v, set, onSave }: SectionProps) {
  const t = useTranslations("settings");
  const n = t.raw("notifications") as Record<string, string>;
  return (
    <div className="space-y-5">
      <SectionCard title={n.title} description={n.titleDesc}>
        <div className="space-y-3">
          <ToggleRow
            title={n.stockAlerts}
            description={n.stockAlertsDesc}
            checked={v.notifStockAlerts}
            onCheckedChange={(c) => set("notifStockAlerts", c)}
          />
          <ToggleRow
            title={n.newOrders}
            description={n.newOrdersDesc}
            checked={v.notifNewOrders}
            onCheckedChange={(c) => set("notifNewOrders", c)}
          />
          <ToggleRow
            title={n.cashRegister}
            description={n.cashRegisterDesc}
            checked={v.notifCashRegister}
            onCheckedChange={(c) => set("notifCashRegister", c)}
          />
          <ToggleRow
            title={n.purchasing}
            description={n.purchasingDesc}
            checked={v.notifPurchasing}
            onCheckedChange={(c) => set("notifPurchasing", c)}
          />
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

export const SETTINGS_DEFAULTS = DEFAULTS;
