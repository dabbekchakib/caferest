# Rendement / Yield Management (Phase 12)

Le **rendement** décrit combien de portions, verres, tasses, bouteilles ou
unités vendables peuvent être produites à partir d'une recette. C'est la base
mathématique des futures consommations théoriques d'ingrédients lors d'une
vente : **rien n'écrit en stock** dans cette phase.

Le rendement appartient à une **version précise** de recette (une ligne
`recipes` EST une version). Modifier une recette ne doit jamais écraser le
rendement d'une autre version.

```
Produit → Recette → Recipe Items → Ingrédients → Quantité + unité
        → Rendement → Production / portions théoriques → Consommation théorique future → Stock (phase future)
```

## Modèle de données

### `recipe_yields` (migration 046, évolution de 009)

| Colonne            | Rôle                                                        |
| ------------------ | ----------------------------------------------------------- |
| `recipe_id`        | Version de recette propriétaire (`unique`, jamais doublonnée) |
| `yield_type`       | Modèle de rendement (5 valeurs, check)                      |
| `input_quantity`   | Quantité d'entrée du lot (`> 0`)                            |
| `input_unit_id`    | Unité d'entrée (même établissement ou unité système)        |
| `output_quantity`  | Sorties produites pour un lot (`> 0`)                       |
| `output_unit_id`   | Unité de sortie (`unit_id` historique renommé)              |
| `minimum_yield`    | Borne min (range)                                            |
| `standard_yield`   | Valeur standard (`> 0`)                                     |
| `maximum_yield`    | Borne max (range)                                            |
| `yield_percentage` | Taux de transformation (`0 < x ≤ 100`)                      |
| `notes`            | Notes internes                                               |
| `is_active`        | Rendement actif (default true)                               |
| `created_by` / `updated_by` | Auteurs des mutations                                |

- `recipe_yields_unique_recipe` : **un** rendement par version de recette.
- Checks : `recipe_yields_type_check` (5 modèles), `input/output/standard`
  positifs, `percentage` borné (0,100], `order_check` (`min ≤ max`) et
  `standard_range_check` (`min ≤ standard ≤ max`).
- Le `standard_yield` sert de compteur de sortie pour les affichages
  hérités Phase 11 (`recipes.default_yield` est synchronisé à l'écriture).
- Contrainte NOT NULL de la Phase 09 : `recipes.yield_type` et
  `recipes.default_yield` **ne peuvent pas être NULL** ; la suppression du
  rendement réinitialise donc le header recette à ses valeurs neutres
  (`exact_consumption` / `1`), jamais à NULL.

### Modèles (5)

| `yield_type`          | Signification                                        | Exemple                          |
| --------------------- | ---------------------------------------------------- | -------------------------------- |
| `exact_consumption`   | 1 lot → nombre fixe de portions                      | 1 L → 10 verres                  |
| `batch_yield`         | 1 lot → nombre défini d'unités                       | 5 L de sirop → 50 bouteilles     |
| `range_yield`         | 1 lot → entre min et max, avec un standard           | 1 kg → 70 / 85 / 100 cafés       |
| `portion_yield`       | 1 production découpée en portions identiques         | 1 gâteau → 12 parts              |
| `percentage_yield`    | Perte/transformation, seul l'utilisable compte       | 1 kg de fruits → 70 % de pulpe   |

## Unités

- Réutilise le moteur Phase 07 (`units`, `unit_conversions`,
  `convertUnitValue`, catalogue `getCatalogCached`). **Aucun deuxième moteur.**
- Entrée et sortie vivent dans des **espaces sémantiques différents**
  (`1 kg` d'espresso → `85 cups`) : le moteur ne force jamais une conversion
  entrée→sortie. La compatibilité d'**établissement** des unités référencées
  est garantie par `recipe_yield_references_valid()` (même établissement ou
  unité système globale) au niveau RLS.
- Le calculateur de production normalise la **quantité disponible** vers
  l'unité d'entrée via `convertUnitValue` : `5000 g` → `5 kg` →
  `425 cups`. Les unités non convertibles (`5 L` pour un rendement en `kg`)
  produisent `null` — jamais une erreur applicative.

## Calculs

Moteur pur et sans effet : `src/lib/yields/calculations.ts`.

### Consommation par portion (entrée par sortie)

```text
consumptionPerOutput = input_quantity / sorties_par_lot
```

Exemple café : `1 kg / 85 = 0,0117647 kg` → `11,76 g` par tasse (le nombre
de décimales est **conservé** en interne, seule l'affichage est borné).

### Production théorique

```text
productionFor = quantité_disponible_normalisée / input_quantity × sorties_par_lot
```

Exemple : 5 kg de café à 85 tasses/kg → `5 / 1 × 85 = 425 tasses`.
Le `selection` (`min` / `standard` / `max`, défaut `standard`) choisit la
borne utilisée pour un rendement `range`.

### Pourcentage

```text
effectiveYieldRate = yield_percentage / 100
consumption ratio   = 1 / rate   (entrée nécessaire pour 1 sortie)
production         = quantité_normalisée × rate
```

### Recette vs rendement

La **recette** décrit la composition d'une unité vendue (`10 g` de café par
espresso dans `recipe_items`) ; le **rendement** décrit combien d'unités sont
produites depuis une quantité (`1 kg → 85 cafés`). Les deux sont conservés
distinctement et ne se contredisent jamais : le rendement est une référence
de production/lot, la recette une référence de composition.

### Exemple de référence — Mojito (batch 10 verres)

```text
500 ml rhum  ÷ 10 = 50 ml / verre
200 ml citron ÷ 10 = 20 ml / verre
200 ml sirop  ÷ 10 = 20 ml / verre
 50 g menthe  ÷ 10 =  5 g / verre
```

Couvert par le test « mojito reference » dans `tests/yields.test.ts`.

## Sous-recettes

La consommation théorique (`calculateTheoreticalConsumption`) résout
récursivement les `recipe_items.sub_recipe_id` à travers les sous-recettes
Phase 11 avec :

- profondeur max `MAX_SUBRECIPE_DEPTH` (20), puis refus ;
- détection de cycle (`visited`) → `cycleRefused: true` ;
- validation d'établissement à chaque lecture (RLS + scope serveur) ;
- aucun cycle `A → B → C → A` accepté.

## Validation

- **Zod** (`src/validations/yields.ts`) : forme des champs (`recipeId` uuid,
  quantités positives, borne max, pourcentage borné, notes ≤ 1500, range
  ordonné) + payloads d'action avec `establishmentId` imposé côté serveur.
- **Domaine** (`src/lib/yields/validation.ts`) : complétude modèle
  (chaque modèle exige ses champs), `min ≤ standard ≤ max`,
  `0 < percentage ≤ 100`.
- **Contraintes DB** : checks notifiés via `DB_CONSTRAINT_TO_CODE`
  (`src/lib/authorization/errors.ts`).

## Sécurité

- **RLS** (migration 046) : lecture héritée de la recette propriétaire ;
  écritures vérifient la permission `recipe_yields.{create,update,delete}`
  et `recipe_yield_references_valid()` (recette, unités du même
  établissement ou système).
- **Server actions** (`src/features/recipes/yield-actions.ts`) : chaîne
  `authentification → établissement courant → permission → Zod →
  validation métier → Supabase → audit → revalidation`.
- L'`establishmentId` est **toujours** injecté serveur, jamais accepté du
  client.
- Permissions : `recipe_yields.view/create/update/delete` (module déclaré
  dans `src/lib/authorization/permissions.ts`, seed `027`/`046`). Role
  super_admin & admin : catalogue complet ; manager : édition complète ;
  stock_manager / accountant / purchasing / kitchen / bar : lecture.
- Événements d'audit : `recipe_yield.created/updated/deleted/activated/
  deactivated/calculated`. Le `calculated` n'est journalisé que lors d'un
  calcul explicite (jamais à chaque frappe de l'UI).

## Interface

Intégrée au Recipe Builder (détail et édition d'une recette) — pas de page
séparée :

- **Section Rendement** (modèle, quantité d'entrée + unité, production +
  unité, bornes min/standard/max ou pourcentage, notes, actif/inactif).
- **Aperçu** : consommation par portion, production par lot, coût théorique
  estimatif (coût Phase 11 ÷ rendement — jamais présenté comme coût réel).
- **Consommation théorique par portion** : tableau Ingrédient | Lot |
  Par portion, avec sous-recettes imbriquées.
- **Calculateur de production** : quantité disponible + unité + choix
  min/standard/max → production théorique, calcul instantané côté client
  (purement mathématique, aucun stockage ni écriture).
- RTL actif en arabe ; formatage via `src/lib/yields/formatter.ts`
  (`Intl.NumberFormat`, langue, séparateurs, 3 décimales d'affichage
  maximum — la précision interne reste non arrondie).

## Limites de la phase — ce que cette phase NE fait PAS

- aucune déduction de stock, aucun mouvement, aucun inventaire ;
- aucun achat ni réception ;
- aucune consommation réelle ni automatique lors d'une vente ;
- aucune connexion au POS / commandes / caisse / KDS ;
- aucun stock théorique ni valorisation d'écarts ;
- aucun coût réel historique (le coût affiché est un coût théorique
  estimatif).

## Prochaines étapes

- Consommation théorique branchée sur les ventes (POS → recette → rendement →
  ingrédients).
- Projection de production selon le stock disponible et processus d'achat.
- Coût réel par production (récapitulation des lots consommés).

## Fichiers clés

- `supabase/migrations/00000000000046_recipe_yields.sql`
- `src/lib/yields/types.ts`, `calculations.ts`, `validation.ts`, `formatter.ts`
- `src/validations/yields.ts`
- `src/services/yields-service.ts`
- `src/features/recipes/yield-actions.ts`
- `src/features/recipes/recipe-yield-section.tsx`
- `src/features/recipes/yield-calculator.tsx`
- `tests/yields.test.ts`