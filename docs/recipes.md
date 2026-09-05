# Recettes & composition des produits (Phase 11)

Composition des produits à partir d'ingrédients (et de sous-recettes) pour un
établissement : fiche multilingue (FR maître, EN/AR traduits), versionnage
(v1, v2…), cycle de vie (draft / active / inactive / archived), une recette
active par défaut pour chaque produit, coût préparatoire calculé en lecture
à partir du coût par unité de base des ingrédients (normalisation via le moteur
de conversions des unités). Ne génère **jamais** de mouvements de stock
(l'inventaire est un module ultérieur) et ne stocke pas le coût calculé.
Les recettes système sont protégées.

## Modèle de données

### `recipes` (migration 041, évolution des 009/023)

| Colonne              | Rôle                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `establishment_id`   | Établissement propriétaire (jamais NULL)                             |
| `product_id`         | `recipes.product_id → products.id` (`ON DELETE CASCADE`)             |
| `name`               | Nom maître (FR) — valeur de secours finale                           |
| `description`        | Description maître                                                   |
| `yield_type`         | `exact_consumption` \| `batch_yield` \| `range_yield` (check 009)    |
| `default_yield`      | Rendu par défaut (`> 0`)                                             |
| `yield_unit_id`      | Unité de rendement (même établissement ou unité système globale)     |
| `preparation_time`   | Minutes de préparation (`>= 0` ou NULL)                              |
| `is_active`          | Drapeau d'activité                                                   |
| `version`            | N° de version (`>= 1`, déf. 1)                                       |
| `status`             | `draft` \| `active` \| `inactive` \| `archived` (check)              |
| `is_default`         | Recette active par défaut du produit (`uq_recipes_default_per_product`) |
| `notes`              | Notes internes                                                       |
| `is_system`          | Recette gérée par le système, non modifiable                         |
| `sort_order`         | Ordre d'affichage (pas de 10)                                        |
| `created_by` / `updated_by` | Auteurs des mutations                                        |

- Unicité du couple (établissement, produit, version) :
  `uq_recipes_establishment_product_version`. Une **seule** recette active peut
  être par défaut par produit : index partiel `uq_recipes_default_per_product`
  sur `(establishment_id, product_id) where is_default = true and status = 'active'`.
- Liste d'activité : `status = active` ⇒ `is_active = true`
  (`RECIPE_STATUSES` dans `src/lib/recipes/types.ts`).
- `recipe_references_valid()` interdit les références croisées
  d'établissement (produit du même établissement, unité de l'établissement ou
  unité système globale) — utilisée par les politiques RLS.
- `trg_recipes_protect_system` bloque côté authentifié, hors super-admin :
  création d'une recette système, suppression d'une recette système et mutation
  de `status` / `version` / `establishment_id` / `product_id` sur une recette
  système. Les écritures de migration / service-role passent toujours.

### `recipe_items` (migration 041, évolution de 009)

| Colonne              | Rôle                                                        |
| -------------------- | ----------------------------------------------------------- |
| `recipe_id`          | `ON DELETE CASCADE`                                         |
| `ingredient_id`      | Matière première consommée (NULL si sous-recette)           |
| `sub_recipe_id`      | Sous-recette incorporée (`ON DELETE SET NULL`)              |
| `quantity`           | Quantité (`> 0`) dans l'unité                               |
| `unit_id`            | Unité de la quantité (même établissement ou système global) |
| `waste_percentage`   | Perte en préparation (`0..100`)                             |
| `notes`              | Note de ligne                                               |
| `sort_order`         | Ordre dans la recette (pas de 10)                           |

- Contrainte **XOR** `recipe_items_reference_xor` : exactement une des deux
  références `ingredient_id` / `sub_recipe_id`. Le schéma de validation
  (`createRecipeSchema`) applique le même XOR, + l'unicité de référence au sein
  d'une recette (`recipeItemsSchema` rejette une ligne dupliquée).
- `recipe_item_references_valid()` étend la garde anti-références croisées aux
  lignes (ingrédient / sous-recette / unité du même établissement).

### `recipe_translations` (migration 041)

`UNIQUE(recipe_id, locale)`, locale `fr|en|ar`, `name` non vide.
**Le nom maître EST le français** : les traductions ne stockent que `en` + `ar`.
Chaîne de repli d'affichage : **fr ou locale inconnue → maître (FR) ;
en → en ?? maître ; ar → ar ?? en ?? maître** (résolveurs
`resolveRecipeName / resolveRecipeDescription / resolveRecipeNotes`). En
écriture, un `name` vide signale « supprimer la ligne de traduction ».

## Politiques RLS (migration 041)

Lecture (`recipes_read`, héritée pour items/translations) :
`is_super_admin()` ou `belongs_to_establishment(establishment_id)`.
Écritures : gated par `has_permission(est, 'recipes.<create|update|delete>')`
et restreintes aux lignes `is_system = false`, avec les gardes de références
croisées (`recipe_references_valid` / `recipe_item_references_valid`).
`recipe_items` et `recipe_translations` héritent de l'accès de leur recette via
sous-requête.

## Permissions (RBAC)

Module `recipes`, **7 slugs** (`view/create/update/delete/activate/archive/
cost-view`) — catalogués dans la migration 042 (`recipes.cost-view`, avec un
trait d'union : chaque slug suit strictement `<module>.<action>`), dans
`PERMISSION_SLUGS`, les locales `permissions.json`, les matrices
`SYSTEM_ROLE_DEFAULT_PERMISSIONS`, le test `authorization.test.ts` et le seed
démo. Matrices : `super_admin`/`admin` (catalogue complet — migration 045
réconcilie les systèmes avec l'intégralité du catalogue, cf. ci-dessous),
`manager` (7/7), `stock_manager` (`view` + `cost-view` + gestion catalogue via
027), `accountant` et `purchasing` (`view` + `cost-view`), `kitchen` / `bar`
(lecture seule). `recipes.cost-view` est la permission qui conditionne le coût
préparatoire et la section coût de la fiche ; l'activ'action d'une recette
(`draft/inactive → active` + élection du défaut) et l'archivage sont réservés
aux rôles de gestion autorisés par `SYSTEM_ROLE_DEFAULT_PERMISSIONS`.

### Migration 045 (réconciliation système)

027/029 accordaient à `super_admin`/`admin` l'intégralité du catalogue au
moment du seed. Les seeds modulaires ultérieurs (031 catégories, 034 produits,
038 ingrédients, 042 recettes) n'ayant octroyé que les rôles métier,
`admin`/`super_admin` accusaient un retard de 14 slugs. `045_sync_system_role_catalog`
re-accorde (insertion seule, idempotente, jamais de retrait) tout le catalogue
aux deux rôles système actifs — conforme à `SYSTEM_ROLE_DEFAULT_PERMISSIONS`.

## Coût préparatoire (lecture seule, non stocké)

`rawRecipeCost` (`src/lib/recipes/costing.ts`, pur et testé) somme les
contributions des lignes :

- ligne ingrédient : `calculateIngredientCostPerBaseUnit(...)` (coût d'achat
  converti vers l'unité de base, ex. 70 TND/kg → 0,070 TND/g) × quantité,
  avec la perte (%) prise en compte ;

- ligne sous-recette : coût de la sous-recette × quantité (prise en lot).

`getRecipeCost(est, recipe)` résout le coût en lecture pour les vues (liste,
détail) ; `null` / `missing` quand un ingrédient n'a pas d'unité de base, de
coût d'achat ou qu'une unité n'est pas convertible. Exemple : 10 g de café à
70 TND/kg → **0,700 TND**. La normalisation `g → kg` s'appuie sur le graphe
orienté des conversions (`src/lib/units/graph.ts`) ; la détection de cycle des
sous-recettes, bornée à `MAX_SUBRECIPE_DEPTH = 20`, est dans
`src/lib/recipes/graph.ts`.

## Flux applicatif

- Pages : `/recipes` (liste, filtre statut, bascule grille/tableau, coût en
  fonction de `recipes.cost-view`), `/recipes/create`, `/recipes/[id]` (détail,
  coût, versions), `/recipes/[id]/edit`. Chaque page passe par
  `requirePagePermission` + `requireCurrentEstablishment`.
- Server actions (`src/features/recipes/actions.ts`) : schema Zod →
  `requirePermission` → service → `writeAudit` → `revalidatePath`. Actions :
  `createRecipe` (détermine la version suivante, lance `draft`), `updateRecipe`
  (mise à jour fiche + lignes + traductions), `archiveRecipe` (soft delete +
  jamais réutilisée), `deleteRecipe` (archivage si utilisée/défaut, sinon purge),
  `activateRecipe` (statut `active` + `is_active` + élection du défaut, exige
  ≥ 1 ligne), `deactivateRecipe`, `getRecipeCost`.
- Services (`src/services/recipes-service.ts`) : `listRecipes(est, {productId|
  status|...})` (tri, enrichi noms produits/recettes + statut),
  `getRecipe(id)`, `getRecipeCost(est, id)`,
  `listRecipesUsingIngredient(est, ingredientId)` (recettes dont une ligne cite
  l'ingrédient — alimente la section recettes de la fiche ingrédient),
  `createRecipeWithItems`, `updateRecipeWithItems`.
- Fiches intégrées : `ProductRecipeSection` (client) affiche les recettes d'un
  produit (dans `/products/[id]`) et d'un ingrédient (dans `/ingredients/[id]`
  via `listRecipesUsingIngredient`), avec coût conditionné à `recipes.cost-view`
  et accès création à `recipes.create` ; `ProductDetail` et `IngredientDetail`
  acceptent une prop `recipeSection` (placeholder conservé par défaut).
- Éditeur : `IngredientSelector` (recherche débouncée, coût par base + symboles
  d'unités) sature le sélecteur d'ingrédient des lignes ; les unités
  compatibles sont filtrées par `filterUnitsCompatibleWith`.
- Résolution multilingue : `resolveRecipeName` etc. (repli ar → en → maître)
  dans les vues et messages.

## Erreurs métier

`RECIPE_SYSTEM_PROTECTED`, `RECIPE_VERSION_EXISTS`, `RECIPE_CYCLE_DETECTED`,
`RECIPE_TOO_DEEP`, `RECIPE_NOT_FOUND`, `RECIPE_STATUS_TRANSITION`,
`RECIPE_ACTIVE_REQUIRES_ITEMS`, `RECIPE_DEFAULT_UNIQUE` — codes + clés i18n dans
`errors.ts` et `authorization.json` (mapping DB `system_recipe_protected`,
`uq_recipes_establishment_product_version`, `uq_recipes_default_per_product`,
checks `recipes_*_check`, contraintes de `recipe_items`).

## Vérification

`scripts/verify-recipes.sql` confirme la structure (colonnes 041, index
partiels, contraintes), les gardes de références, le trigger de protection
système, les politiques RLS et les matrices de permissions. En environnement
déployé, la vérification passe par l'API PostgREST (clé service-role) : tables
`recipes` / `recipe_items` / `recipe_translations`, unités renseignées des
ingrédients, permissions `recipes.*` + matrices, et le seed démo.

## Seed démo (migrations 043 + 044)

Sur l'établissement `00000000-0000-0000-0000-000000000001`, produit
`espresso` : **Espresso** v1 (active + par défaut, 10 g de café à
70 TND/kg → 0,700 TND) et **Espresso intensif** v2 (draft, 11 g), chacune avec
traductions fr/en/ar. Le seed original (043) était une no-op en environnement
déployé : il cherchait l'unité globale `gram` alors que les slugs des unités
système sont les symboles (`g`, `kg`, `l`, `ml`, `pc`) ; de même, le seed des
ingrédients (040) cherchait `kilogram`/`litre`/`piece` et laissait les unités
des ingrédients NULL. `044_fix_demo_reference_units` corrige les unités (base
`g` / achat `kg` pour les masses, base `ml` / achat `l` pour les volumes,
`pc` pour les pièces) et re-joue le seed des recettes avec la bonne unité —
idempotent sur `(établissement, produit, version)`.

## Tests

`node --test tests/recipes.test.ts` (via `npm test`) : constantes statut/locale,
groupement des traductions, résolution par locale, détection de cycles
(auto-boucle, sous-recette dépendante, transition transitive), normalisation
d'unités (`g ↔ kg` via le moteur), coût par ligne (10 g × 0,070 = 0,700 ;
sous-recettes en lot ; `null` sur données manquantes), coût brut et marquage
des lignes non valorisables, schémas Zod (XOR ingrédient/sous-recette, refus des
quantités ≤ 0 et pertes hors 0..100, refus des références dupliquées, coercition
numérique), mapping des erreurs DB. Parity locale fr/en/ar étendue aux
namespaces `recipes`, `recipeForm`, `recipeBuilder`, `recipeDetails`,
`recipeStatus`, `recipeActions`, `recipeValidation`, `recipeCost`,
`recipeVersions`, `recipeYield` ; `tsconfig.tests.json` inclut
`src/lib/recipes/*.ts` + `src/validations/recipes.ts`.

## Limites (hors périmètre Phase 11)

Pas de mouvement de stock (une recette ne génère jamais d'écriture), pas
d'inventaire / approvisionnement / POS, pas d'utilisation du rendement
(`recipe_yields` intact, `yield_type` déclaratif), pas de persistance du coût
(lecture seule), pas de moteur d'écarts théoriques / coût avancé. La section
« rendement et production » des fiches reste en placeholder.