# Catégories & sous-catégories (Phase 08)

Organisation hiérarchique des produits par établissement : arbre de catégories
illimité (profondeur libre, anti-cycle), noms multilingues, tri manuel,
déplacement, statut actif/inactif, icônes Lucide, couleurs et image dans
Supabase Storage. Les catégories système sont protégées.

## Modèle de données

### `categories` (migration 030, hérite de la 005)

| Colonne            | Rôle                                                        |
| ------------------ | ----------------------------------------------------------- |
| `establishment_id` | Établissement propriétaire (jamais NULL)                    |
| `parent_id`        | Catégorie parente (`NULL` ⇒ racine, `ON DELETE SET NULL`)   |
| `name`             | Nom maître (FR) — valeur de secours finale                  |
| `slug`             | Identifiant textuel unique par établissement                |
| `description`      | Description maître (FR)                                     |
| `icon`             | Nom d'icône Lucide (kebab-case, JSON-safe)                  |
| `color`            | Couleur hexadécimale (`#rgb` \| `#rrggbb`)                  |
| `image_url`        | URL publique de l'image (`category-images` bucket)          |
| `sort_order`       | Ordre au sein d'un groupe de frères (pas de 10)             |
| `is_active`        | Masque la catégorie dans les sélecteurs opérationnels       |
| `is_system`        | Catégorie gérée par le système, non modifiable              |

- `uq_categories_establishment_slug` garantit l'unicité `(est, slug)`.
- `categories_no_self_parent_check` interdit `parent_id = id`.
- `trg_categories_validate_cycle` (migration 030) rejette tout parentage qui
  refermerait une boucle (CTE récursif), message `category_cycle`.
- `trg_categories_protect_system` bloque par un utilisateur connecté
  non-super-admin : création de ligne système, suppression d'une ligne système
  et mutation des champs d'identité (`slug`, `parent_id`, `is_system`,
  `establishment_id`) d'une catégorie système.
  Les écritures de migration / service-role (pas de JWT) passent toujours.

### `category_translations`

| Colonne       | Rôle                                               |
| ------------- | ------------------------------------------------- |
| `category_id` | `ON DELETE CASCADE`                               |
| `locale`      | `fr` \| `en` \| `ar` (check)                      |
| `name`        | Nom dans la langue (non vide)                     |
| `description` | Description dans la langue                        |

- `UNIQUE(category_id, locale)` — une entrée par langue et par catégorie.
- Chaîne de repli d'affichage : **locale active → fr → en → name (maître)**.
- En écriture, un `name` vide signale « supprimer la ligne de traduction ».

### Politiques RLS

Lecture : `is_super_admin()` ou `belongs_to_establishment(establishment_id)`.
Écritures : gated par `has_permission(est, 'categories.<create|update|delete>')`
et restreintes aux lignes `is_system = false` (les catégories système ne sont
modifiables que par super-admin). `category_translations` hérite de l'accès de
sa catégorie parente via sous-requête.

## Stockage des images (`category-images`, migration 032)

- Bucket **public** (rendu direct dans les menus) ; lecture ouverte.
- Écritures authentifiées avec isolation par chemin :
  `establishments/{estId}/categories/{categoryId}/{timestamp}_{safeName}`.
  La politique vérifie le préfixe `establishments` + UUID + appartenance de
  l'établissement (`storage.foldername(name)` + regex avant cast `::uuid`).
- Validation serveur : `image/jpeg`, `image/png`, `image/webp`, ≤ 2 Mo.

## Permissions (RBAC)

Nouveau module `categories`, 5 slugs (`view/create/update/delete/reorder`)
— catalogués dans la migration 31, `PERMISSION_SLUGS`, les locales
`permissions.json`, la matrice `SYSTEM_ROLE_DEFAULT_PERMISSIONS` et le test
`authorization.test.ts`. Matrices : admin/super_admin (catalogue complet),
manager (5/5), stock_manager et purchasing (lecture seule).

## Flux applicatif

- Pages : `/categories` (vue arborescence par défaut + bascule tableau),
  `/categories/create` (pré-remplie via `?parentId=`), `/categories/[id]/edit`.
  Chaque page passe par `requirePagePermission` + `requireCurrentEstablishment`.
- Server actions (`src/features/categories/actions.ts`) : schema Zod →
  `requirePermission` → service (slug refusé en doublon, cycle refused, enfants,
  réf. produits) → `writeAudit` → `revalidatePath("/categories")`.
- Déplacement via modale (sélecteur d'arbre excluant soi-même + descendants),
  `CATEGORY_CYCLE` si le service/DB détecte une boucle.
- Réorganisation via boutons monter/descendre sur les frères
  (permission `categories.reorder`, persistance `sort_order = n × 10`).
- Recherche sur noms FR/EN/AR + slug, filtre de statut, compteurs de
  sous-catégories, badges système/inactif.
- Résolution de noms multilingues : `resolveCategoryName` (repli actif→fr→en→
  maître) utilisée dans les vues, sélecteur parent et messages.

## Erreurs métier

`SYSTEM_CATEGORY_PROTECTED`, `CATEGORY_CYCLE`, `CATEGORY_HAS_CHILDREN`,
`CATEGORY_IN_USE`, `DUPLICATE_SLUG` — codes + clés i18n dans `errors.ts` et
`authorization.json` (mapping DB `category_cycle`, `system_category_protected`).

## Vérification

`scripts/verify-categories.sql` confirme : table `category_translations`,
colonnes `icon/color/is_system`, triggers anti-boucle + protection système,
politiques RLS (categories + traductions), permissions `categories.*`, rôle
matrices et catégories système duptilées sur l'établissement par défaut.

## Tests

`node --test tests/categories.test.ts` (via `npm test`) : slugify, construction
d'arbre et tri, aplatissement (profondeur + chemin), collecte de sous-arbres,
détection de cycles, ordre suivant, résolution des traductions (repli), mapping
des erreurs DB. Parity locale fr/en/ar étendue au namespace `categories`.

## Limites (hors périmètre Phase 08)

Aucune fiche produit, ingrédient, recette, stock ni référence aux catégories
dans le POS. Les phases suivantes consommeront `listCategories` +
`resolveCategoryName` pour les sélecteurs opérationnels.