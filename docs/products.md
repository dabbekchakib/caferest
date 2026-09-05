# Produits & catalogue (Phase 09)

Catalogue des produits vendus dans un établissement : fiche produit multilingue
(FR maître, EN/AR traduits), classification par catégorie/unité/taxe, tarification
(prix de vente + coût manuel), identification (SKU / code-barres), image dans
Supabase Storage, disponibilité / visibilité POS / vedette / suivi de stock,
tri manuel et statut actif/inactif. Les produits système sont protégés.

## Modèle de données

### `products` (migration 033, évolution de la 007)

| Colonne             | Rôle                                                            |
| ------------------- | --------------------------------------------------------------- |
| `establishment_id`  | Établissement propriétaire (jamais NULL)                        |
| `category_id`       | `products.category_id → categories.id` (`NULL` ok)              |
| `unit_id`           | `products.unit_id → units.id` (unité établissement ou système)  |
| `tax_id`            | `products.tax_id → taxes.id` (même établissement)               |
| `name`              | Nom maître (FR) — valeur de secours finale                      |
| `slug`              | Identifiant textuel unique par établissement                    |
| `sku`               | Référence interne (unique par établissement)                    |
| `barcode`           | Code-barres (unique par établissement)                          |
| `product_type`      | `product` \| `composite` \| `service` (check)                   |
| `price`             | Prix de vente (ex-`sale_price`, `>= 0`)                         |
| `cost`              | Coût (ex-`cost_price`, `>= 0`, manuel pour l'instant)           |
| `short_description` | Description courte maître (FR)                                  |
| `description`       | Description complète maître (FR)                                |
| `is_pos_enabled`    | Visible au POS (ex-`is_sellable`)                               |
| `is_available`      | Disponible à la vente (découple actif vs disponible)            |
| `is_featured`       | Produit vedette                                                 |
| `is_stock_tracked`  | Suivi de stock activé (consommé dans une phase ultérieure)      |
| `sort_order`        | Ordre au sein du groupe de catégorie (pas de 10)                |
| `is_system`         | Produit géré par le système, non modifiable                     |

- Contraintes d'unicité (au niveau établissement) : `sku`, `barcode`, `slug`.
- `q(product_references_valid)` interdit toute référence croisée
  d'établissement (catégorie/taxe du même établissement, unité de
  l'établissement ou unité système globale).
- `trg_products_protect_system` bloque par un utilisateur connecté
  non-super-admin : création de ligne système, suppression d'une ligne système
  et mutation des champs d'identité (`slug`, `establishment_id`, `is_system`)
  d'un produit système. Les écritures de migration / service-role (pas de JWT)
  passent toujours.

### `product_translations` (migration 033)

| Colonne       | Rôle                                         |
| ------------- | -------------------------------------------- |
| `product_id`  | `ON DELETE CASCADE`                          |
| `locale`      | `fr` \| `en` \| `ar` (check)                 |
| `name`        | Nom dans la langue (non vide)                |
| `short_description` / `description` | Description courte / complète |

- `UNIQUE(product_id, locale)` — une entrée par langue et par produit.
- **Le nom maître EST le français** : les traductions ne stockent que `en` +
  `ar`. Chaîne de repli d'affichage : **fr ou locale inconnue → maître (FR) ;
  en → en ?? maître ; ar → ar ?? en ?? maître**.
- En écriture, un `name` vide signale « supprimer la ligne de traduction ».

### Politiques RLS

Lecture : `is_super_admin()` ou `belongs_to_establishment(establishment_id)`.
Écritures : gated par `has_permission(est, 'products.<create|update|delete>')`
et restreintes aux lignes `is_system = false`, avec la garde de références
croisées (`product_references_valid`). `product_translations` hérite de l'accès
de son produit via sous-requête.

## Stockage des images (`product-images`, migration 035)

- Bucket **public** (rendu direct) ; lecture ouverte.
- Écritures authentifiées avec isolation par chemin :
  `establishments/{estId}/products/{productId}/{timestamp}_{safeName}`.
  La politique vérifie le préfixe `establishments` + UUID + appartenance de
  l'établissement (`storage.foldername(name)` + regex avant cast `::uuid`).
- Validation serveur : `image/jpeg`, `image/png`, `image/webp`, ≤ 2 Mo.
  Upload/remplacement + suppression via `upload/removeProductImage`.

## Permissions (RBAC)

Module `products`, **7 slugs** (`view/create/update/delete/update-price/
update-status/reorder`) — catalogués dans la migration 034 (+ seeds antérieurs),
`PERMISSION_SLUGS`, les locales `permissions.json`, les matrices
`SYSTEM_ROLE_DEFAULT_PERMISSIONS` et le test `authorization.test.ts`.
Matrices : admin/super_admin (catalogue complet), manager
(7/7 : lecture + création + édition + suppression + prix + statut + tri),
cashier et accountant (lecture seule).

## Flux applicatif

- Pages : `/products` (vue tableau par défaut + bascule cartes, filtres
  catégorie / type / statut / disponibilité / POS / vedettes, recherche
  FR/EN/AR + slug + SKU + code-barres, pagination client),
  `/products/create`, `/products/[id]` (détail + sections futures recette /
  stock / historique / ventes en placeholders), `/products/[id]/edit`.
  Chaque page passe par `requirePagePermission` + `requireCurrentEstablishment`.
- Server actions (`src/features/products/actions.ts`) : schema Zod →
  `requirePermission` → service → `writeAudit` → `revalidatePath("/products")`
  (+ `"/products/[id]"` en édition/statut/prix). Actions : create (avec image),
  update (avec image / `removeImage`), delete, `setProductStatus` (champs
  `is_active|is_available|is_pos_enabled|is_featured`), `updateProductPrice`,
  `reorderProducts` (`sort_order = n × 10`), `searchProducts` (sélecteur).
- Traductions : `toTranslationRows` (en/ar) transforme les saisies ; un `name`
  vide vide la ligne.
- Résolution multilingue : `resolveProductName / resolveProductShortDescription /
  resolveProductDescription` (repli par locale) utilisée dans les vues, cartes
  et messages.
- Sélecteur produit (`ProductSelector`) : recherche débouncée via
  `searchProductsAction`; `searchProducts(est, query, { locale, limit })`
  → `ProductSelectorEntry[]` (réutilisable par le POS et l'éditeur de composés).

## Erreurs métier

`SYSTEM_PRODUCT_PROTECTED`, `PRODUCT_SLUG_EXISTS`, `DUPLICATE_SKU`,
`DUPLICATE_BARCODE`, `PRODUCT_IN_USE` — codes + clés i18n dans `errors.ts` et
`authorization.json` (mapping DB `system_product_protected`,
`products_establishment_sku_key`, `products_establishment_barcode_key`,
`products_establishment_slug_key`).

## Vérification

`scripts/verify-products.sql` confirme : table `product_translations`, colonnes
renommées + nouvelles, contraintes `price/cost`, trigger de protection système,
politiques RLS (products + traductions), permissions `products.*` (7) + matrices
(manager 7/7, cashier & accountant lecture seule), bucket `product-images` +
politiques, et le seed démo sur l'établissement par défaut (10 produits dont 2
composites + 30 traductions).

## Tests

`node --test tests/products.test.ts` (via `npm test`) : slugify/`uniqueSlug`,
groupement des traductions, résolution par locale (repli fr→en→maître),
constantes de type/locale, formatage prix/décimales (locale-stable), schémas
Zod (création/édition/prix/statut/tri, coût/prix négatifs rejetés, coercition de
chaînes numériques, UUID), mapping des erreurs DB. Parity locale fr/en/ar
étendue au namespace `products`.

## Limites (hors périmètre Phase 09)

Le coût est saisi manuellement : le calcul automatique (recettes + ingrédients +
rendement) et le `is_stock_tracked` concret (mouvements, stock, consommation
POS) arriveront dans les phases suivantes. `ProductSelector` est prêt mais pas
encore consommé par le POS. Le `product_type = 'composite'` n'a pas encore
d'éditeur de recette.
