# Fournisseurs & catalogue d'achat (Phase 13)

Module de gestion des fournisseurs d'un établissement : fiche fournisseur
(identité juridique, coordonnées, conditions commerciales, mode de paiement,
contacts), catalogue d'achat (`ingredient_suppliers` : référence interne /
code-barres, unité d'achat, quantité, prix, devise, fournisseur préféré par
ingrédient), et historique des prix d'achat **append-only**
(`supplier_price_history`). Le coût normalisé (`prix / unité de base`) est
calculé via le moteur de conversions des unités. Aucun bon de commande, aucune
réception, aucun stock : le module prépare le futur costage + approvisionnement.

## Modèle de données

### `suppliers` (migration 047, évolution additive de la 010)

| Colonne                     | Rôle                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `establishment_id`          | Établissement propriétaire (jamais NULL)                      |
| `code`                      | Référence interne (unique par établissement)                  |
| `name`                      | Nom d'usage du fournisseur                                    |
| `legal_name`                | Raison sociale                                                |
| `registration_number`       | Matricule fiscal / registre                                   |
| `tax_identifier`            | Identifiant fiscal                                            |
| `phone` / `mobile`          | Téléphones ; `contact_person`, `contact_email`, `contact_phone` (légacy Phase 3) |
| `email` / `website`         | Coordonnées numériques                                        |
| `address_line_1/2`, `postal_code`, `city`, `state`, `country` | Adresse          |
| `payment_terms`             | Conditions de paiement en clair                               |
| `default_payment_method_id` | `→ payment_methods.id` (`ON DELETE SET NULL`, même établissement) |
| `delivery_lead_time_days`   | Délai de livraison en jours (`>= 0` ou NULL)                  |
| `minimum_order_amount`      | Commande minimale (`>= 0` ou NULL)                            |
| `is_preferred`              | Fournisseur « favori » de l'établissement (déf. false)        |
| `is_active`                 | Statut plateforme (légacy)                                    |
| `created_by` / `updated_by` | Audit                                                         |

- Additif : la table n'est jamais recréée. Backfill conservateur :
  `contact_person/phone/email/address_line_1` héritent des colonnes
  `contact_name`, `phone`, `email`, `address` quand les nouvelles sont vides.
- RLS remplacée : `suppliers_read` (`suppliers.view`), `_member_insert`
  (`suppliers.create`), `_member_update` (`suppliers.update`), `_member_delete`
  (`suppliers.delete`) — la politique 023 « `suppliers_write` » est supprimée.
- `supplier_references_valid()` interdit tout mode de paiement
  d'un autre établissement.
- `next_supplier_code(p_est)` : générateur `SUP-` + numéro séquentiel
  (`SUP-0001`, …) sous verrou d'avertissement (advisory lock) — la valeur n'est
  pas persistée (collision possible uniquement à la seconde si création
  simultanée sans code, levée via `SUPPLIER_DUPLICATE_CODE`).

### `supplier_contacts` (migration 047)

| Colonne        | Rôle                                |
| -------------- | ----------------------------------- |
| `supplier_id`  | `ON DELETE CASCADE`                 |
| `first_name`, `last_name`, `job_title` | Identité                 |
| `email`, `phone`, `mobile` | Coordonnées               |
| `is_primary`   | Contact principal (≤ 1 actif/fournisseur, index partiel `uq_supplier_contacts_active_primary`) |
| `is_active`    | Statut du contact                   |

- Lecture : `suppliers.view` (via jointure) ; écriture : `suppliers.update`.

### `ingredient_suppliers` — le catalogue (migration 047)

| Colonne                | Rôle                                            |
| ---------------------- | ----------------------------------------------- |
| `ingredient_id`        | `ON DELETE CASCADE`                             |
| `supplier_id`          | `ON DELETE RESTRICT` (bloque la suppression physique d'un fournisseur référencé) |
| `supplier_sku`         | Référence interne fournisseur                   |
| `supplier_barcode`     | Code-barres fournisseur                         |
| `purchase_unit_id`     | Unité d'achat (établissement ou système, `RESTRICT`) |
| `purchase_quantity`    | Quantité achetée par lot (`> 0`, déf. 1)        |
| `purchase_price`       | Prix du lot (`>= 0`, déf. 0)                    |
| `currency_code`        | Devise ISO-4217 (déf. `TND`)                    |
| `minimum_order_quantity`, `lead_time_days` | Conditions               |
| `is_preferred`         | Fournisseur préféré actif de l'ingrédient — **≤ 1** (index partiel `uq_ingredient_suppliers_preferred` sur `ingredient_id WHERE is_preferred AND is_active`) |
| `is_active`            | Ligne présente / inactive                        |
| `valid_from` / `valid_until` | Fenêtre de validité (check `valid_until IS NULL OR valid_from <= valid_until`) |

- Unicité : `uq_ingredient_suppliers_item (ingredient_id, supplier_id)`.
- `supplier_catalog_references_valid()` interdit toute référence croisée
  d'établissement (fournisseur/ingrédient du même établissement, unité de
  l'établissement ou unité système).
- RLS : lecture `suppliers.view` ; insertion/mise à jour/suppression
  `suppliers.manage_catalog`. Les prix ne sont *remontés* à l'UI que si
  l'utilisateur a aussi `suppliers.view_prices` (la colonne elle-même reste
  lisible en base pour `suppliers.view`, comme le pattern `purchase_cost` des
  ingrédients).

### `supplier_price_history` — registre des prix (migration 047)

| Colonne   | Rôle                                     |
| --------- | ---------------------------------------- |
| `ingredient_supplier_id` | `ON DELETE CASCADE`             |
| `purchase_price`, `currency_code`, `purchase_unit_id`, `purchase_quantity` | Snapshot   |
| `valid_from` / `valid_until` | Fenêtre de validité (append-only)  |
| `source`  | `initial` \| `updated`                    |

- **Append-only** : modifier un prix clôt la ligne ouverte (`valid_until =
  now()`) puis ouvre une nouvelle ligne — rien n'est jamais écrasé sur place.
- RLS : lecture `suppliers.view_prices` (un utilisateur catalogue seul ne voit
  jamais le registre) ; insertion `suppliers.update_prices` **ou**
  `suppliers.manage_catalog` (un manager de catalogue ajoute une ligne avec un
  prix initial, mais ne peut ni modifier ni supprimer de lignes) ;
  `supplier_price_history_no_update` / `_no_delete` = `FALSE`.
- Les recommandations SQL `valid_from <= valid_until` et `purchase_quantity > 0`
  / `purchase_price >= 0` couvrent les écritures.

## RPC atomiques (migration 047)

`SECURITY INVOKER` + `has_permission` (err `P0001` si interdit) — chaque RPC
s'exécute dans **une transaction** :

- `add_ingredient_supplier_with_history(...)` : efface le préféré actif du même
  ingrédient (l'index partiel ne voit jamais deux lignes `is_preferred` dans la
  même transaction), insère la ligne catalogue **et** sa ligne d'historique
  initiale, retourne l'`id`.
- `record_supplier_price_change(...)` : clôt la ligne ouverte, met à jour le
  catalogue, ouvre une ligne `updated`.
- `set_preferred_supplier(...)` : `is_preferred = (id = p_item_id)` sur les
  lignes actives du même ingrédient — atomique.

## Coût normalisé (côté client/zod, module pur)

`calculateNormalizedPurchaseCost` (`src/lib/suppliers/calculations.ts`) :
`prix × convertUnitValue(quantité, unité d'achat → unité de base)`.
Références du spec :

- 70 TND / 1 kg de café → 0.0700 TND / g (`kg → g`)
- 120 TND / 1 carton de 24 → 5.0000 TND / pièce (`carton → pc`, 24)
- 2.8 TND / 1 L de lait → 0.0028 TND / ml (`L → ml`)

Retourne `null` sans unité de base, sans unité d'achat, ou si les unités ne
sont pas convertibles — ne lance jamais. L'aperçu du dialogue du catalogue
l'utilise temps réel (unité de base = `base_unit_id` de l'ingrédient). La
devise n'est jamais codée en dur : défaut `TND` via Zod, liste proposée à
l'UI.

## RBAC (migration 047 + `permissions.ts`)

8 slugs `suppliers.*` (4 historiques + `activate`, `manage_catalog`,
`view_prices`, `update_prices`) :

| Rôle          | Slugs ajoutés (sur les 4)                      |
| ------------- | ------------------------------------------------ |
| `super_admin` / `admin` / `manager` / `purchasing` | 4/4                    |
| `stock_manager` | `manage_catalog` + `view_prices`            |
| `accountant`  | `view_prices` uniquement                          |
| `cashier` / `waiter` / `kitchen` / `bar` | aucun                      |

Chaque action passe par `requirePagePermission` / `requirePermission` ; les
prix n'ont pas de permission dédiée côté page (gated service + RLS).

## Flux applicatif

- Pages serveur : `/suppliers` (filtres texte/statut/préféré + pagination URL),
  `/suppliers/create`, `/suppliers/[id]` (onglets Vue d'ensemble / Catalogue /
  Contacts / Prix & historique / Comparaison), `/suppliers/[id]/edit`.
- Composants clients dans `src/features/suppliers/` : liste (dialogs
  activation / suppression douce), formulaire (contacts dynamiques, liste des
  modes de paiement passée en props — jamais de fonctions serveur) ; onglets
  catalogue (DataTable + dialogue add/edit avec aperçu du coût normalisé,
  bouton préféré, suppression), contacts, prix/historique, comparaison
  (meilleure offre pour chaque ingrédient, badge « fournisseur actuel »).
- Onglet fournisseurs sur `/ingredients/[id]` : `IngredientSuppliersSection`
  servi par `getIngredientSuppliers` + `listSuppliers` (options du dialogue),
  avec permissions `manage_catalog` / `view_prices` / `update_prices`.
- Server actions : validate Zod → `requirePermission` → service →
  `writeAudit` → `revalidatePath("/suppliers", "/suppliers/[id]",
  "/ingredients", "/ingredients/[id]")`. Actions : create/update/delete/status,
  `addIngredientSupplierAction`, `updateIngredientSupplierAction` (requiert
  `suppliers.update_prices` dès qu'un champ de prix est présent),
  `removeIngredientSupplierAction`, `setPreferredSupplierAction`.
- Devise : `currency_code` des lignes catalogue ; l'utilisateur choisit parmi
  une liste fixe (TND/EUR/USD/GBP/CHF/SAR/AED/DZD/MAD).

## Erreurs métier

`SUPPLIER_NOT_FOUND`, `SUPPLIER_IN_USE`, `SUPPLIER_DUPLICATE_CODE`,
`SUPPLIER_NO_CATALOG`, `SUPPLIER_CONTACT_INVALID`,
`INGREDIENT_SUPPLIER_DUPLICATE`, `INGREDIENT_SUPPLIER_NOREFS` — codes + clés
`authorization.errors.*` dans `authorization.json` (mapping
`uq_suppliers_establishment_code`, `uq_supplier_contacts_active_primary`,
`uq_ingredient_suppliers_item`, `uq_ingredient_suppliers_preferred`,
`ingredient_suppliers_{quantity,price}_check`,
`supplier_price_history_{price,quantity}_check`).

## Seed démo (migration 047)

Établissement `00000000-0000-0000-0000-000000000001` : unité établissement
« Carton de sucre » (slug `carton-sucre`) + conversion `carton → pc` (24),
fournisseur « Café Fournisseur Tunis » (SUP-0001) et son catalogue : café
(70 TND/kg, préféré), lait (2.8 TND/L), sucre (120 TND/carton) + historique
initial. Clés `sucre`/`cafe-en-grains`/`lait` et unités `kg`/`l`/`pc` attendues.

## Tests

`npm test` (224 tests) : `tests/suppliers.test.ts` couvre
`calculateNormalizedPurchaseCost` (références kg→g / carton→pc / L→ml, même
unité, cas `null`), schémas Zod (fournisseur + catalogue + statut, devises,
prix négatifs, quantité nulle), mapping des erreurs DB, enregistrement des 8
slugs et matrices (purchasing/manager/admin/super_admin complets,
stock_manager catalogue+vue prix, accountant vue prix). Parity locale fr/en/ar
étendue aux 10 namespaces `supplier*`.

## Limites (hors périmètre Phase 13)

Pas de bons de commande, de réceptions, de stock, d'inventaire, de POS ni de
KDS : le catalogue prépare le costage et l'approvisionnement des phases
suivantes. La suppression physique d'un fournisseur référencé est bloquée en
base (`RESTRICT`) — le service bascule en suppression douce. La suppression
d'une ligne catalogue entraîne l'effacement en cascade de son historique
(intention des « donner un aliment à un fournisseur »).