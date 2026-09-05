# Authorization — RBAC (PHASE 06)

Ce document décrit le système d'autorisation de CafeRest : permissions, rôles,
RGPD-friendly users management, RLS et le service d'autorisation côté serveur.

## 1. Concepts

- **Permission** : unité d'accès atomique, identifiée par un `slug`
  (`<module>.<action>`, ex. `orders.cancel`). Le catalogue est défini dans
  `supabase/migrations/00000000000027_seed_permissions.sql` et sa copie
  TypeScript dans `src/lib/authorization/permissions.ts` (doit rester en
  phase — tests dédiés).
- **Rôle** : porteur d'un niveau de hiérarchie et d'un jeu de permissions.
  Un rôle **système** (`is_system = true`, `establishment_id IS NULL`) est
  partagé par tous les établissements ; un rôle **personnalisé**
  (`establishment_id` renseigné) est scopé à un établissement.
- **Attribution** : `user_roles(user_id, role_id, establishment_id)` — un
  utilisateur peut avoir plusieurs rôles **par établissement**.
- **Permissions effectives** : union des permissions des rôles actifs dans
  l'établissement courant, via la fonction `user_get_permissions`.

## 2. Hiérarchie

Chaque rôle système a un `level` (plus élevé = plus puissant) :

| Code           | Level |
| -------------- | ----- |
| super_admin    | 100   |
| admin          | 80    |
| manager        | 60    |
| stock_manager  | 55    |
| accountant     | 50    |
| purchasing     | 45    |
| cashier/waiter/kitchen/bar | 40 |
| custom (défaut) | 10  |

Règles d'autorité (refus par défaut) :

- Un utilisateur ne peut **attribuer/retirer** qu'un rôle dont le niveau est
  **strictement inférieur** au sien (`canManageLevel(actor, target)` =
  `actor > target`), sauf `super_admin`.
- Un utilisateur ne peut pas modifier **son propre** statut, poste ou rôle
  (garde `SELF_MODIFICATION`).
- Impossible de retirer/désactiver/supprimer le **dernier admin actif** d'un
  établissement (garde `LAST_ADMIN`, RPC `user_count_active_admins`).
- `super_admin` = toutes les permissions partout ; capacités
  cross-établissement réservées à l'app.

## 3. Répertoire de permissions (56 slugs / 17 modules)

Modules : `dashboard, users, roles, settings, products, ingredients, recipes,
inventory, suppliers, purchases, orders, pos, cash_register, customers,
reports, notifications, audit`.

Le slug `audit_logs.view` appartient logiquement au module `audit` (alias
géré dans la matrice UI).

## 4. Modèle de données

Tables (migration 024, RLS 023/026/027) :

- `roles(id, name, code, description, level, is_system, is_active, establishment_id)`
- `permissions(id, slug, name, module)`
- `role_permissions(role_id, permission_id)` — N:M
- `user_roles(user_id, role_id, establishment_id)` — N:M scopé
- `profiles(id, full_name, phone, is_active)` — miroir de `auth.users`
- `audit_logs(...)` — journal immuable des actions privilégiées

## 5. RLS

Toutes les tables d'autorisation ont RLS actif. Helpers (fonctions
security-definer, dans la migration 026) :

| Fonction | Rôle |
| -------- | ---- |
| `is_super_admin()` | capacité globale |
| `belongs_to_establishment(est_id)` | membre actif |
| `has_permission(est_id, slug)` | permission dans un établissement |
| `has_permission_anywhere(slug)` | permission dans n'importe quel établissement |
| `user_get_permissions(p_user_id, p_est_id)` | permissions effectives d'un user |
| `user_get_role_codes(p_user_id, p_est_id)` | codes de rôles d'un user |
| `user_get_max_level(p_user_id, p_est_id)` | niveau max d'un user |
| `user_count_active_admins(p_est_id, p_exclude_user_id)` | garde dernier-admin |
| `user_is_profile_active(p_user_id)` / `current_profile_is_active()` | statut compte |

Politiques clés :

- `roles_read` : système visible partout + rôles de l'établissement du membre.
- `roles_member_insert/update/delete` : gated par `roles.create|update|delete`.
- `user_roles_member_insert` : require `users.create|invite|update` + membre +
  `r.level < user_get_max_level(...)` + jamais `super_admin`.
- `role_permissions_write` : gated par `roles.update` de l'établissement.
- `permissions_read` : dispo pour qui peut gérer roles/users.
- Triggers : `trg_protect_profile_self_status`, `trg_protect_system_roles`,
  `trg_user_roles_validate_scope`.

Vérification : `scripts/verify-rbac.sql` (relances mots par mot via psql).

## 6. Côté serveur

`src/services/authorization.ts` construit un **contexte par requête**
(caché avec React `cache()` — layout, pages, actions et services partagent une
seule évaluation) :

```
{ userId, email, fullName, isSuperAdmin, memberships,
  currentEstablishmentId, roles, permissionSlugs, maxRoleLevel }
```

- `requirePermission` / `requireAnyPermission` / `requireAllPermissions` →
  **throw** sur refus.
- `requirePagePermission(slug)` → **redirect** vers `/login` ou `/dashboard`.
- `hasPermission` / `hasAnyPermission` / `hasAllPermissions` → booléen.
- `requireCurrentEstablishment()` → id (cookie `NEXT_ESTABLISHMENT` validé).
- `assertManageableLevel`, `assertUserManageable`, `assertActiveAdminExists`.

### Établissement courant

Le cookie `NEXT_ESTABLISHMENT` (serveur, httpOnly) désigne l'établissement
d'action. `setCurrentEstablishmentAction` valide l'appartenance puis
`revalidatePath("/", "layout")` pour rafraîchir le contexte et les pages.

### Clients

- **Client session** (RLS) : lectures/écritures scopées — rôles, user_roles,
  role_permissions.
- **Client admin / service-role** (`createAdminClient`, import `server-only`) :
  provisionnement utilisateurs (invite, status, delete) et lecture plate des
  profils. Il **contourne volontairement RLS** : toute entrée doit d'abord
  passer les gardes du service (`requirePermission`, hiérarchie, dernier
  admin, auto-modification), jamais exposé au client.

### Actions serveur

`src/features/{users,roles,establishment}/actions.ts` suivent le même
schéma : zod (keys i18n `validation.*`) → gardes → service → `writeAudit` →
`revalidatePath`. Elles renvoient `ActionResult` (voir
`src/lib/authorization/action-result.ts`) : `{ok, data}` ou
`{ok:false, code, key}` où `key` pointe vers `authorization.errors.*` —
traduite côté client via le traducteur racine.

## 7. Côté client

- `AuthorizationProvider` injecte le contexte serveur (layout
  `(dashboard)`).
- `useAuthorization()` → `{ context, can, canAny, canAll, isSuperAdmin,
  currentEstablishmentId, memberships }`.
- `PermissionGate` / `AnyPermissionGate` masquent les blocs sans permission.

## 8. Pages

| Route | Permission requise | Action |
| ----- | ------------------ | ------ |
| `/users` | `users.view` | invite/status/delete (`users.invite`, `users.update`, `users.delete`) |
| `/users/[id]` | `users.view` | assign/remove rôles (`users.update`), permissions effectives |
| `/roles` | `roles.view` | create/edit/duplicate/toggle/delete (`roles.create`, `roles.update`, `roles.delete`) |
| `/roles/[id]/permissions` | `roles.view` | matrice (`roles.update` pour sauver) |
| `/logs` (à venir) | `audit_logs.view` | journal |

## 9. Tests

`tests/authorization.test.ts` couvre le catalogue, les helpers purs
(`compute.ts`), les erreurs et `ActionResult` sans dépendre de Supabase.
`tests/locale-parity.test.ts` vérifie l'égalité des clés `users/roles/
permissions/authorization` entre fr/en/ar.