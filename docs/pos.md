# POS, prise de commande & panier de vente (Phase 19)

Module de **prise de commande** : catalogue du point de vente (`/pos`),
panier de vente, création de commandes ouvertes et gestion de leur cycle de
vie (confirmer / attendre / reprendre / annuler). Il fait évoluer les tables
`orders` / `order_items` créées en 016 de façon **additive** (statuts
`open`/`counter`, colonnes d'audit, snapshots produits/taxes). Les paiements,
la caisse, le display cuisine (KDS) et la déduction de stock sont hors
périmètre (phases suivantes).

## Fonctionnalités

- **Catalogue POS** résolu côté serveur : produits actifs + disponibles +
  `is_pos_visible`, noms traduits (locale active → FR), catégorie, code-barres
  / SKU, taux de TVA du produit.
- **Panier** : ajout d'articles, quantités, remise (plafonnée au sous-total,
  masquée si `pos.allow_discount` désactivé), notes, type de vente, table /
  zone, client (fidélité future).
- **Prise de commande idempotente** : chaque envoi porte un
  `client_operation_id` (requêtes dupliquées sans effet).
- **Commandes ouvertes** : `open` (en attente de confirmation) et `confirmed`
  (envoyée), actions de cycle de vie + `/orders` pour l'historique récent.
- **Occupation de table** : la table passe `occupied` à la confirmation, et
  redevient `available` à l'attente / l'annulation.

## Modèle de données (migration 057)

### `orders` (évolution additive)

| Colonne | Rôle |
| ------- | ---- |
| `dining_area_id` | Zone de la table (pour les types avec table) |
| `client_operation_id` | Idempotence (`p_client_operation_id`), `NULL` autorisé |
| `created_by` / `updated_by` | Auteur de la création / dernière mise à jour |
| `confirmed_at` / `confirmed_by` | Paysage de la **confirmation** |
| `held_at` | Estampille de la mise en attente (permet de distinguer reprise vs confirmation initiale) |
| `cancelled_at` / `cancelled_by` / `cancellation_reason` | Trace d'annulation |

- `orders_status_check` recréé : `draft, open, pending, preparing, ready,
  served, completed, cancelled` (ouvre le cycle vers la cuisine).
- `orders_type_check` recréé : `dine_in, takeaway, delivery, counter`.
- Index : `orders_est_status_created_at`, `orders_est_client_op`,
  `orders_est_created_at`.

### `order_items` (évolution additive)

- `product_name` / `tax_rate` : **snapshots** pour le récit de la commande
  (le produit peut ensuite changer de nom/prix).
- `unit_price`, `tax_amount`, `total` sont déjà snapshotés en 016.

## RPCs (security definer, `set search_path = public`)

| RPC | Rôle |
| --- | ---- |
| `pos_product_scope_valid` / `pos_table_scope_valid` / `pos_area_scope_valid` / `pos_customer_scope_valid` | Vérifications de portée par établissement |
| `next_pos_order_number` | Numéro `#000001+` / `#000002+`… sous `pg_advisory_xact_lock(est)` |
| `recompute_pos_order_totals` | `subtotal = Σ qty × unit_price`, `tax = Σ tax_amount` (snapshot), remise clampée au sous-total, `total = subtotal − remise + tax` ; resynchronise les lignes |
| `pos_order_payload` | Agrège le résultat créé/update (id, numéro, statut, totaux) |
| `create_pos_order` | Crée la commande + lignes + numéro + totaux, idempotence par `(est, client_operation_id)` |
| `update_pos_order_items` | Remplace les lignes d'une commande `draft`/`open` et recalcule |
| `update_pos_order_details` | Patch `order_type`, `table_id`/`area`, `customer_id`, `notes`, `discount_amount` (portées vérifiées) |
| `transition_pos_order` | **Tous** les changements de statut : `open→confirmed`, `confirmed→open`, `open|confirmed→cancelled`, idempotent, gère l'occupation des tables |

Chaîne de garde commune : `is_super_admin() or has_permission(est, slug)`,
appartenance à l'établissement, statut compatible. Échecs levés comme messages
SQL → `toAuthorizationError` côté client (`order_not_found`,
`order_wrong_status`, `order_bad_transition`, `order_empty`,
`order_invalid_type/table/area/customer`, `order_item_invalid`,
`order_discount_invalid`, `order_discount_forbidden`).

## RLS (migration 057)

- `orders_read` : select si `orders.view` **ou** `pos.access`.
- `orders_member_insert` : insert si `orders.create` (+ `user_id` forcé).
- `orders_member_update` : update si `orders.update` **ou** `orders.cancel`
  (colonne `cancelled_by` autorisée) — les RPC restent la voie normale.
- `order_items_read` / `order_items_member_insert` /
  `order_items_member_update` : mêmes permissions, établi lié.
- Pas de policy delete : la suppression de commandes est bloquée.

## Permissions

Aucun nouveau slug : réutilisation de `pos.access`, `orders.view/create/
update/cancel` (migration 027 + matrice). Le caissier peut consulter
(`orders.view`), créer (`orders.create`), confirmer/attendre/modifier
(`orders.update`) et annuler (`orders.cancel`).

## Couche applicative

- `src/lib/pos/` : types purs, `config.ts` (statuts/types/transitions/
  paramètres), `calculations.ts` (totaux 3 décimales), `order-builder.ts`
  (payloads RPC). **Aucun import serveur** — inclus dans `tsconfig.tests.json`.
- `src/validations/pos.ts` : schémas Zod (création, update lignes, update
  détails, transition, recherche) ; les montants client ne sont **jamais**
  stockés tels quels (recalcul serveur).
- `src/services/pos-service.ts` : lectures (catalogue, réglages `pos.*`,
  commandes ouvertes / récentes, détail, références tables) + écritures via
  RPC.
- `src/features/pos/actions.ts` : server actions (guards `orders.*`,
  audits `order.*`, `revalidatePath("/pos", "/orders")`).
- **Audit** (`src/services/audit.ts`) : `order.created`, `order.updated`,
  `order.type/table/customer/discount_changed`, `order.confirmed`,
  `order.held`, `order.resumed`, `order.cancelled`.
- Pages : `/pos` (POS plein écran, guard `pos.access`) et `/orders`
  (historique récent, guard `orders.view`), navigation gated via
  `pos.access` / `orders.view`.

## Paramètres (groupe `pos`)

| Clé | Défaut | Rôle |
| --- | ------ | ---- |
| `pos.allow_discount` | `true` | Autorise la remise (sinon supprimée et masquée) |
| `pos.require_order_confirmation` | `true` | Crée la commande en `open`, sinon la confirme immédiatement |
| `pos.allow_negative_stock` | `false` | Réservé au contrôle de stock (Phase suivante) |

## Boundary

Hors périmètre Phase 19 : encaissement (paiements, caisse), affichage cuisine,
impression, fidélité, déduction de stock. La sécurité repose sur :
permissions + RLS, RPC security definer comme seule voie d'écriture, Zod côté
serveur, idempotence par `client_operation_id` et hook `set_updated_at`.