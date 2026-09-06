# Réceptions de marchandises — Goods receipts (Phase 15)

Module de réception des marchandises (`goods_receipts` / `goods_receipt_items` /
`goods_receipt_status_history`) : réception documentaire d'un **bon de commande
fournisseur** (Phase 14), cycle en quatre statuts, numérotation serveur
`BR-YYYY-NNNNNN`, journal d'audit, impression, RBAC/RLS et i18n. C'est la
**seule** entrée en stock d'un achat : une réception **validée** déplace le
stock (`stock_items` + `stock_movements`), valorise sur la **quantité
acceptée**, met à jour les `received/remaining_quantity` et le statut du bon.

## Workflow

```
draft ──submit──▶ pending_validation ──validate──▶ validated   (stock scellé)
  │                     │
  └──── cancel ─────────┴──── cancel ────▶ cancelled          (document annulé)
```

- `draft`, `pending_validation` sont annulables (`cancel`, motif libre).
  `validated` et `cancelled` sont des **statuts puits** — aucune transition.
- Création / édition / suppression : `draft` (+ `pending_validation` pour
  l'édition). Une réception **validée est immuable** (stock déjà déplacé).
- `validate_goods_receipt` est la seule écriture stock : atomique,
  idempotente (index unique partiel sur `stock_movements.goods_receipt_item_id`),
  impossible à exécuter deux fois.

## Modèle de données (migrations 049 + 050)

### `goods_receipts`

| Colonne | Rôle |
| ------- | ---- |
| `receipt_number` | `BR-YYYY-NNNNNN` généré serveur (unique/établissement, verrou advisory) |
| `purchase_order_id` | `RESTRICT` vers le bon (même établissement) — **obligatoire** |
| `receipt_date` | >= au `order_date` du bon (contrôle RPC `goods_receipt_date_invalid`) |
| `supplier_id` | Figé depuis le bon (jamais envoyé par le client) |
| `inventory_location_id` | Location de stock **requise dès la création** (`stock_location_invalid` si null/inactive) |
| `subtotal/discount_amount/tax_amount/total_amount` | Recalculés serveur (`recompute` RPC), jamais trustés |
| `status` | `draft / pending_validation / validated / cancelled` (CHECK) |
| `received_by`, `validated_by/at`, `cancelled_by/at`, `cancellation_reason` | Traçabilité |
| `created_by/updated_by` + timestamps | Audit |

### `goods_receipt_items` (snapshot du bon, recalcule serveur)

Chaque ligne est un instantané (`description`, `supplier_sku`,
`purchase_unit_id`, `unit_price`, `discount_amount`, `tax_rate`) copié depuis
le `purchase_order_items` **au moment de la saisie**. Quantités :
`ordered_quantity`, `previously_received_quantity`, `received_quantity`,
`accepted_quantity`, `rejected_quantity`.

- `accepted + rejected <= received` (CHECK `goods_receipt_items_split_check`).
- **Sur-réception interdite** : `previously_received + received <= ordered`
  (CHECK `..._overdelivery_check`) — tolérance future `allow_over_receipt` seule.
- Conversion d'unité : `purchase_unit_id` → `stock_unit_id` (base_unit de
  l'ingrédient) via `conversion_factor` calculé par `convert_unit_value`.

### `goods_receipt_status_history`

Journal append-only : `from_status`, `to_status`, `reason`, `changed_by`.
Écrit uniquement par les RPC de statut.

### Évolutions 012 (additives, `stock_movements`)

- Colonnes ajoutées : `direction` (`in`/`out`, backfill depuis `movement_type`),
  `base_quantity` / `base_unit_id` (quantité physique **toujours en unité de
  base**), `lot_number` / `batch_number` / `expiry_date`,
  `goods_receipt_id` / `goods_receipt_item_id`.
- Index unique partiel `uq_stock_movements_receipt_item` : **idempotence**
  (un validate répété ne double jamais le mouvement).

## RPC et règles

- `next_goods_receipt_number` : `BR-YYYY-NNNNNN`, verrou advisory par
  établissement + année (miroir de `next_purchase_order_number`).
- `convert_unit_value` : conversion de graphe (+/−, profondeur max 8), miroir
  du moteur TS `src/lib/units/conversions.ts`.
- `receipt_item_amounts` : valorisation ligne — gross = **accepted** × prix ;
  remise **proratisée `accepted/ordered`** ; `tax = subtotal × rate/100`
  (points de pourcentage) ; les taxes **n'entrent jamais dans le coût stock**.
  Remise > brut → `goods_receipt_quantity_invalid`.
- `goods_receipt_line_check` : validation serveur de chaque ligne
  (référence croisée établissement, quantités >= 0, split, over-delivery).
- `restore_goods_receipt_lines` : supprime puis reconstruit les lignes d'un
  brouillon depuis les inputs **et** les snapshots du bon, verrouille la
  réception.
- `create_goods_receipt` / `update_goods_receipt` : permission, références
  valides (PO recevable, location active), date, numérotation, lignes,
  totaux, historique `draft`.
- `submit_goods_receipt` : `draft → pending_validation` (exige une ligne
  `received_quantity > 0`).
- `cancel_goods_receipt` : `draft|pending_validation → cancelled` (motif).
- `delete_goods_receipt` : brouillons uniquement (cascade lignes + history).
- `validate_goods_receipt` : **transaction atomique** — verrous stables
  (réception → PO → lignes PO par id → lignes `stock_items` par
  ingrédient/location) :
  1. re-valide statut/PO/location ;
  2. **mouvement stock** (`movement_type='purchase'`, `direction='in'`,
     `quantity` = base_qty, `unit_cost` = net/base_qty, uv MAP moyenne pondérée
     sur `stock_items` de la location, `last_cost` = coût de la réception) ;
  3. **fulfillment** du bon : `received_quantity += accepted`,
     `remaining_quantity = quantity − received` ;
  4. **statut du bon** recalculé : `fully_received`, `partially_received`
     (si `approved|sent` avec une part reçue) — journal PO mis à jour ;
  5. **scelle la réception** : `validated`, `validated_by/at`, historique.

## RLS

- Politiques `*_write` de la 023 sur `stock_items` / `stock_movements` /
  `inventory_locations` **supprimées** : toute écriture stock passe
  exclusivement par les RPC `SECURITY DEFINER`. Lectures gated
  `inventory.view` **ou** `goods_receipts.view`.
- `goods_receipts` : select `goods_receipts.view` / insert `create` /
  update `update` (+ statut draft/pending) / delete `delete` (+ draft) ;
  tous les checks exigent `belongs_to_establishment` et références valides.
- `goods_receipt_items` : lecture via entête ; écriture via entête
  draft/pending + `goods_receipts.update`.
- `goods_receipt_status_history` : lecture seule (`goods_receipts.view`).

## Permissions (module `goods_receipts`, 7 slugs)

| Slug | super_admin / admin / manager / purchasing | stock_manager | accountant |
| ---- | --- | --- | --- |
| `view` / `create` / `update` / `delete` / `submit` / `cancel` | ✔ | ✔ | view seul |
| `validate` | ✔ | ✘ (jamais) | ✘ |

La validation stock (`validate`) appartient au manager / purchasing ; le
`stock_manager` réceptionne et soumet mais **ne valide jamais** le stock.

## Frontend

- `/receipts` : liste paginée + filtres (n°, statut, dates) ; actions
  supprimer (brouillon).
- `/receipts/create` : importé depuis un bon recevable (`?po=` depuis le bouton
  « Réceptionner » du bon, ou premier bon recevable), location **requise**,
  lignes pré-remplies `received = accepted = remaining` (rejets = 0), édition
  per-line (reçu/accepté/rejeté, lot, batch, péremption, note), boutons
  **Enregistrer** et **Enregistrer + soumettre**.
- `/receipts/[id]` : Aperçu / Lignes / Totaux / Mouvements de stock /
  Historique ; actions workflow selon `receiptAvailableActions` + permissions.
- `/receipts/[id]/edit` : réservé aux brouillons/pending (redirect sinon).
- `/receipts/[id]/print` : document imprimable.
- Aucun prix / total / numéro fiable côté client — le serveur recalcule tout.

## Tests

`tests/receiving.test.ts` (statuts/transitions, permissions par rôle,
validations Zod, mapping d'erreurs RPC + contraintes) + parité des namespaces
i18n (12 namespaces × 3 locales, y compris `receipts … stockReceipt`).
Validation : `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

## Limites assumées (Phase 15)

- Recevables uniquement : bon `approved | sent | partially_received` ; pas de
  réception sans bon (par construction).
- Sur-réception impossible (pas encore de `allow_over_receipt`).
- Location de stock **obligatoire dès la création** (décision de recadrage :
  la colonne était nullable dans la première ébauche, le RPC la refuse).
- Coût stock sur la **quantité acceptée** uniquement ; les rejets ne valorisent
  rien ; les taxes n'entrent pas dans le coût.
- `purchases.receive` reste inégal entre le catalogue TS (`permissions.ts`) et
  la base (slug absent de la 027) — conservé pour l'UI de rétro-compatibilité,
  l'action « Réceptionner » du PO s'appuie sur `goods_receipts.create`.
- Devise seule par établissement (réglage `currency`), pas de multi-devises.