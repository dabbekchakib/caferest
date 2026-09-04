"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SettingsPage({ initial, establishmentName, connected }: SettingsPageProps) {
  const [active, setActive] = useState<SettingsSectionKey>("general");
  const [values, setValues] = useState<SettingsState>({ ...DEFAULTS, ...initial });
  const toast = useToast();

  const set = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    // Phase 03 wires persistence when Supabase is configured. Until then we
    // persist nothing (no-op) and keep the state in memory.
    if (!connected) {
      toast.warning({
        title: "Connexion Supabase requise",
        description: "Les modifications ne peuvent pas encore être enregistrées.",
      });
      return;
    }
    toast.success({ title: "Paramètres enregistrés", description: "Configuration mise à jour." });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuration"
        description="Gérez l'établissement, le branding, la monnaie, les taxes et les modules."
        breadcrumbs={[{ label: "Configuration" }]}
        actions={
          <Button onClick={handleSave}>
            Enregistrer les modifications
          </Button>
        }
      />

      {!connected && (
        <Alert variant="warning" title="Mode démonstration">
          Supabase n'est pas encore configuré (clés manquantes). L'interface
          s'affiche avec des valeurs par défaut et l'enregistrement est désactivé.
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
            <BrandingSection v={values} set={set} onSave={handleSave} connected={connected} />
          )}
          {active === "localization" && (
            <LocalizationSection v={values} set={set} onSave={handleSave} />
          )}
          {active === "currency" && (
            <CurrencySection v={values} set={set} onSave={handleSave} />
          )}
          {active === "taxes" && <TaxesSection v={values} set={set} onSave={handleSave} />}
          {active === "pos" && <PosSection v={values} set={set} onSave={handleSave} />}
          {active === "inventory" && (
            <InventorySection v={values} set={set} onSave={handleSave} />
          )}
          {active === "printing" && <PrintingSection v={values} set={set} onSave={handleSave} />}
          {active === "notifications" && (
            <NotificationsSection v={values} set={set} onSave={handleSave} />
          )}
        </div>
      </div>
    </div>
  );
}

type SetFn = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;

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
  return (
    <div className="flex justify-end">
      <Button onClick={onSave}>Enregistrer</Button>
    </div>
  );
}

function GeneralSection({ v, set, establishmentName, onSave }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Informations générales"
        description="Les coordonnées et identifiants de l'établissement."
      >
        <Field label="Nom de l'établissement" required>
          <Input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={establishmentName || "Mon Café"}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale">
            <Input value={v.legalName} onChange={(e) => set("legalName", e.target.value)} />
          </Field>
          <Field label="N° d'enregistrement">
            <Input value={v.taxIdentifier} onChange={(e) => set("taxIdentifier", e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Site web">
            <Input value={v.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="N° fiscal">
            <Input value={v.taxIdentifier} onChange={(e) => set("taxIdentifier", e.target.value)} />
          </Field>
        </div>
        <Field label="Adresse">
          <Input value={v.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ville">
            <Input value={v.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Code postal">
            <Input value={v.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </Field>
          <Field label="Pays">
            <Input defaultValue="Tunisie" disabled />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="En-tête et pied de reçu"
        description="Texte affiché en haut et en bas des tickets."
      >
        <Field label="En-tête du reçu" helpText="Ex. adresse, téléphone, horaires.">
          <Textarea
            value={v.receiptHeader}
            onChange={(e) => set("receiptHeader", e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Pied du reçu">
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
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );
}

function BrandingSection({ v, set, onSave, connected }: SectionProps) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Identité visuelle</CardTitle>
          <CardDescription>
            Le logo et le favicon sont stockés dans Supabase Storage. Collez ou uploadez vos images.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logo" description="URL publique (Supabase Storage)">
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="branding/logo/..." />
            </Field>
            <Field label="Favicon" description="URL publique (Supabase Storage)">
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="branding/favicon/..." />
            </Field>
          </div>
          {!connected && (
            <Alert variant="info" title="Téléversement">
              L'upload vers Supabase Storage sera disponible une fois Supabase configuré.
            </Alert>
          )}
        </CardContent>
      </Card>

      <SectionCard title="Couleurs" description="Appliquées dynamiquement au design system.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Couleur primaire" value={v.primaryColor} onChange={(c) => set("primaryColor", c)} />
          <ColorField label="Couleur secondaire" value={v.secondaryColor} onChange={(c) => set("secondaryColor", c)} />
          <ColorField label="Couleur d'accent" value={v.accentColor} onChange={(c) => set("accentColor", c)} />
          <ColorField label="Succès" value={v.successColor} onChange={(c) => set("successColor", c)} />
          <ColorField label="Avertissement" value={v.warningColor} onChange={(c) => set("warningColor", c)} />
          <ColorField label="Danger" value={v.dangerColor} onChange={(c) => set("dangerColor", c)} />
        </div>
        <Field label="Mode sombre">
          <Select value={v.darkMode} onChange={(e) => set("darkMode", e.target.value)}>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
            <option value="system">Suivre le système</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Aperçu</Badge>
          <span className="inline-flex size-6 rounded-full" style={{ backgroundColor: v.primaryColor }} aria-hidden />
          <span className="inline-flex size-6 rounded-full" style={{ backgroundColor: v.secondaryColor }} aria-hidden />
          <span className="inline-flex size-6 rounded-full" style={{ backgroundColor: v.accentColor }} aria-hidden />
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function LocalizationSection({ v, set, onSave }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard title="Langue" description="Langue par défaut et langues disponibles.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Langue par défaut" helpText="Le RTL est activé automatiquement pour l'arabe.">
            <Select value={v.defaultLocale} onChange={(e) => set("defaultLocale", e.target.value)}>
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
          </Field>
          <Field label="RTL">
            <Select value={v.rtlEnabled} onChange={(e) => set("rtlEnabled", e.target.value)}>
              <option value="auto">Automatique</option>
              <option value="true">Activé</option>
              <option value="false">Désactivé</option>
            </Select>
          </Field>
        </div>
        <Field label="Langues disponibles" description="Séparées par des virgules.">
          <Input value={v.availableLocales} onChange={(e) => set("availableLocales", e.target.value)} />
        </Field>
      </SectionCard>

      <SectionCard title="Région" description="Fuseau horaire et formats.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fuseau horaire">
            <Select value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>
              <option value="Africa/Tunis">UTC+1 — Tunis</option>
              <option value="Africa/Casablanca">UTC+0 — Casablanca</option>
              <option value="UTC">UTC</option>
              <option value="Europe/Paris">UTC+1/+2 — Paris</option>
            </Select>
          </Field>
          <Field label="Premier jour de la semaine">
            <Select value={v.firstDayOfWeek} onChange={(e) => set("firstDayOfWeek", e.target.value)}>
              <option value="1">Lundi</option>
              <option value="6">Samedi</option>
              <option value="0">Dimanche</option>
            </Select>
          </Field>
          <Field label="Format de date">
            <Input value={v.dateFormat} onChange={(e) => set("dateFormat", e.target.value)} />
          </Field>
          <Field label="Format de l'heure">
            <Input value={v.timeFormat} onChange={(e) => set("timeFormat", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function CurrencySection({ v, set, onSave }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard title="Devise" description="Configuration de la monnaie utilisée dans l'application.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code devise">
            <Input value={v.currencyCode} onChange={(e) => set("currencyCode", e.target.value)} placeholder="TND" />
          </Field>
          <Field label="Symbole">
            <Input value={v.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} placeholder="د.ت" />
          </Field>
          <Field label="Position du symbole">
            <Select value={v.currencyPosition} onChange={(e) => set("currencyPosition", e.target.value)}>
              <option value="before">Avant le montant</option>
              <option value="after">Après le montant</option>
            </Select>
          </Field>
          <Field label="Nombre de décimales">
            <Input
              type="number"
              min={0}
              max={4}
              value={v.decimalPlaces}
              onChange={(e) => set("decimalPlaces", e.target.value)}
            />
          </Field>
          <Field label="Séparateur de milliers">
            <Input value={v.thousandSeparator} onChange={(e) => set("thousandSeparator", e.target.value)} />
          </Field>
          <Field label="Séparateur décimal">
            <Input value={v.decimalSeparator} onChange={(e) => set("decimalSeparator", e.target.value)} />
          </Field>
        </div>
        <Alert variant="info" title="Aperçu">
          1 234,567 {v.currencyCode || "TND"}
        </Alert>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function TaxesSection({ v, set, onSave }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Taxes / TVA"
        description="Le taux par défaut est utilisé pour les nouveaux produits. Plusieurs taux sont gérés en base (0%, 7%, 13%, 19%)."
      >
        <Field label="Taux de TVA par défaut (%)">
          <Input type="number" min={0} value={v.defaultTaxRate} onChange={(e) => set("defaultTaxRate", e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{v.defaultTaxRate || 0}% par défaut</Badge>
          <Badge variant="outline">TVA 0%</Badge>
          <Badge variant="outline">TVA 7%</Badge>
          <Badge variant="outline">TVA 13%</Badge>
          <Badge variant="outline">TVA 19%</Badge>
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
        <p className="text-sm font-medium text-[var(--color-foreground)]">{title}</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function PosSection({ v, set, onSave }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard title="Comportement du POS" description="Options du module point de vente.">
        <div className="space-y-3">
          <ToggleRow
            title="Exiger la confirmation de commande"
            description="Demander une confirmation avant d'envoyer la commande en cuisine."
            checked={v.posRequireConfirmation}
            onCheckedChange={(c) => set("posRequireConfirmation", c)}
          />
          <ToggleRow
            title="Autoriser les remises"
            description="Permettre d'appliquer des remises sur la commande."
            checked={v.posAllowDiscount}
            onCheckedChange={(c) => set("posAllowDiscount", c)}
          />
          <ToggleRow
            title="Autoriser le stock négatif"
            description="Permettre de vendre un produit en rupture de stock."
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
  return (
    <div className="space-y-5">
      <SectionCard title="Règles de stock" description="Gestion des niveaux et alertes.">
        <div className="space-y-3">
          <ToggleRow
            title="Autoriser le stock négatif"
            description="Autoriser les mouvements qui font passer le stock sous zéro."
            checked={v.inventoryAllowNegativeStock}
            onCheckedChange={(c) => set("inventoryAllowNegativeStock", c)}
          />
        </div>
        <Field label="Seuil d'alerte de stock bas" helpText="Alerte lorsque le stock descend sous ce seuil.">
          <Input type="number" min={0} value={v.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} />
        </Field>
        <Field label="Méthode de valorisation">
          <Select defaultValue="average" disabled>
            <option value="average">Coût moyen pondéré</option>
            <option value="fifo">PEPS (FIFO)</option>
          </Select>
        </Field>
      </SectionCard>

      <SectionFooter onSave={onSave} />
    </div>
  );
}

function PrintingSection({ v, set, onSave }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard title="Impression des tickets" description="Réglages des tickets de caisse.">
        <Field label="Largeur du reçu (mm)">
          <Input type="number" min={50} max={120} value={v.receiptWidth} onChange={(e) => set("receiptWidth", e.target.value)} />
        </Field>
        <div className="space-y-3">
          <ToggleRow
            title="Afficher la TVA"
            description="Afficher le détail des taxes sur le ticket."
            checked={v.printShowTax}
            onCheckedChange={(c) => set("printShowTax", c)}
          />
          <ToggleRow
            title="Afficher le serveur"
            description="Afficher le nom du serveur sur le ticket."
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
  return (
    <div className="space-y-5">
      <SectionCard title="Notifications" description="Choisissez les événements à notifier.">
        <div className="space-y-3">
          <ToggleRow
            title="Alertes de stock"
            description="Notifier lorsque le stock est faible."
            checked={v.notifStockAlerts}
            onCheckedChange={(c) => set("notifStockAlerts", c)}
          />
          <ToggleRow
            title="Nouvelles commandes"
            description="Notifier les nouvelles commandes entrantes."
            checked={v.notifNewOrders}
            onCheckedChange={(c) => set("notifNewOrders", c)}
          />
          <ToggleRow
            title="Caisse"
            description="Notifier l'ouverture/fermeture de caisse."
            checked={v.notifCashRegister}
            onCheckedChange={(c) => set("notifCashRegister", c)}
          />
          <ToggleRow
            title="Achats"
            description="Notifier les réceptions et commandes d'achat."
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
