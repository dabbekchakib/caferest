# Bons de commande fournisseurs (Phase 14)

Module d'achat du café/restaurant : bons de commande fournisseurs
(`purchase_orders` / `purchase_order_items`), cycle de validation en huit
statuts, numérotation serveur `BC-YYYY-NNNNNN`, duplication, historique des
statuts, impression, RBAC/RLS et i18n. **Ne touche pas au stock** : la
réception/valorisation (Phase 15) est volontairement hors périmètre. Les
remises, taxes et totaux sont RECALCULÉS côté serveur (RPC `SECURITY DEFINER`)
et re-calculés côté base : la valeur saisie par le client n'est jamais
enregistrée telle quelle.

## Workflow

```
draft ──submit──▶ pending_approval ──approve──▶ approved ──send──▶ sent
  │                    │                            │            │
  └──── cancel ────────┴──── cancel ────────────────┴── cancel ──┘
   sent ──(réception Phase 15)──▶ partially/fully_received
   fully_received ──close──▶ closed
```

- `draft`, `pending_approval`, `approved`, `sent` et `partially_received` sont
  annulables (`cancel`, motif libre). `cancelled` et `closed` sont des statuts
  puits : aucune transition possible.
- Édition (create/update/delete) autorisée **uniquement** sur `draft` et
  `pending_approval` (`isOrderEditable`). La duplication crée un nouveau brouillon
  depuis n'importe quel statut sauf `cancelled`.
- Les transitions passent par des RPC dédiées : `submit_purchase_order`,
  `approve_purchase_order`, `send_purchase_order`, `cancel_purchase_order`,
  `close_purchase_order`. Chacune vérifie le statut courant, applique une
  transition **atomique** en verrouillant la ligne (`for update`), écrit
  `purchase_order_status_history` et journalise dans `audit_logs`.

## Modèle de données (migration 048, additive)

### `purchase_orders` (évolution additive de la 011)

| Colonne                       | Rôle                                              |
| ----------------------------- | ------------------------------------------------- |
| `order_number`                | `BC-YYYY-NNNNNN` généré serveur (unique/établissement) |
| `supplier_id`                 | `RESTRICT` vers `suppliers`                       |
| `order_date` / `expected_delivery_date` | Dates du bon                            |
| `currency_code`               | `CHAR(3)`, aligné sur le réglage `currency.code` (TND par défaut) |
| `shipping_amount` / `other_charges` | Frais de port / autres frais (niveau commande, jamais répartis) |
| `notes`, `internal_notes`, `supplier_notes` | Notes libres                       |
| `shipping_address`, `billing_address` | Adresses libres du document               |
| `discount_amount`, `tax_amount`, `subtotal`, `total` | Totaux recalculés par trigger |
| `status`                      | CHECK sur les 8 statuts                         |
| `cancellation_reason`         | Motif d'annulation                              |
| `approved_by/at`, `sent_at`, `cancelled_at`, `closed_at` | Horodatages   |
| `created_by`, `updated_by`, `created_at`, `updated_at` | Audit          |

- `refresh_purchase_order_totals()` recompute `subtotal/tax_amount/discount_amount/total`
  après chaque écriture (verrou de commande, garde `draft`).
- `purchase_order_item_amounts()` calcule les montants de LIGNE :
  gross = qty × prix ; discount % ou fixe (bangé au gross) ; `subtotal` ;
  `tax_amount = subtotal × tax_rate / 100` (**`taxes.rate` = points de
  pourcentage** : 7, 13, 19) ; `total = subtotal + tax`.
- `purchase_orders_delete` : une alternative `trigger` (au lieu d'une FK CASCADE
  directe, afin de pouvoir restaurer via `restore_purchase_order_lines`) supprime
  les lignes puis l'entête — la suppression physique est verrouillée hors `draft`.

### `purchase_order_items` (snapshot commercial obligatoire)

Chaque ligne est un instantané du catalogue (`ingredient_suppliers`), jamais une
référence vivante : `ingredient_supplier_id`, `description`, `supplier_sku`,
`purchase_unit_id`, `unit_price`, `discount_type/value`, `tax_id`, `tax_rate`,
`notes`, `sort_order`. `received_quantity` (0 par défaut) et `remaining_quantity`
(synchro par trigger) préparent la réception Phase 15.

### `purchase_order_status_history`

Entrées append-only : `from_status`, `to_status`, `reason`, `changed_by`,
`created_at`.

## RPC et règles

- `create_purchase_order` : garde permission `purchases.create` + vérifie que
  le fournisseur appartient bien à l'établissement, calcule les totaux
  (`purchase_order_totals_payload`), numérote (`next_purchase_order_number`),
  insère entête + lignes, renvoie l'UUID.
- `update_purchase_order` : idem, verrouillé sur `draft` — toute tentative sur
  un bon verrouillé renvoie `purchase_order_locked`.
- `duplicate_purchase_order` : restaure l'entête et les lignes avec statut
  `draft`, remise à zéro des quantités reçues, nouveau numéro.
- Erreurs métier remontées en message RPC puis mappées par
  `RPC_MESSAGE_TO_CODE` → codes stables : `PURCHASE_ORDER_NOT_FOUND`, `_LOCKED`,
  `_INVALID_STATUS`, `_EMPTY`, `_DISCOUNT_INVALID`, `_DUPLICATE_NUMBER`
  (contrainte `uq_purchase_orders_establishment_order_number`).

## RLS

Politiques remplacées (la 023 `purchase_orders_*_write` est **supprimée**), tout
est `belongs_to_establishment(establishment_id)` + permission :
`purchase_orders_read` (`purchases.view`), `_member_insert` (`purchases.create`),
`_member_update` (`purchases.update`), `_member_delete` (`purchases.delete`).
`purchase_order_items` et `purchase_order_status_history` lisibles via
`purchases.view`, insérées via les RPC `SECURITY DEFINER`.

## Permissions (nouveaux slugs)

| Slug                | Rôles (super_admin/admin/manager/purchasing) |
| ------------------- | -------------------------------------------- |
| `purchases.submit`  | workflow                                     |
| `purchases.approve` | workflow                                     |
| `purchases.send`    | workflow                                     |
| `purchases.cancel`  | workflow                                     |
| `purchases.close`   | workflow                                     |
| `purchases.duplicate` | workflow                                   |

`stock_manager` et `accountant` n'ont pas le workflow (lecture seule ; le
`stock_manager` conserve ses droits d'écriture `create/update/delete/receive`
hérités de la 027, ce que reflète la matrice TS). L'écart noté en rapport : la
Phase 15 introduira `purchases.receive` (les slugs `purchases.*` remplacent le
préfixe `purchase_orders.*` de la spec d'origine).

## Frontend

- `/purchase-orders` : liste paginée + filtres (numéro, statut, fournisseur,
  dates) ; actions éditer (si éditables), dupliquer, supprimer (brouillon).
- `/purchase-orders/create` et `/purchase-orders/[id]/edit` : formulaire
  onglet « Informations » (fournisseur, dates, devise, notes, adresses) +
  onglet « Articles » (éditeur du catalogue : ajout depuis `getSupplierCatalog`,
  quantité, prix, remise, TVA, notes, totaux live via le moteur pur
  `src/lib/purchases/calculations.ts`).
- `/purchase-orders/[id]` : onglets Aperçu / Articles / Totaux / Historique +
  boutons workflow (soumission, approbation, envoi, annulation avec motif,
  clôture) selon `availableActions(status)` et les permissions.
- `/purchase-orders/[id]/print` : document imprimable (impression / « Enregistrer
  en PDF »).

## Tests

`tests/purchases.test.ts` (moteur de calcul, matrice de transitions,
validations Zod, mapping d'erreurs RPC, grant des slugs par rôle) + parité des
noms de namespace i18n (11 namespaces × 3 locales) — `npm test`. Validation :
`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

## Limites assumées (Phase 14)

- Pas de réception/stock/valorisation (Phase 15), pas de factures fournisseurs.
- Devise unique par bon (réglage établissement) ; frais shipping/autres non
  répartis sur les lignes.
- Écran vierge si le fournisseur n'a pas encore de catalogue (message « No items »).