# Espaces, tables & plan de salle (Phase 18)

Module de configuration de la **salle** : espaces (`dining_areas`, terrasses,
corners...), tables de service (`tables`) et **plan visuel interactif**
(`/floor-plan`). Hérite des tables créées en 014 et les fait évoluer de façon
additive (slug, description multilingue, géométrie, statut étendu), remplace
le `code` historique par un numéro de table métier, et gate l'accès complet
derrière les permissions Phase 18. C'est une brique de configuration : le
traitement des commandes en salle (affectation table/station du POS) relève
des phases suivantes.

## Modèle de données (migration 056)

### `dining_areas` (évolution additive)

| Colonne | Rôle |
| ------- | ---- |
| `slug` | Identifiant textuel unique par établissement (backfill dédupliqué + repli `zone-<uuid>` pour les scripts arabes) |
| `description` | Description maître (FR) |
| `color` | Couleur hexadécimale (`#rgb` \| `#rrggbb`) |
| `icon` | Icône Lucide (kebab-case) parmi `salon/salle/terrasse/bar/vip/etage/exterieur` |

- `uq_dining_areas_establishment_slug` : unicité `(est, slug)`.

### `dining_area_translations`

| Colonne | Rôle |
| ------- | ---- |
| `dining_area_id` | `ON DELETE CASCADE` |
| `locale` | `fr` \| `en` \| `ar` (CHECK) |
| `name` / `description` | Traduction de l'espace |

- `UNIQUE(dining_area_id, locale)` ; trigger `updated_at`.
- Repli d'affichage : **locale active → name (maître)** ; un `name` vide
  signale la suppression de la ligne de traduction.

### `tables` (évolution additive)

| Colonne | Rôle |
| ------- | ---- |
| `slug` | Identifiant textuel unique par établissement (backfill dédupliqué + repli `table-<uuid>`) |
| `table_number` | Numéro de table métier (reprend le legacy `code`, colonne `code` supprimée) |
| `shape` | `round` \| `square` \| `rectangle` (CHECK, défaut `round`) |
| `width` / `height` | Taille en pixels virtuels (`null` → défaut 90 ; min 50) |
| `rotation` | Rotation 0–360° (CHECK) |
| `color` | Couleur d'affichage sur le plan |
| `sort_order` | Ordre d'affichage dans la liste |

- `uq_tables_establishment_number` : unicité `(est, table_number)` (partielle,
  `table_number is not null`).
- `uq_tables_establishment_slug` : unicité `(est, slug)`.
- Statut étendu : `available / occupied / reserved / cleaning / disabled /
  blocked` (CHECK recréé après suppression de l'ancien).

## RLS

- `dining_areas` : select `dining_areas.view` **ou** `tables.floor_plan`
  (un éditeur de plan lit aussi les zones) ; insert `dining_areas.create` ;
  update `dining_areas.update` **ou** `dining_areas.reorder` ; delete
  `dining_areas.delete`.
- `tables` : select `tables.view` **ou** `tables.floor_plan` ; insert
  `tables.create` ; update `tables.update / reorder / status / floor_plan` ;
  delete `tables.delete`. Tous les checks exigent `belongs_to_establishment`.
- `dining_area_translations` : hérite de la lisibilité de l'espace parent ;
  insert/update/delete via les permissions `dining_areas.*` sur l'espace
  parent. La suppression d'un espace (permission `dining_areas.delete`)
  cascade sur ses traductions.

## Permissions (modules `dining_areas` + `tables`, 12 slugs)

| Slug | Rôle |
| ---- | ---- |
| `dining_areas.view` / `create` / `update` / `delete` / `reorder` | CRUD des espaces |
| `tables.view` / `create` / `update` / `delete` / `reorder` / `status` / `floor_plan` | CRUD + statut + édition du plan |

Matrice Phase 18 : `super_admin`, `admin` et `manager` reçoivent les 12 slugs ;
les autres rôles n'en ont aucun. Le catalogue SQL (056) reste synchronisé avec
`PERMISSION_SLUGS` (`src/lib/authorization/permissions.ts`), les locales
`permissions.json` et la matrice `SYSTEM_ROLE_DEFAULT_PERMISSIONS`.

## Géométrie & contraintes serveur

- Canvas virtuel : 1200 px, snap 20 px (5 px avec Shift), rotation par pas de
  15°. `TABLE_MIN_SIZE = 50`, `TABLE_DEFAULT_WIDTH/HEIGHT = 90`.
- `src/lib/floor-plan/geometry.ts` (pur, testé) : `snapToGrid`, `clampNumber`,
  `clampRotation`, `snapRotation`, `withinCanvas`, `tableBox`, `tableCenter`,
  `rectsOverlap` (feedback de collision), `clampDimension`,
  `normalizeFloorPatches` (validité taille ≥ 50 / rotation 0–360 / position
  dans le canvas).
- La validation d'écriture (`src/features/tables/actions.ts`) rejette côté
  serveur les patchs hors bornes (`tableSizeInvalid`, `tableRotationInvalid`,
  `tablePositionInvalid`) avant upsert.
- Chaque mutation passe par `requirePermission` + `requireCurrentEstablishment`,
  persiste via `tables-service`, écrit un audit (`writeAudit`) puis
  `revalidatePath` des routes concernées (`/floor-plan`, `/tables`, `/dining-areas`).
- Erreurs métier avec clés i18n `authorization.json` : `diningAreaNotFound`,
  `diningSlugExists`, `tableNumberExists`, `tableSizeInvalid`,
  `tablePositionInvalid`, `tableRotationInvalid`.

## Frontend

- `/dining-areas` : liste des espaces (icône + couleur + nom localisé, filtres,
  flags create/update/delete/reorder via `hasPermission`), pages create/edit
  avec traductions FR/EN/AR.
- `/tables` : liste paginée + filtres (requête, statut, zone), numéro + nom +
  capacité + statut (`StatusBadge` `tables.status.*`), flags
  create/update/delete/status ; le sélecteur de zones n'apparaît qu'avec
  `hasPermission("dining_areas.view")`.
- `/floor-plan` : **éditeur visuel** — pan/zoom (molette + Ctrl, centré sur le
  pointeur), déplacement au clavier/Redimensionnement/pivot des tables au
  drag (Shift = fine snap), détection de collision (`rectsOverlap`), zones
  colorées de fond, sauvegarde par patchs différés
  (`updateTableFloorPlanAction`, `dirtyIds`), nouvelle table inline si
  `hasPermission("tables.create")`. Neutre RTL (`ReOrderPlane` n'est pas
  utilisé) car l'axe X physique est affiché gauche→droite.
- Navigation : nouvelle section `dining` (`/dining-areas`, `/tables`,
  `/floor-plan`) ; `/tables` retiré de la section POS.
- Composant `src/features/floor-plan/floor-plan.tsx` importé par la page
  `/floor-plan` ; API UI utilisées : `StatusBadge` (status/label/size),
  `Field`, `Input`, `PageHeader` (breadcrumbs/actions), `Select` (pas de
  prop `size`).

## i18n

Nouveaux namespaces `tables` (colonnes, statuts, formes, form), `diningAreas`,
`floorPlan` (toolbars, légendes, propriétés) en FR/EN/AR — parité vérifiée
par `tests/locale-parity.test.ts`. Navigation enrichie des entrées
`dining/diningAreas/floorPlan` ; `client-messages.ts` enregistre les
namespaces client (`diningAreas`, `floorPlan`). Les libellés de statut du plan
réutilisent le namespace `tables` via `tTab`.

## Tests & vérification

`tests/tables.test.ts` (slugify / slugs valides, résolution des noms localisés,
statuts/formes/icônes, snap/clamp/rotation/withinCanvas, tableBox + centre,
collisions, `normalizeFloorPatches`, schémas Zod create/update/floor-plan) +
parité locale des 3 nouveaux namespaces et de `navigation`. Validation : `npm
run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run db:push`.

## Limites assumées (Phase 18)

- Configuration uniquement : aucune réservation ni affectation de table dans le
  POS (le flux commandes en salle est une phase ultérieure sur ce modèle).
- `sort_order` persiste et sert au tri des listes ; le plan s'affiche par
  position absolue, pas par ordre.
- Pas de multi-étages : le plan est un canevas unique 1200 px ; le champ
  `etage` de `dining_areas` est un simple tag visuel.
- La suppression d'un espace (« les tables deviennent sans zone ») est
  autorisée — celles-ci restent visibles sur le plan hors zones.