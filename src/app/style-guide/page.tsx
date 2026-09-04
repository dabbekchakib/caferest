"use client";

import { useState } from "react";
import { Save, Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
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
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
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
        <p className="text-sm font-medium text-[var(--color-foreground)]">{name}</p>
        <code className="text-xs text-[var(--color-muted-foreground)]">--color-{token}</code>
      </div>
    </div>
  );
}

export default function StyleGuidePage() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [radioVal, setRadioVal] = useState("1");
  const [sw1, setSw1] = useState(false);
  const [sw2, setSw2] = useState(true);

  return (
    <AppShell title="Style Guide">
      <PageContainer maxWidth="full">
        <PageHeader
          title="Style Guide"
          description="Référence visuelle du Design System CaféRest"
          breadcrumbs={[{ label: "Style Guide" }]}
          actions={<ThemeToggle />}
        />

        <div className="mt-6 flex flex-col gap-8">
          {/* Colors */}
          <Section>
            <SectionHeader title="Couleurs" description="Design tokens configurables pour light et dark mode." />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {colorTokens.map((c) => (
                <Swatch key={c.key} name={c.name} token={c.key} />
              ))}
            </div>
          </Section>

          {/* Typography */}
          <Section>
            <SectionHeader title="Typographie" description="Hiérarchie typographique." />
            <Card className="mt-4">
              <CardContent className="space-y-3">
                <p className="text-4xl font-bold">Heading 1 — CaféRest</p>
                <p className="text-3xl font-bold">Heading 2</p>
                <p className="text-2xl font-semibold">Heading 3</p>
                <p className="text-xl font-semibold">Heading 4</p>
                <p className="text-base">Body text — Le texte standard pour le contenu.</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">Texte secondaire — utilisé pour les descriptions.</p>
                <p className="text-2xl font-bold tracking-tight text-[var(--color-primary)]">{formatCurrency(12480.5)}</p>
              </CardContent>
            </Card>
          </Section>

          {/* Buttons */}
          <Section>
            <SectionHeader title="Boutons" description="Variantes, tailles et états." />
            <Card className="mt-4">
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="accent">Accent</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="success">Success</Button>
                <Button disabled>Disabled</Button>
                <Button loading>Chargement</Button>
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Icône"><Search className="size-4" /></Button>
              </CardContent>
            </Card>
          </Section>

          {/* Inputs */}
          <Section>
            <SectionHeader title="Formulaires" description="Inputs, selects, textareas et états." />
            <Card className="mt-4">
              <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nom du produit" htmlFor="f-name" required>
                  <Input id="f-name" placeholder="Cappuccino" />
                </Field>
                <Field label="Prix" htmlFor="f-price">
                  <Input id="f-price" type="number" placeholder="5.000" />
                </Field>
                <Field label="Catégorie" htmlFor="f-cat">
                  <Select id="f-cat" defaultValue="coffee">
                    <option value="coffee">Café</option>
                    <option value="bar">Bar</option>
                    <option value="kitchen">Cuisine</option>
                  </Select>
                </Field>
                <Field label="Avec erreur" htmlFor="f-err" error="Le nom est obligatoire.">
                  <Input id="f-err" defaultValue="" error="Le nom est obligatoire." />
                </Field>
                <Field label="Désactivé" htmlFor="f-dis">
                  <Input id="f-dis" disabled placeholder="Non modifiable" />
                </Field>
                <Field label="Recherche">
                  <SearchBar placeholder="Rechercher un produit..." />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Description" htmlFor="f-desc">
                    <Textarea id="f-desc" placeholder="Description du produit..." />
                  </Field>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span className="text-[var(--color-foreground)]">Activer la TVA</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2.5 text-sm">
                      <Radio name="rg" value="1" checked={radioVal === "1"} onChange={() => setRadioVal("1")} />
                      <span>Option A</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-sm">
                      <Radio name="rg" value="2" checked={radioVal === "2"} onChange={() => setRadioVal("2")} />
                      <span>Option B</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm">Mode réduit</span>
                    <Switch checked={sw1} onCheckedChange={setSw1} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm">Notifications</span>
                    <Switch checked={sw2} onCheckedChange={setSw2} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Section>

          {/* Badges & status */}
          <Section>
            <SectionHeader title="Badges & statuts" description="Indicateurs visuels." />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant="primary">Primary</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="muted">Muted</Badge>
              <StatusBadge status="success" label="Payée" />
              <StatusBadge status="warning" label="En cours" />
              <StatusBadge status="danger" label="Annulée" />
            </div>
          </Section>

          {/* Cards */}
          <Section>
            <SectionHeader title="Cards" description="Conteneurs de contenu." />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Carte simple</CardTitle>
                  <CardDescription>Description de la carte.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">Contenu de la carte avec un texte d'exemple pour illustrer le composant.</p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm">Action</Button>
                </CardFooter>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-3">
                    <Avatar fallback="KA" />
                    <div>
                      <p className="text-sm font-semibold">Karim Ahmed</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">karim@caferest.app</p>
                    </div>
                  </div>
                  <Progress value={70} />
                  <p className="text-xs text-[var(--color-muted-foreground)]">Progression: 70%</p>
                </CardContent>
              </Card>
              <Card className="flex flex-col">
                <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
                  <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Avatar sizes</p>
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
            <SectionHeader title="Tabs" description="Navigation par onglets." />
            <Card className="mt-4">
              <CardContent>
                <Tabs defaultValue="tab1">
                  <TabsList>
                    <TabsTrigger value="tab1">Aperçu</TabsTrigger>
                    <TabsTrigger value="tab2">Détails</TabsTrigger>
                    <TabsTrigger value="tab3">Historique</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1">
                    <p className="text-sm text-[var(--color-muted-foreground)]">Contenu du premier onglet (aperçu).</p>
                  </TabsContent>
                  <TabsContent value="tab2">
                    <p className="text-sm text-[var(--color-muted-foreground)]">Contenu du deuxième onglet (détails).</p>
                  </TabsContent>
                  <TabsContent value="tab3">
                    <p className="text-sm text-[var(--color-muted-foreground)]">Contenu du troisième onglet (historique).</p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </Section>

          {/* Alerts */}
          <Section>
            <SectionHeader title="Alertes" description="Messages informatifs." />
            <div className="mt-4 space-y-3">
              <Alert variant="info" title="Information">Une information est disponible.</Alert>
              <Alert variant="success" title="Succès">L'opération a été effectuée avec succès.</Alert>
              <Alert variant="warning" title="Attention">Le stock est faible pour ce produit.</Alert>
              <Alert variant="danger" title="Erreur">Une erreur est survenue lors de l'enregistrement.</Alert>
            </div>
          </Section>

          {/* Loaders & skeletons */}
          <Section>
            <SectionHeader title="Chargement" description="Skeletons, spinners et progression." />
            <Card className="mt-4">
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                    <LoadingState label="Chargement des données..." />
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
            <SectionHeader title="États" description="Empty, error, offline." />
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <EmptyState title="Aucun produit" description="Commencez par créer votre premier produit." action={<Button size="sm"><PlusIcon /> Créer</Button>} />
              <ErrorState title="Erreur de connexion" description="Impossible de récupérer les données." action={<Button size="sm" variant="outline"><RefreshIcon /> Réessayer</Button>} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <ConnectionStatus status="online" />
              <ConnectionStatus status="offline" />
              <ConnectionStatus status="syncing" />
            </div>
          </Section>

          {/* Dropdown & tooltip */}
          <Section>
            <SectionHeader title="Menus & info-bulles" description="Dropdown et tooltips." />
            <Card className="mt-4">
              <CardContent className="flex flex-wrap items-center gap-4">
                <Dropdown>
                  <DropdownTrigger className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-medium">
                    Menu
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownLabel>Actions</DropdownLabel>
                    <DropdownItem onClick={() => toast.success({ title: "Action", description: "Vous avez cliqué sur Modifier." })}>Modifier</DropdownItem>
                    <DropdownItem onClick={() => toast.info({ title: "Action", description: "Vous avez cliqué sur Dupliquer." })}>Dupliquer</DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem onClick={() => toast.error({ title: "Suppression", description: "Action de suppression (démo)." })}>Supprimer</DropdownItem>
                  </DropdownContent>
                </Dropdown>
                <Tooltip content="Activez un abonnement">
                  <Button variant="outline">Survolez-moi</Button>
                </Tooltip>
              </CardContent>
            </Card>
          </Section>

          {/* Dialogs */}
          <Section>
            <SectionHeader title="Dialogs & toasts" description="Modales et notifications." />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => setDialogOpen(true)}>Ouvrir dialog</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirmation</Button>
              <Button variant="secondary" onClick={() => toast.info({ title: "Info", description: "Ceci est une notification d'information." })}>Toast info</Button>
              <Button variant="success" onClick={() => toast.success({ title: "Enregistré", description: "Le produit a été sauvegardé." })}>Toast succès</Button>
              <Button variant="outline" onClick={() => toast.warning({ title: "Attention", description: "Vérifiez les quantités." })}>Toast warning</Button>
            </div>
          </Section>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Nouveau produit" description="Créez un nouveau produit dans le catalogue" footer={<>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button onClick={() => { setDialogOpen(false); toast.success({ title: "Créé", description: "Produit créé (démo)." }); }}><Save className="size-4" aria-hidden /> Enregistrer</Button>
        </>}>
          <div className="grid gap-4">
            <Field label="Nom" required>
              <Input placeholder="Nom du produit" />
            </Field>
            <Field label="Prix">
              <Input type="number" placeholder="0.000" />
            </Field>
          </div>
        </Dialog>

        <Dialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirmer la suppression"
          description="Cette action est irréversible."
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
              <Button variant="danger" onClick={() => { setConfirmOpen(false); toast.error({ title: "Supprimé", description: "Élément supprimé (démo)." }); }}><X className="size-4" aria-hidden /> Supprimer</Button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Voulez-vous vraiment supprimer cet élément ? Cette action ne peut pas être annulée.
          </p>
        </Dialog>
      </PageContainer>
    </AppShell>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

function PlusIcon() {
  return <span className="inline-flex size-4 items-center justify-center text-lg leading-none">+</span>;
}

function RefreshIcon() {
  return <span aria-hidden>↻</span>;
}
