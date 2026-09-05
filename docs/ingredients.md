# Ingrédients & matières premières (Phase 10)

Catalogue de matières premières et d'ingrédients consommés par les produits d'un
établissement : fiche multilingue (FR maître, EN/AR traduits), classification par
catégorie/type, achat (unité + quantité + coût d'achat), coût par unité de base
(recalculé via le moteur de conversions des unités), perte (%),
identification (SKU / code-barres), image dans Supabase Storage (bucket
`ingredient-images`), tri manuel et statut actif/inactif, suivi de stock déclaratif
(le stock n'est pas stocké ici — prépare le module d'inventaire). Les
ingrédients système sont protégés.

## Modèle de données

### `ingredients` (migration 037, évolution des 008/009/011/012)

| Colonne             | Rôle                                                            |
| ------------------- | --------------------------------------------------------------- |
| `establishment_id`  | Établissement propriétaire (jamais NULL)                        |
| `category_id`       | `ingredients.category_id → categories.id` (`NULL` ok)           |
| `base_unit_id`      | Unité de base (cible de normalisation du coût)                  |
| `purchase_unit_id`  | Unité d'achat (avec `purchase_quantity` + `purchase_cost`)      |
| `name`              | Nom maître (FR) — valeur de secours finale                      |
| `slug`              | Identifiant textuel unique par établissement                    |
| `sku`               | Référence interne (unique par établissement)                    |
| `barcode`           | Code-barres (unique par établissement)                          |
| `ingredient_type`   | `raw_material` \| `semi_finished` \| `packaged` \| `consumable` \| `other` (check) |
| `purchase_quantity` | Quantité achetée par lot (`> 0`, déf. 1)                        |
| `purchase_cost`     | Coût d'achat du lot (`>= 0`, déf. 0)                            |
| `waste_percentage`  | Perte constatée en préparation (`0..100`, déf. 0)               |
| `is_stock_tracked`  | Suivi de stock déclaratif (ex-`is_stockable`, déf. true)        |
| `sort_order`        | Ordre au sein du groupe de catégorie (pas de 10)                |
| `is_system`         | Ingrédient géré par le système, non modifiable                  |
| `image_url`         | URL publique dans `ingredient-images`                           |

- Contraintes d'unicité (au niveau établissement) : `sku`, `barcode`, `slug`
  (`uq_ingredients_establishment_*`). La colonne `is_stockable` a été renommée
  `is_stock_tracked` (`DROP DEFAULT, RENAME` — unique référence dans la 008).
- `ingredient_references_valid()` interdit toute référence croisée
  d'établissement (catégorie du même établissement, unité de l'établissement ou
  unité système globale). Les FKs `recipe_items.ingredient_id` (ON DELETE
  CASCADE), `purchase_order_items.ingredient_id`, `stock_items` et
  `stock_movements` (ON DELETE SET NULL / CASCADE) existent déjà depuis les
  phases 03/04/05.
- `trg_ingredients_protect_system` bloque par un utilisateur connecté
  non-super-admin : création d'une ligne système, suppression d'une ligne
  système et mutation de `slug`, `establishment_id`, `is_system`. Les écritures
  de migration / service-role (pas de JWT) passent toujours.

### `ingredient_translations` (migration 037)

| Colonne          | Rôle                        |
| ---------------- | --------------------------- |
| `ingredient_id`  | `ON DELETE CASCADE`         |
| `locale`         | `fr` \| `en` \| `ar` (check) |
| `name`           | Nom dans la langue (non vide) |
| `description`    | Description dans la langue  |

- `UNIQUE(ingredient_id, locale)` — une entrée par langue et par ingrédient.
- **Le nom maître EST le français** : les traductions ne stockent que `en` +
  `ar`. Chaîne de repli d'affichage : **fr ou locale inconnue → maître (FR) ;
  en → en ?? maître ; ar → ar ?? en ?? maître**.
- En écriture, un `name` vide signale « supprimer la ligne de traduction ».

### Politiques RLS

Lecture : `is_super_admin()` ou `belongs_to_establishment(establishment_id)`.
Écritures : gated par `has_permission(est, 'ingredients.<create|update|delete>')`
et restreintes aux lignes `is_system = false`, avec la garde de références
croisées (`ingredient_references_valid`). `ingredient_translations` hérite de
l'accès de son ingrédient via sous-requête.

## Stockage des images (`ingredient-images`, migration 039)

- Bucket **public** (rendu direct) ; lecture ouverte.
- Écritures authentifiées avec isolation par chemin :
  `establishments/{estId}/ingredients/{ingredientId}/{timestamp}_{safeName}`.
  La politique vérifie le préfixe `establishments` + UUID + appartenance de
  l'établissement (`storage.foldername(name)` + regex avant cast `::uuid`).
- Validation serveur : `image/jpeg`, `image/png`, `image/webp`, ≤ 2 Mo.
  Upload/remplacement + suppression via `upload/removeIngredientImage`.

## Permissions (RBAC)

Module `ingredients`, **7 slugs** (`view/create/update/delete/update-cost/
update-status/reorder`) — catalogués dans la migration 038, `PERMISSION_SLUGS`,
les locales `permissions.json`, les matrices `SYSTEM_ROLE_DEFAULT_PERMISSIONS`,
le test `authorization.test.ts` et le seed démo. Matrices : admin/super_admin
(catalogue complet), manager et stock_manager (7/7), accountant
(`ingredients.view` + `ingredients.update-cost`), cashier (lecture seule),
kitchen / bar / purchasing (lecture seule héritée).

## Coût par unité de base

`calculateIngredientCostPerBaseUnit` (`src/lib/ingredients/cost.ts`, pur et
testé) calcule `base_cost = purchase_cost / converted_quantity` en convertissant
la quantité d'achat vers l'unité de base via l'OrientedGraph des conversions
(`convertUnitValue`). Exemple : 1 kg de café à 70 TND → 0,070 TND/g.
Retourne `null` sans unité de base / d'achat ou quand les unités ne sont pas
convertibles. La résolution sert les vues (listes, cartes, détail, formulaire en
direct) via `getIngredientCostPerBaseUnit(est, ingredient)`.

## Flux applicatif

- Pages : `/ingredients` (vue tableau par défaut + bascule cartes, filtres
  catégorie / type / statut / suivi de stock, recherche FR/EN/AR + slug + SKU +
  code-barres, pagination client sur `listIngredients`),
  `/ingredients/create`, `/ingredients/[id]` (détail + sections futures stock /
  recettes en placeholders), `/ingredients/[id]/edit`. Chaque page passe par
  `requirePagePermission` + `requireCurrentEstablishment`.
- Server actions (`src/features/ingredients/actions.ts`) : schema Zod →
  `requirePermission` → service → `writeAudit` → `revalidatePath("/ingredients")`
  (+ `"/ingredients/[id]"` en édition/statut/coût). Actions : create (avec
  image), update (avec image / `removeImage`), delete (garde d'usage
  `ingredient_references`), `setIngredientStatus` (champs
  `is_active | is_stock_tracked`), `updateIngredientCost` (permission
  `ingredients.update-cost`), `reorderIngredients` (`sort_order = n × 10`),
  `searchIngredients` (sélecteur).
- Traductions : `toTranslationRows` (en/ar) transforme les saisies ; un `name`
  vide vide la ligne.
- Résolution multilingue : `resolveIngredientName / resolveIngredientDescription`
  (repli ar → en → maître) utilisée dans les vues, cartes et messages.
- Sélecteur ingrédient (`IngredientSelector`) : recherche débouncée via
  `searchIngredientsAction`; `searchIngredients(est, query, { locale, limit })`
  → `IngredientSelectorEntry[]` avec coût par base et symboles d'unités
  (réutilisable par l'éditeur de recettes).

## Erreurs métier

`SYSTEM_INGREDIENT_PROTECTED`, `INGREDIENT_SLUG_EXISTS`, `INGREDIENT_IN_USE` —
codes + clés i18n dans `errors.ts` et `authorization.json` (mapping DB
`system_ingredient_protected`, `uq_ingredients_establishment_slug` +
`ingredients_establishment_slug_key`, plus les variantes
`uq/…_sku|barcode` → `DUPLICATE_SKU|DUPLICATE_BARCODE`). Les tests couvrent les
deux formes de noms d'index (nom d'index vs nom de contrainte rapporté par
PostgREST).

## Vérification

`scripts/verify-ingredients.sql` confirme : table `ingredient_translations`,
colonnes ajoutées + `is_stockable` renommé, index uniques, checks
(type/quantité/coût/perte), trigger de protection système,
`ingredient_references_valid`, politiques RLS (ingrédients + traductions),
permissions `ingredients.*` (7) + matrices (manager & stock_manager 7/7,
cashier lecture seule, accountant view+update-cost), bucket
`ingredient-images` + politiques, et le seed démo sur l'établissement par défaut.

## Seed démo (migration 040)

10 ingrédients sur l'établissement `00000000-0000-0000-0000-000000000001` :
Café en grains (70 TND/kg → 0,070 TND/g), Lait (1,2 TND/L), Sucre (1,4 TND/kg),
Citron, Orange, Menthe, Rhum, Sirop de sucre, Eau, Glace — avec traductions
fr/en/ar et unités système (kg, L, pièce) + conversions existantes.

## Tests

`node --test tests/ingredients.test.ts` (via `npm test`) : slugify/`uniqueSlug`,
groupement des traductions, résolution par locale (repli ar→en→maître),
constantes de type/locale, formatage coût/quantité/perte + `parseDecimal`,
moteur de coût par base (kg→g 0,070 ; même unité ; `null` sans unité ou
incompatible ; robustesse JSON), schémas Zod (création/édition/coût/statut/tri,
coûts négatifs et quantité nulle rejetés, coercition de chaînes numériques,
UUID), mapping des erreurs DB. Parity locale fr/en/ar étendue au namespace
`ingredients` ; `tsconfig.tests.json` inclut `src/lib/ingredients/*.ts`.

## Limites (hors périmètre Phase 10)

Pas de stock réel (`is_stock_tracked` est déclaratif), pas de recettes /
`recipe_items`, pas de mouvements, inventaire, achats POS, fournisseurs
(module `suppliers` séparé). Le coût de base n'est affiché qu'en lecture : il
sera consommé par l'édition de recettes et le calcul automatique du coût des
produits composés. `IngredientSelector` est prêt mais pas encore consommé.