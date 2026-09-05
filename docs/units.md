# Unités, conversions & unités de stock (Phase 07)

Référentiel des unités et des relations de conversion entre elles, avec
isolation par établissement, protection des unités du système et un moteur de
conversion pur réutilisable par les phases stock / recettes.

## Modèle de données

### `units`

| Colonne           | Rôle                                                        |
| ----------------- | ----------------------------------------------------------- |
| `establishment_id`| `NULL` ⇒ unité **système** (globale), sinon unité locale     |
| `name`, `symbol`  | Libellé et symbole (ex. `L`, `piece`)                        |
| `slug`            | Identifiant textuel stable                                   |
| `type`            | `mass` \| `volume` \| `count` \| `service` \| `custom`       |
| `precision`       | Nombre de décimales d'affichage                             |
| `is_base`         | Unité de base de la dimension (g, ml, piece)                |
| `is_system`       | Unité gérée par le système, non modifiable                  |
| `is_active`       | Masque l'unité dans les sélecteurs                          |

- `category` (migration 004) est conservé comme alias souple de `type`.
- Unité système = `establishment_id IS NULL` **et** `is_system = true`.
- Index unique partiel `uq_units_system_symbol(symbol)` pour les unités globales.

### `unit_conversions`

| Colonne             | Rôle                                                        |
| ------------------- | ----------------------------------------------------------- |
| `from_unit_id`      | Unité source                                                |
| `to_unit_id`        | Unité cible                                                 |
| `factor`            | `1 from = factor to`                                        |
| `offset`            | Décalage affine (température…) — par défaut `0`             |
| `establishment_id`  | `NULL` ⇒ conversion **système** (globale)                   |
| `is_system`         | Conversion du système, non modifiable                       |
| `is_active`         | Conversion active dans le graphe                            |

- Une seule direction est stockée ; l'**inverse est dérivé** (`A = (B − offset) / factor`).
- `validate_unit_conversion_scope` (trigger) garantit qu'une conversion
  d'établissement ne relie que des unités de ce même établissement (ou
  système) et qu'une conversion système ne référence que des unités globales.
- `protect_system_units` (trigger) empêche la création/suppression/mutation
  d'identité des unités système par un utilisateur connecté non super-admin.

### Politiques RLS

Read : `is_super_admin() OR establishment_id IS NULL OR belongs_to_establishment(establishment_id)`
Write (units.conversions) : gated par `has_permission(est, '<module>.<action>')`.
Le déclencheur `protect_system_units` ne bloque **pas** les écritures de
migration/service (pas de JWT) : seules les mutations d'un utilisateur
connecté non-super-admin sont rejetées.

## Unités et conversions système

| Dimension | Unité de base | Unités                        | Conversions                    |
| --------- | ------------- | ----------------------------- | ------------------------------ |
| Masse     | `g`           | kg, g, mg                     | kg→g ×1000, g→mg ×1000         |
| Volume    | `ml`          | L, cl, ml                     | L→ml ×1000, cl→ml ×10          |
| Quantité  | `piece`       | piece                         | —                              |
| Service   | —             | cup, glass, bottle            | — (conversions métier siphon)  |

Cette liste est idempotente (`on conflict ... do nothing`) et peut évoluer
dans les migrations ultérieures sans toucher aux lignes des établissements.

## Moteur de conversion (`src/lib/units`)

Pur (aucune dépendance réseau) et testé :

- `conversions.ts` — graphe orienté avec inverse dérivé, BFS court-circuité
  (`MAX_CONVERSION_DEPTH = 8`), détection de cycles, conversion affine et
  erreur `INCOMPATIBLE_UNITS` si aucun chemin n'existe.
- `formatter.ts` — `formatQuantity(value, unit, locale)` via `Intl.NumberFormat`.
- `types.ts` — alias des lignes typées Supabase.

Les conversions **métier explicites** (ex. `bottle → ml ×700`) sont autorisées
même entre types différents ; la compatibilité est donc une propriété du
graphe (un chemin existe ou non), jamais une table de règles codée en dur.

## Permissions (RBAC)

Nouveaux modules `units` et `unit_conversions`, 8 slugs
(`view/create/update/delete`) — catalogués dans la migration 29,
`PERMISSION_SLUGS`, les locales `permissions.json` et le test
`authorization.test.ts`. Matrices : admin/super_admin (catalogue complet),
manager (8/8), stock_manager et purchasing (lecture seule).

## Flux applicatif

- Pages : `/units`, `/units/create`, `/units/[id]/edit`, `/unit-conversions`.
  Chaque page passe par `requirePagePermission` + `requireCurrentEstablishment`.
- Server actions (namespace `units` / `unit-conversions` dans
  `src/features/*/actions.ts`) : schéma Zod → `requirePermission` →
  service (vérif. portée + doublons) → `writeAudit` → `revalidatePath`.
- Cache TTL en mémoire (`src/services/units-cache.ts`) invalidé à chaque mutation.
- Widget « convertisseur » sur `/unit-conversions` via `convertPreviewAction`
  (lecture seule, permission `units.view`).

## Erreurs métier

`SYSTEM_UNIT_PROTECTED`, `UNIT_SCOPE`, `INCOMPATIBLE_UNITS`, `UNIT_IN_USE`,
`DUPLICATE_UNIT` — codes + clés i18n dans `errors.ts` et `authorization.json`.

## Vérification

`scripts/verify-units.sql` confirme : 10+ unités système, unités de base g/ml/piece,
conversions enregistrées, triggers et politiques RLS présentes.

## Tests

`node --test tests/units.test.ts` (via `npm test`) : direct/inverse/composite,
off-set, conversion métier, cycles, erreurs incompatibles, formateur.

## Limites (hors périmètre Phase 07)

Aucune table d'ingrédients, fiches techniques, stock, achats, fournisseurs ni
point de vente. Les phases suivantes consommeront le moteur via
`getCatalogCached` + `convertUnitValue`.