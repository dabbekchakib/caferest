# Ajustements de stock — Stock adjustments (Phase 17)

Module de pertes / sorties de stock (`stock_adjustments` /
`stock_adjustment_items` / `stock_adjustment_reasons` /
`stock_adjustment_status_history`) : sortie volontaire de stock sur une
**location**, cycle en cinq statuts, numérotation serveur `PER-YYYY-NNNNNN`,
10 types d'ajustement, catalogue de motifs par type, seuils d'approbation
configurables, journal d'audit, impression, RBAC/RLS et i18n.
`validate_stock_adjustment` est le **seul** point d'écriture stock d'un
ajustement : le miroir côté perte de `validate_goods_receipt` (Phase 15) /
`validate_stocktake` (Phase 16).

## Workflow

```
draft ──submit──▶ pending_approval ──approve──▶ approved ──validate──▶ validated   (stock scellé)
  │                │ (si approbation requise)         │
  │                └─ approbation auto si le seuil    └────── cancel ──────────────▶ cancelled
  │                  n'est pas atteint ──▶ approved                        (draft / pending / approuvé)
  └── delete ──────┴──── cancel ──────────────────────▶ cancelled                  (document annulé)
```

- `draft` est supprimable (`delete`) et annulable (`cancel`). `pending_approval`
  et `approved` sont annulables (motif). `validated` et `cancelled` sont des
  **statuts puits** — aucune transition, rien ne les rouvre.
- Le **submit** décide de la garde d'approbation — jamais codée en dur : la
  décision est prise à partir des réglages passés en paramètres
  (`p_require_approval` **ou** `total_value > p_threshold_value`). Le chemin
  sans approbation atterrit directement en `approved` (approbation auto).
- `approve` passe deux gardes : **séparation des rôles** (le créateur ne peut
  pas approuver son propre ajustement quand `p_require_separation` est vrai) et
  **valeur élevée** (au-delà du seuil, seuls `super_admin` ou un porteur de
  `stock_adjustments.approve_high_value` franchissent).
- `validate_stock_adjustment` est la seule écriture stock : atomique,
  idempotente (index unique partiel sur
  `stock_movements.stock_adjustment_item_id`), impossible à exécuter deux fois,
  et protégée par un contrôle de **disponibilité** (après verrous) —
  `stock_adjustment_insufficient_stock` si le stock dispo < quantité.

## Modèle de données (migrations 054 + 055)

### `stock_adjustments`

| Colonne | Rôle |
| ------- | ---- |
| `adjustment_number` | `PER-YYYY-NNNNNN` généré serveur (unique/établissement, verrou advisory) |
| `inventory_location_id` | Location de sortie |
| `adjustment_type` | `loss / breakage / waste / expired / damaged / internal_consumption / sample / staff_consumption / cleaning / other` (CHECK) |
| `adjustment_date` | Date métier (>= 2000-01-01), distincte de la date système |
| `reason_id` | Motif (catalogue, cohérent avec le type) |
| `status` | `draft / pending_approval / approved / validated / cancelled` (CHECK) |
| `requires_approval` | Décidé au submit (la prise d'effet du réglage), figé |
| `total_quantity` / `total_value` | Synthèse recalculée serveur (`recompute_stock_adjustment`) — jamais trustée du client |
| `submitted_by/at`, `approved_by/at`, `validated_by/at`, `cancelled_by/at`, `cancellation_reason` | Traçabilité |
| `internal_reference`, `notes`, `created_by/updated_by` + timestamps | Audit |

### `stock_adjustment_items`

Lignes en unité de base (`base_quantity`, `base_unit_id`, `unit_id`, unique par
`(stock_adjustment_id, ingredient_id)`). `unit_cost` / `total_cost` sont
**gelés au submit** (`recompute_stock_adjustment`) : une ligne ne voit plus ni
coût ni quantité modifiés après l'envoi. Les quantités sont stockées en unité
de base (conversion `convert_unit_value` si un `unit_id` est fourni).

### `stock_adjustment_reasons`

Catalogue de motifs par type : 21 motifs système (`is_system = true`,
`establishment_id IS NULL`) + motifs propres à l'établissement. Un motif
établissement doit être compatible avec le type de l'ajustement
(`stock_adjustment_reason_valid`).

### `stock_adjustment_status_history`

Journal append-only : `from_status`, `to_status`, `reason`, `changed_by`.
Écrit uniquement par les RPC de statut. La transition de validation est
réversible **visuellement** (annulation) mais les écritures stock restent.

### Évolutions (additives, `stock_movements`)

- Colonnes ajoutées : `stock_adjustment_id` / `stock_adjustment_item_id`.
- Index unique partiel `uq_stock_movements_stock_adjustment_item` :
  **idempotence** (un validate répété ne double jamais la sortie).
- `movement_type` = type de l'ajustement, `direction = 'out'`,
  `quantity` / `base_quantity` = base_qty, `unit_cost` / `total_cost` gelés,
  `reference_type = 'stock_adjustment'`, `reason = 'Ajustement <n°>'`.

## RPC et règles (11 fonctions)

- `next_stock_adjustment_number` : `PER-YYYY-NNNNNN`, verrou advisory par
  établissement + année (miroir de `INV-`/`BR-`).
- `stock_adjustment_{scope,location,reason}_valid` : fonctions auxiliaires de
  cohérence (ingrédient/unité dans l'établissement, location active de
  l'établissement, motif compatible avec le type).
- `create_stock_adjustment` : permission `create`, type/date/location/motif
  validés, numérotation, statut `draft`, historique + **lignes optionnelles
  atomiques** (`p_items jsonb`), puis `recompute`.
- `add_stock_adjustment_item` / `update_stock_adjustment_item` /
  `remove_stock_adjustment_item` : `draft` uniquement
  (`stock_adjustment_wrong_status`) ; doublon → `_duplicate_item` ; quantité
  invalide → `_quantity_invalid` ; conversion impossible → `stock_unit_incompatible`.
  Chaque opération recalcule les totaux.
- `submit_stock_adjustment` : `draft → pending_approval | approved` — gèle les
  coûts/totaux, calcule `requires_approval` depuis les paramètres, renseigne
  `submitted_*/approved_*` (approbation auto si pas de garde), historique.
- `approve_stock_adjustment` : `pending_approval → approved` — gardes
  **séparation des rôles** (`stock_adjustment_self_approval`) puis **valeur
  élevée** (`stock_adjustment_high_value_approval`), `approved_by/at`.
- `validate_stock_adjustment` : `approved → validated` — **transaction
  atomique** :
  1. verrou entête (un `validated` ne se rouvre jamais) ;
  2. pré-verrou ordonné des lignes `stock_items` de la location (pas de
     deadlock entre validations concurrentes) ;
  3. contrôle de disponibilité **après les verrous**
     (`stock_adjustment_insufficient_stock`) ;
  4. un `stock_movements` par ligne, taggé `stock_adjustment_id` +
     `stock_adjustment_item_id` (UNIQUE partiel → retry no-op) ;
  5. upsert `stock_items` : quantité `− base`, coût moyen conservé **sauf**
     quand la ligne tombe à 0 (le coût se réinitialise) ;
  6. scelle : `validated`, `validated_by/at`, historique.
- `cancel_stock_adjustment` : `draft | pending_approval | approved → cancelled`
  (motif). `delete_stock_adjustment` : brouillons uniquement (cascade lignes +
  history).

## RLS

- `stock_adjustments` : select `stock_adjustments.view` / insert `create` /
  update `update` / delete `delete` ; tous les checks exigent
  `belongs_to_establishment`.
- `stock_adjustment_items`, `stock_adjustment_reasons`,
  `stock_adjustment_status_history` : lecture gated via entête ; toute écriture
  passe **exclusivement** par les RPC `SECURITY DEFINER`.
- Cost (`unit_cost`, `total_value`) exposé seulement aux porteurs de
  `stock_adjustments.view_cost` ; le service projette conditionnellement.

## Permissions (module `stock_adjustments`, 10 slugs)

| Slug | super_admin / admin / manager | stock_manager | accountant | purchasing |
| ---- | --- | --- | --- | --- |
| `view` / `create` / `update` / `delete` / `submit` / `cancel` | ✔ | ✔ | view | view |
| `view_cost` | ✔ | ✔ | ✔ | ✘ |
| `approve` / `validate` / `approve_high_value` | ✔ | ✘ | ✘ | ✘ |

Le **gestionnaire** (`manager`) dispose du workflow complet (10/10), comme pour
les inventaires (`stocktakes.*`). Le `stock_manager` prépare et soumet mais ne
valide jamais : `approve` / `validate` / `approve_high_value` restent aux rôles
« manager-level » (`manager` et au-dessus), avec les gardes de séparation
(`stock_adjustment_self_approval`) et de seuil (`stock_adjustment_high_value_approval`)
qui s'appliquent à tous. Le comptable lit + coûts, les achats lisent seulement.

## Seuils d'approbation (settings par établissement)

| Clé | Défaut | Usage |
| --- | --- | --- |
| `require_adjustment_approval` | false | Approbation obligatoire à chaque submit (`requires_approval`) |
| `approval_threshold_value` | 1000 | Garde valeur en devise : total > seuil ⇒ `pending_approval` |
| `approval_threshold_percentage` | 0 | **Réservé** — future consommation recettes (non implémenté en 17) |
| `require_adjustment_approval_separation` | false | Séparation des rôles : le créateur ne peut pas approuver |

Les seuils sont lus côté serveur
(`adjustmentThresholdsFromSettings` dans
`src/lib/stock-adjustments/thresholds.ts`) et **passés en paramètres** des RPC
`submit` / `approve` — jamais codés en dur dans le SQL.

## Frontend

- `/stock-adjustments` : liste paginée + filtres (requête, statut, type,
  location, dates) ; actions supprimer (brouillon).
- `/stock-adjustments/create` : location + type + date + motif + notes +
  référence interne ; sélecteur de lignes (ingrédient + quantité), totaux
  estimés en direct (coût par ingrédient), aperçu de la garde
  (`requiresApproval` preview) ; numéro `PER-` pré-généré.
- `/stock-adjustments/[id]` : vue détail — stepper de statuts, cartes de
  synthèse (lignes / quantité totale / valeur totale), tableau des lignes
  (coût unitaire gelé + total), historique + mouvements de stock ; actions
  selon `stockAdjustmentAvailableActions` + permissions (submit / approve /
  validate / cancel / delete, dialogues motif).
- `/stock-adjustments/[id]/print` : document imprimable.
- La synthèse (totaux) du brouillon est **estimative** côté client
  (`calculateAdjustmentTotals`) ; après submit, le serveur fige coûts/totaux —
  la vue détail n'affiche que les valeurs server-side.

## Tests

`tests/stock-adjustments.test.ts` (statuts/transitions/terminaisons, calculs
quantité/valeur/seuils/garde, validations Zod, mapping d'erreurs RPC +
contraintes, module + matrice par rôle — manager 10/10, stock_manager sans
approve/validate) +
parité des namespaces i18n (12 namespaces × 3 locales). Un e2e live
(`supabase/.temp/live-stock-adjustment-e2e.cjs`, 48 checks) valide contre la
base réelle : création brouillon + lignes, submit auto-approuvé, validate
(écriture stock + mouvements + idempotence), garde haute valeur + séparation
des rôles, stock insuffisant, annulations/suppressions. Validation : `npm run
lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

## Limites assumées (Phase 17)

- Module **sorties uniquement** : les entrées (retours fournisseur, rééchets,
  excédents) relèvent d'un module futur ; le `movement_type` reste le type de
  l'ajustement (toujours `direction = 'out'`).
- `approval_threshold_percentage` déclaré en settings mais **réservé** : seule
  la garde valeur (devise) est appliquée par les RPC en 17.
- La séparation des rôles s'applique **au moment de l'approbation**
  (créateur ≠ approuveur) ; l'approbation auto d'un submit sans garde ne
  crée aucune obligation (approuvé par le soumetteur).
- Pas de revalorisation moyenne pondérée possible : `average_cost` est conservé
  tel quel tant que la ligne reste > 0 ; il se réinitialise à 0 quand la
  quantité atteint 0.
- Devise seule par établissement (réglage `currency`), pas de multi-devises ;
  `total_value` valorisé sur le coût moyen MAP gélé au submit.