# Inventaires physiques — Stocktakes (Phase 16)

Module de comptage physique du stock (`stocktakes` / `stocktake_items` /
`stocktake_status_history`) : inventaire sur une **location**, cycle en six
statuts, numérotation serveur `INV-YYYY-NNNNNN`, mode **standard** ou
**aveugle**, seuils de variance configurables, journal d'audit, impression,
RBAC/RLS et i18n. `validate_stocktake` est le **seul** point d'écriture stock
d'un inventaire : c'est le miroir naturel de `validate_goods_receipt` (Phase 15)
pour l'autre sens du stock.

## Workflow

```
draft ──start──▶ counting ──complete──▶ pending_review ──approve──▶ approved ──validate──▶ validated   (stock scellé)
  │               │                        │                │
  └── delete ─────┴──── cancel ────────────┴──── cancel ─────┴──── cancel ────▶ cancelled               (document annulé)
```

- `draft` est supprimable (`delete`) et annulable (`cancel`). `counting`,
  `pending_review`, `approved` sont annulables. `validated` et `cancelled`
  sont des **statuts puits** — aucune transition, rien ne les rouvre.
- Le comptage (`count`) n'est possible qu'en `counting` ; la revue (`complete`)
  exige que **toutes les lignes soient comptées**.
- `approve` et `validate` passent le **contrôle de variance** : au-delà des
  seuils (`stocktake_high_variance`), seuls `super_admin` ou un détenteur de
  `stocktakes.approve_high_variance` peuvent franchir
  (`stocktake_high_variance_approval`).
- `validate_stocktake` est la seule écriture stock : atomique, idempotente
  (index unique partiel sur `stock_movements.stocktake_item_id`),
  impossible à exécuter deux fois.

## Modèle de données (migrations 051 + 052)

### `stocktakes`

| Colonne | Rôle |
| ------- | ---- |
| `stocktake_number` | `INV-YYYY-NNNNNN` généré serveur (unique/établissement, verrou advisory) |
| `inventory_location_id` | Location comptée (figée au start) |
| `mode` | `standard` (théorique visible) / `blind` (théorique masqué pendant le comptage) |
| `status` | `draft / counting / pending_review / approved / validated / cancelled` (CHECK) |
| `freeze_stocktake_at_start` | Règle d'entreprise : exige une location à comptage gelé (**non implémentée** en 16 — voir Limites) |
| `started_by/at`, `completed_by/at`, `approved_by/at`, `validated_by/at`, `cancelled_by/at`, `cancellation_reason` | Traçabilité |
| `notes`, `created_by/updated_by` + timestamps | Audit |

### `stocktake_items` (instantané de stock au start)

Chaque ligne est un instantané (`ingredient_id`, `base_unit_id`,
`snapshot_quantity`, `unit_cost`, unique par
`(stocktake_id, ingredient_id)`) capturé au **start**. Le théorique
(`expected_quantity`) et la variance sont **recalculés à chaque opération
serveur** (`reconcile_stocktake`) — jamais trustés depuis le client :

- `expected = max(snapshot + Σ mouvements signés depuis started_at, 0)` (les
  ajustements du stocktake lui-même jamais inclus) ;
- `variance = counted − expected` ; `%` : `0/0 → 0`, `x/0 → 100`, sinon
  `counted/expected − 1` ; `variance_value = variance × unit_cost` ;
- `counted_quantity` / `counted_by` / `counted_at` : saisie physique ;
- seul le start génère les lignes (`scope` = `all | stocked | selected`,
  `include_zero_stock`).

### `stocktake_status_history`

Journal append-only : `from_status`, `to_status`, `reason`, `changed_by`.
Écrit uniquement par les RPC de statut.

### Évolutions (additives, `stock_movements`)

- Colonnes ajoutées : `stocktake_id` / `stocktake_item_id`.
- Index unique partiel `uq_stock_movements_stocktake_item` : **idempotence**
  (un validate répété ne double jamais l'ajustement).
- `movement_type='stock_adjustment'`, `direction='in'|'out'` selon le signe de
  la variance, `quantity` = base_qty, `unit_cost` = `variance_value/variance`.

## RPC et règles

- `next_stocktake_number` : `INV-YYYY-NNNNNN`, verrou advisory par
  établissement + année (miroir de `next_purchase_order_number`).
- `create_stocktake` : permission, location **requise**, numérotation, statut
  `draft`, historique.
- `start_stocktake` : `draft → counting` — **génère les lignes** par snapshot
  des `stock_items` + ingrédients/zéro-stock selon `scope` / `include_zero_stock`,
  exige une ligne (`stocktake_empty`), fige `started_by/at`.
- `update_stocktake_count` : `counting` uniquement
  (`stocktake_wrong_status`), `amount` en `unitId` converti en unité de base
  (contenu **vide = ligne non comptée**), `counted_by/at`.
- `complete_stocktake` : `counting → pending_review` — exige **toutes** les
  lignes comptées (`stocktake_incomplete`).
- `approve_stocktake` : `pending_review → approved` — recompute, garde de
  variance élevée (`stocktake_high_variance` avec les seuils **passés en
  paramètre**, jamais codés en dur), `approved_by/at`.
- `validate_stocktake` : `approved → validated` — **transaction atomique** :
  1. verrou entête (`validated` verrouillé) ;
  2. pré-verrou ordonné des lignes `stock_items` de la location (pas de
     deadlock entre inventaires / réceptions) ;
  3. `reconcile_stocktake` (théorique + variance au plus frais) ;
  4. gardes : lignes complètes + variance élevée ;
  5. un `stock_movements` par ligne non nulle, taggé
     `stocktake_id` + `stocktake_item_id` (UNIQUE partiel → retry no-op) ;
  6. upsert `stock_items` : moyenne pondérée sur gain, coût inchangé sur
     perte, coût nul quand la ligne tombe à 0 ;
  7. scelle : `validated`, `validated_by/at`, historique.
- `cancel_stocktake` : `draft|counting|pending_review|approved → cancelled`
  (motif). `delete_stocktake` : brouillons uniquement (cascade lignes +
  history).
- `stocktake_high_variance(p_stocktake_id, p_percent, p_value)` : ligne non
  comptée **ou** `|variance_%| > p_percent` **ou** (`p_value > 0` et
  `|variance_value| > p_value`) — les valeurs (≠ %) ne déclenchent que si la
  garde valeur est activée (`0` = désactivée).

## RLS

- `stocktakes` : select `stocktakes.view` / insert `create` / update `update` /
  delete `delete` ; tous les checks exigent `belongs_to_establishment`.
- `stocktake_items`, `stocktake_status_history` : lecture gated via entête ;
  toute écriture passe **exclusivement** par les RPC `SECURITY DEFINER`.
- Lectures `view_cost` : le coût (`unit_cost`, `variance_value`) n'est exposé
  qu'aux porteurs de `stocktakes.view_cost` (le service projette conditionnellement).

## Permissions (module `stocktakes`, 12 slugs)

| Slug | super_admin / admin / manager | stock_manager | accountant | purchasing |
| ---- | --- | --- | --- | --- |
| `view` / `create` / `update` / `delete` / `start` / `count` / `review` / `cancel` | ✔ | ✔ | view | view |
| `approve` / `validate` / `approve_high_variance` | ✔ | ✘ (jamais) | ✘ | ✘ |
| `view_cost` | ✔ | ✔ | ✔ | ✘ |

L'**approbation / validation** (écriture stock de l'inventaire) appartient au
manager / admin ; le `stock_manager` compte, révise, annule et voit les coûts,
mais **ne valide jamais** le stock d'un inventaire.

## Seuils de variance (settings par établissement)

| Clé | Défaut | Usage |
| --- | --- | --- |
| `stocktake_variance_warning_percentage` | 2 | Bandeau « à surveiller » (présentation) |
| `stocktake_variance_approval_percentage` | 5 | Garde d'approbation (RPC) |
| `stocktake_variance_approval_value` | 0 (désactivé) | Garde valeur en devise (RPC) : actif si > 0 |
| `stocktake_variance_warning_value` | 0 | Bandeau valeur (présentation) |
| `freeze_stocktake_location` | — | **Advisory (UI)** : bannière pendant un comptage ouvert — les RPC ne codent jamais un gel |

Les seuils d'approbation sont lus côté serveur (`stocktakeThresholdsFromSettings`)
et **passés en paramètres** des RPC `approve` / `validate`.

## Frontend

- `/stocktakes` : liste paginée + filtres (requête, statut, mode, location,
  dates) ; actions supprimer (brouillon).
- `/stocktakes/create` : location + mode + notes ; numéro `INV-` pré-généré.
- `/stocktakes/[id]` : vue détail — stepper de statuts, cartes de synthèse
  (total/compté/total des écarts), tableau des lignes (attendu, compté, écart,
  % et valeur), historique + mouvements de stock ; actions selon
  `stocktakeAvailableActions` + permissions (start / complete / approve /
  validate / cancel / delete, avec dialogues motif).
- `/stocktakes/[id]/count` : panneau de démarrage (scope, zéro-stock,
  ingrédients) puis saisie au clavier/saisie rapide, sauvegarde debounce +
  onBlur, mode **aveugle** masque le théorique, filtres de lignes
  (tous/comptés/à traiter/écarts), jauges de sévérité selon les seuils.
- `/stocktakes/[id]/review` : revue avant complétion (redirige si hors
  `counting`/`pending_review`).
- `/stocktakes/[id]/print` : document imprimable.
- Le comptage est saisi **en unité de base** (le sélecteur d'unité coexiste,
  envoie `unitId: null` ⇒ RPC corrige sur la base) ; aucun théorique/écart n'est
  fiable côté client — le serveur recalcule tout.

## Tests

`tests/stocktakes.test.ts` (statuts/transitions/terminaisons, calculs
variance/théorique/synthèse/seuils, validations Zod, mapping d'erreurs RPC +
contraintes, module + matrice par rôle) + parité des namespaces i18n
(12 namespaces × 3 locales). Validation : `npm run lint`, `npx tsc --noEmit`,
`npm test`, `npm run build`.

## Limites assumées (Phase 16)

- Saisie des quantités en **unité de base** uniquement (le champ unité n'envoie
  pas de conversion) — le RPC normalise sur la base.
- `freeze_stocktake_at_start` (gel d'emplacement) : **non implémenté** — la
  règle d'entreprise reste un bandeau UI via `freeze_stocktake_location`
  (décision de recadrage : pas de blocage serveur tant que le besoin réel
  n'existe pas).
- Devise seule par établissement (réglage `currency`), pas de multi-devises ;
  le `variance_value` est valorisé sur `unit_cost` de l'ingrédient, coût unitaire
  MAP au moment des recalculs serveur.
- Validation d'un inventaire **non approuvé** impossible par construction ;
  pas de « comptage partiel » hors `counting`.