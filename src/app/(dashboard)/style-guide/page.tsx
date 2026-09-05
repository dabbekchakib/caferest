"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Save,
  Search,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createFormatters } from "@/lib/localization";
import { getDirection, type Locale } from "@/i18n/routing";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio } from "@/components/ui/radio";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Field } from "@/components/shared/field";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/stores/use-toast-store";
import { SectionHeader } from "@/components/shared/section-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ConnectionStatus } from "@/components/shared/connection-status";
import { SearchBar } from "@/components/shared/search-bar";
import { formatCurrency } from "@/lib/format";

const colorTokens = [
  { name: "Primary", key: "primary", hex: "var(--color-primary)" },
  { name: "Secondary", key: "secondary", hex: "var(--color-secondary)" },
  { name: "Accent", key: "accent", hex: "var(--color-accent)" },
  { name: "Background", key: "background", hex: "var(--color-background)" },
  { name: "Surface", key: "surface", hex: "var(--color-surface)" },
  { name: "Foreground", key: "foreground", hex: "var(--color-foreground)" },
  { name: "Muted", key: "muted", hex: "var(--color-muted)" },
  { name: "Border", key: "border", hex: "var(--color-border)" },
  { name: "Success", key: "success", hex: "var(--color-success)" },
  { name: "Warning", key: "warning", hex: "var(--color-warning)" },
  { name: "Danger", key: "danger", hex: "var(--color-danger)" },
  { name: "Info", key: "info", hex: "var(--color-info)" },
];

function Swatch({ name, token }: { name: string; token: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-12 shrink-0 rounded-lg border border-[var(--color-border)] shadow-sm"
        style={{ backgroundColor: `var(--color-${token})` as string }}
        aria-hidden
      />
      <div>
        <p className="text-sm font-medium text-[var(--color-foreground)]">
          {name}
        </p>
        <code className="text-xs text-[var(--color-muted-foreground)]">
          --color-{token}
        </code>
      </div>
    </div>
  );
}

export default function StyleGuidePage() {
  const toast = useToast();
  const t = useTranslations("styleGuide");
  const locale = useLocale() as Locale;
  const fmt = useMemo(() => createFormatters({ locale }), [locale]);
  const direction = getDirection(locale);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [radioVal, setRadioVal] = useState("1");
  const [sw1, setSw1] = useState(false);
  const [sw2, setSw2] = useState(true);

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("breadcrumb") }]}
        actions={<ThemeToggle />}
      />

      <div className="mt-6 flex flex-col gap-8">
        {/* Colors */}
        <Section>
          <SectionHeader title={t("colors")} description={t("colorsDesc")} />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {colorTokens.map((c) => (
              <Swatch key={c.key} name={c.name} token={c.key} />
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section>
          <SectionHeader
            title={t("typography")}
            description={t("typographyDesc")}
          />
          <Card className="mt-4">
            <CardContent className="space-y-3">
              <p className="text-4xl font-bold">{t("heading1")}</p>
              <p className="text-3xl font-bold">{t("heading2")}</p>
              <p className="text-2xl font-semibold">{t("heading3")}</p>
              <p className="text-xl font-semibold">{t("heading4")}</p>
              <p className="text-base">{t("body")}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t("secondaryText")}
              </p>
              <p className="text-2xl font-bold tracking-tight text-[var(--color-primary)]">
                {formatCurrency(12480.5)}
              </p>
            </CardContent>
          </Card>
        </Section>

        {/* Buttons */}
        <Section>
          <SectionHeader title={t("buttons")} description={t("buttonsDesc")} />
          <Card className="mt-4">
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button variant="primary">{t("variantPrimary")}</Button>
              <Button variant="secondary">{t("variantSecondary")}</Button>
              <Button variant="accent">{t("variantAccent")}</Button>
              <Button variant="outline">{t("variantOutline")}</Button>
              <Button variant="ghost">{t("variantGhost")}</Button>
              <Button variant="danger">{t("variantDanger")}</Button>
              <Button variant="success">{t("variantSuccess")}</Button>
              <Button disabled>{t("variantDisabled")}</Button>
              <Button loading>{t("loading")}</Button>
              <Button size="sm">{t("sizeSmall")}</Button>
              <Button size="md">{t("sizeMedium")}</Button>
              <Button size="lg">{t("sizeLarge")}</Button>
              <Button size="icon" aria-label={t("icon")}>
                <Search className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </Section>

        {/* Inputs */}
        <Section>
          <SectionHeader title={t("forms")} description={t("formsDesc")} />
          <Card className="mt-4">
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("productName")} htmlFor="f-name" required>
                <Input id="f-name" placeholder="Cappuccino" />
              </Field>
              <Field label={t("price")} htmlFor="f-price">
                <Input id="f-price" type="number" placeholder="5.000" />
              </Field>
              <Field label={t("category")} htmlFor="f-cat">
                <Select id="f-cat" defaultValue="coffee">
                  <option value="coffee">Café</option>
                  <option value="bar">Bar</option>
                  <option value="kitchen">Cuisine</option>
                </Select>
              </Field>
              <Field
                label={t("withError")}
                htmlFor="f-err"
                error={t("nameRequired")}
              >
                <Input id="f-err" defaultValue="" error={t("nameRequired")} />
              </Field>
              <Field label={t("disabled")} htmlFor="f-dis">
                <Input id="f-dis" disabled placeholder={t("notEditable")} />
              </Field>
              <Field label={t("search")}>
                <SearchBar placeholder={t("searchProduct")} />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label={t("description")} htmlFor="f-desc">
                  <Textarea
                    id="f-desc"
                    placeholder={t("descriptionPlaceholder")}
                  />
                </Field>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  <span className="text-[var(--color-foreground)]">
                    {t("enableTva")}
                  </span>
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 text-sm">
                    <Radio
                      name="rg"
                      value="1"
                      checked={radioVal === "1"}
                      onChange={() => setRadioVal("1")}
                    />
                    <span>{t("optionA")}</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm">
                    <Radio
                      name="rg"
                      value="2"
                      checked={radioVal === "2"}
                      onChange={() => setRadioVal("2")}
                    />
                    <span>{t("optionB")}</span>
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">{t("compactMode")}</span>
                  <Switch checked={sw1} onCheckedChange={setSw1} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">{t("notifications")}</span>
                  <Switch checked={sw2} onCheckedChange={setSw2} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* Badges & status */}
        <Section>
          <SectionHeader
            title={t("badgesStatus")}
            description={t("badgesStatusDesc")}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge variant="primary">{t("variantPrimary")}</Badge>
            <Badge variant="secondary">{t("variantSecondary")}</Badge>
            <Badge variant="accent">{t("variantAccent")}</Badge>
            <Badge variant="success">{t("variantSuccess")}</Badge>
            <Badge variant="warning">{t("warningAlertTitle")}</Badge>
            <Badge variant="danger">{t("variantDanger")}</Badge>
            <Badge variant="info">{t("infoAlertTitle")}</Badge>
            <Badge variant="outline">{t("variantOutline")}</Badge>
            <Badge variant="muted">{t("muted")}</Badge>
            <StatusBadge status="success" label={t("statusPaid")} />
            <StatusBadge status="warning" label={t("statusInProgress")} />
            <StatusBadge status="danger" label={t("statusCancelled")} />
          </div>
        </Section>

        {/* Cards */}
        <Section>
          <SectionHeader title={t("cards")} description={t("cardsDesc")} />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t("simpleCard")}</CardTitle>
                <CardDescription>{t("cardDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{t("cardContent")}</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  {t("action")}
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-3">
                  <Avatar fallback="KA" />
                  <div>
                    <p className="text-sm font-semibold">Karim Ahmed</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      karim@caferest.app
                    </p>
                  </div>
                </div>
                <Progress value={70} />
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {t("progressLabel", { value: 70 })}
                </p>
              </CardContent>
            </Card>
            <Card className="flex flex-col">
              <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
                  {t("avatarSizes")}
                </p>
                <div className="flex items-center gap-3">
                  <Avatar size="sm" fallback="A" />
                  <Avatar fallback="AB" />
                  <Avatar size="lg" fallback="ABC" />
                  <Avatar size="xl" fallback="KA" />
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Tabs */}
        <Section>
          <SectionHeader title={t("tabs")} description={t("tabsDesc")} />
          <Card className="mt-4">
            <CardContent>
              <Tabs defaultValue="tab1">
                <TabsList>
                  <TabsTrigger value="tab1">{t("tabOverview")}</TabsTrigger>
                  <TabsTrigger value="tab2">{t("tabDetails")}</TabsTrigger>
                  <TabsTrigger value="tab3">{t("tabHistory")}</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {t("tabOverviewContent")}
                  </p>
                </TabsContent>
                <TabsContent value="tab2">
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {t("tabDetailsContent")}
                  </p>
                </TabsContent>
                <TabsContent value="tab3">
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {t("tabHistoryContent")}
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </Section>

        {/* Alerts */}
        <Section>
          <SectionHeader title={t("alerts")} description={t("alertsDesc")} />
          <div className="mt-4 space-y-3">
            <Alert variant="info" title={t("infoAlertTitle")}>
              {t("infoAlert")}
            </Alert>
            <Alert variant="success" title={t("successAlertTitle")}>
              {t("successAlert")}
            </Alert>
            <Alert variant="warning" title={t("warningAlertTitle")}>
              {t("warningAlert")}
            </Alert>
            <Alert variant="danger" title={t("dangerAlertTitle")}>
              {t("dangerAlert")}
            </Alert>
          </div>
        </Section>

        {/* Loaders & skeletons */}
        <Section>
          <SectionHeader title={t("loaders")} description={t("loadersDesc")} />
          <Card className="mt-4">
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
                <LoadingState label={t("loadingData")} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
              <div className="space-y-2">
                <Progress value={25} />
                <Progress value={50} variant="info" />
                <Progress value={75} variant="success" />
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* Empty & error state */}
        <Section>
          <SectionHeader title={t("states")} description={t("statesDesc")} />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EmptyState
              title={t("emptyProduct")}
              description={t("emptyProductDesc")}
              action={
                <Button size="sm">
                  <PlusIcon /> {t("create")}
                </Button>
              }
            />
            <ErrorState
              title={t("connectionError")}
              description={t("connectionErrorDesc")}
              action={
                <Button size="sm" variant="outline">
                  <RefreshIcon /> {t("retry")}
                </Button>
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ConnectionStatus status="online" />
            <ConnectionStatus status="offline" />
            <ConnectionStatus status="syncing" />
          </div>
        </Section>

        {/* Dropdown & tooltip */}
        <Section>
          <SectionHeader title={t("menus")} description={t("menusDesc")} />
          <Card className="mt-4">
            <CardContent className="flex flex-wrap items-center gap-4">
              <Dropdown>
                <DropdownTrigger className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium">
                  {t("menu")}
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownLabel>{t("actionsLabel")}</DropdownLabel>
                  <DropdownItem
                    onClick={() =>
                      toast.success({
                        title: t("action"),
                        description: t("editToastDesc"),
                      })
                    }
                  >
                    {t("edit")}
                  </DropdownItem>
                  <DropdownItem
                    onClick={() =>
                      toast.info({
                        title: t("action"),
                        description: t("duplicateToastDesc"),
                      })
                    }
                  >
                    {t("duplicate")}
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem
                    onClick={() =>
                      toast.error({
                        title: t("delete"),
                        description: t("deleteToastDesc"),
                      })
                    }
                  >
                    {t("delete")}
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
              <Tooltip content={t("tooltipContent")}>
                <Button variant="outline">{t("hover")}</Button>
              </Tooltip>
            </CardContent>
          </Card>
        </Section>

        {/* Dialogs */}
        <Section>
          <SectionHeader title={t("dialogs")} description={t("dialogsDesc")} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => setDialogOpen(true)}>
              {t("openDialog")}
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              {t("confirmation")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.info({
                  title: t("infoAlertTitle"),
                  description: t("infoToastDesc"),
                })
              }
            >
              {t("toastInfo")}
            </Button>
            <Button
              variant="success"
              onClick={() =>
                toast.success({
                  title: t("savedToastTitle"),
                  description: t("savedToastDesc"),
                })
              }
            >
              {t("toastSuccess")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.warning({
                  title: t("attentionToastTitle"),
                  description: t("warningToastDesc"),
                })
              }
            >
              {t("toastWarning")}
            </Button>
          </div>
        </Section>

        {/* I18n */}
        <Section>
          <SectionHeader
            title={t("i18n.title")}
            description={t("i18n.description")}
            action={
              <Link
                href="/ui-test/i18n"
                className="inline-flex h-9 shrink-0 select-none items-center gap-2 rounded-lg border border-[var(--color-border)] bg-transparent px-3 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              >
                {t("i18n.demo")}
                <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            }
          />
          <Card className="mt-4">
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
                  {t("i18n.date")}
                </h3>
                <p className="font-mono text-lg text-[var(--color-foreground)]">
                  {fmt.formatDateTime(new Date("2026-09-04T15:30:00"))}
                </p>
                <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
                  {t("i18n.number")}
                </h3>
                <p className="font-mono text-lg text-[var(--color-foreground)]">
                  {fmt.formatNumber(1234567.89)}
                </p>
                <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
                  {t("i18n.currency")}
                </h3>
                <p className="font-mono text-lg text-[var(--color-foreground)]">
                  {fmt.formatCurrency(1234.567)}
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
                  {t("i18n.plural")}
                </h3>
                <ul className="space-y-2">
                  <li className="font-mono text-lg text-[var(--color-foreground)]">
                    {t("i18n.items", { count: 0 })}
                  </li>
                  <li className="font-mono text-lg text-[var(--color-foreground)]">
                    {t("i18n.items", { count: 1 })}
                  </li>
                  <li className="font-mono text-lg text-[var(--color-foreground)]">
                    {t("i18n.items", { count: 7 })}
                  </li>
                </ul>
                <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
                  {t("i18n.direction")}
                </h3>
                <Badge variant={direction === "rtl" ? "accent" : "muted"}>
                  {direction === "rtl" ? t("i18n.rtl") : t("i18n.ltr")} —{" "}
                  {locale}
                </Badge>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t("i18n.bidiNotice")}
                </p>
                <div className="flex items-center gap-2 text-[var(--color-muted-foreground)]">
                  <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
                  <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                  <span className="text-xs">
                    {t("i18n.ltr")}/{t("i18n.rtl")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t("newProduct")}
        description={t("newProductDesc")}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                setDialogOpen(false);
                toast.success({
                  title: t("createdToastTitle"),
                  description: t("createdToastDesc"),
                });
              }}
            >
              <Save className="size-4" aria-hidden /> {t("save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("name")} required>
            <Input placeholder={t("productName")} />
          </Field>
          <Field label={t("price")}>
            <Input type="number" placeholder="0.000" />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmDelete")}
        description={t("confirmDeleteDesc")}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                toast.error({
                  title: t("deletedToastTitle"),
                  description: t("deletedToastDesc"),
                });
              }}
            >
              <X className="size-4" aria-hidden /> {t("delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("confirmDeleteText")}
        </p>
      </Dialog>
    </PageContainer>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

function PlusIcon() {
  return (
    <span className="inline-flex size-4 items-center justify-center text-lg leading-none">
      +
    </span>
  );
}

function RefreshIcon() {
  return <span aria-hidden>↻</span>;
}
