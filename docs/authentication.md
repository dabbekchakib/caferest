# Authentification — Supabase Auth (PHASE 05)

Ce document décrit l'architecture d'authentification retenue pour CafeRest :
Supabase Auth (email + mot de passe), gestion de session, protection des routes,
profils utilisateur et localisation complète (fr / en / ar, RTL inclus).

## Principes

- **Supabase Auth uniquement.** Aucune table `password` / `password_hash` /
  `remember_token` : l'intégralité de l'authentification repose sur
  `auth.users` et les tokens émis par Supabase.
- **Email + mot de passe** par défaut. Les schémas et les services sont conçus
  pour accueillir Magic Link / OTP / OAuth avec un refactor minimal (la couche
  `src/lib/auth` ne dépend que d'une petite interface de client).
- **Session = source de vérité.** Le provider client (AuthProvider) se
  synchronise via `onAuthStateChange` ; l'état UI (thème, sidebars) reste dans
  Zustand et n'est jamais stocké ici.
- **Ne jamais faire confiance à un `user_id` fourni par le client.** L'identité
  vient toujours du token rafraîchi (cookie de session).
- **RLS toujours actif.** L'authentification ne désactive aucune politique.

## Organisation des dossiers

| Chemin                               | Rôle                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| `src/lib/auth/auth-types.ts`         | Types structurels (client, user, profil, requête)          |
| `src/lib/auth/auth-service.ts`       | Services DI : sign in/out, profil, reset, update, exchange |
| `src/lib/auth/auth-errors.ts`        | Mapping erreurs Supabase → clés i18n stables               |
| `src/lib/auth/auth-redirect.ts`      | Constantes de routes + garde anti open-redirect            |
| `src/lib/auth/auth-utils.ts`         | Gardes serveur : `requireAuth()`, `getServerUser()`        |
| `src/validations/auth.ts`            | Schémas Zod (messages = clés i18n)                         |
| `src/lib/validation/zod-resolver.ts` | Résolveur React Hook Form traduisant les clés              |
| `src/components/providers/`          | AuthProvider / AuthContext (client)                        |
| `src/components/auth/`               | Vues (connexion, reset, compte désactivé…)                 |
| `src/app/(auth)/`                    | Pages publiques : login, forgot-password, reset-password   |
| `src/app/(dashboard)/layout.tsx`     | Layout protégé (garde serveur + AppShell)                  |
| `src/proxy.ts`                       | Protection des routes (middleware)                         |

## Routes protégées et publiques

- **Publiques** (`src/lib/auth/auth-redirect.ts`) : `/login`,
  `/forgot-password`, `/reset-password` (`AUTH_ROUTES`) + `/account-disabled`
  (`PUBLIC_ROUTES`).
- **Infrastructure** jamais redirigée : préfixes `/api/` et `/auth/callback`.
- **Tout le reste exige une session** : les visiteurs anonymes sont renvoyés
  vers `/login?...&redirect=<chemin>` pour revenir d'où ils venaient.
- Un utilisateur authentifié sur une page `AUTH_ROUTES` est renvoyé vers
  `/dashboard`.

`src/proxy.ts` exécute `updateSession()` (rafraîchissement du cookie de session
via `@supabase/ssr`) puis applique les redirections. C'est la convention
"proxy" de Next.js 16 (l'ancienne convention `middleware.ts` est dépréciée).

### Garde serveur

Toute page du groupe `(dashboard)` est protégée côté serveur :

```ts
// src/app/(dashboard)/layout.tsx
const { user, profile } = await requireAuth();
```

`requireAuth()` (dans `src/lib/auth/auth-utils.ts`) :

1. récupère l'utilisateur depuis le cookie rafraîchi (`auth.getUser()`) ;
2. redirige vers `/login` sans session ;
3. charge le profil ; si `is_active = false`, redirige vers `/account-disabled` ;
4. renvoie `{ user, profile }` aux pages enfants.

## Sessions et clients

| Client             | Fichier                          | Usage                                  |
| ------------------ | -------------------------------- | -------------------------------------- |
| Browser (client)   | `src/lib/supabase/client.ts`     | AuthProvider, formulaires, déconnexion |
| Server             | `src/lib/supabase/server.ts`     | `requireAuth()`, Server Components     |
| Proxy / middleware | `src/lib/supabase/middleware.ts` | Rafraîchissement du token (cookie)     |

- `updateSession()` renvoie `{ response, isAuthenticated }` : il ne redirige
  jamais lui-même, `src/proxy.ts` applique la politique.
- Après connexion / déconnexion, `router.refresh()` force la recharge du cache
  afin que les Server Components reconstruisent leur état.

## Profils utilisateur

Table `profiles` (migration `00000000000013_users_profiles_roles.sql`) :

| Colonne            | Rôle                         |
| ------------------ | ---------------------------- |
| `id`               | `uuid` = `auth.users.id`     |
| `full_name`        | Nom affiché                  |
| `phone`            | Téléphone                    |
| `avatar_url`       | Avatar                       |
| `preferred_locale` | Locale par défaut (fr/en/ar) |
| `is_active`        | Compte actif/désactivé       |

Un trigger (`on_auth_user_created`) crée automatiquement le profil à la
première connexion. La row est lue via
`.from("profiles").select("*").eq("id", user.id).maybeSingle()` — l'`id`
provient toujours du token, jamais de l'input client. RLS : le profil n'est
lisible que par son propriétaire (migration `00000000000023_rls.sql`).

### Compte désactivé

Une session valide mais avec `is_active = false` est systématiquement
redirigée vers `/account-disabled` (garde serveur **et** vérification après
connexion). La page force la déconnexion pour éviter de laisser un jeton actif.

## Flux d'authentification

1. **Connexion** (`LoginForm`) : `signInWithPassword()` → sur erreur, la clé
   i18n est résolue par `resolveAuthFaultKey()` ; sur succès, le profil est
   chargé puis `isProfileActive()` est vérifié. Cible post-connexion nettoyée
   par `getSafeRedirect()` (anti open-redirect).
2. **Mot de passe oublié** (`ForgotPasswordForm`) :
   `resetPasswordForEmail(email, { redirectTo: origin + /reset-password })`.
   Message de succès générique systématique (pas de fuite de compte).
3. **Réinitialisation** (`ResetPasswordForm`) : si un `code` est présent dans
   l'URL, `exchangeCodeForSession(code)` (PKCE) ; sinon `getSession()`.
   Puis `updatePassword()` et déconnexion automatique → écran de succès.
4. **Déconnexion** : `signOut()` détruit la session (également révocable
   serveur) puis `router.replace("/login")` + `router.refresh()`.

## Formulaires et validation

- **React Hook Form + Zod** uniquement. Pas de `@hookform/resolvers` : un
  résolveur maison `createAuthResolver(schema, translate)` traduit chaque
  message clé i18n dans la locale active au moment du render.
- Les schémas (`src/validations/auth.ts`) ne portent que des **clés** :
  `validation.required`, `validation.invalidEmail`, etc.
- Zod 4 ne préserve pas les `params` personnalisés sur les issues : le
  résolveur relit `issue.minimum` / `issue.maximum` pour injecter `{ min }`
  / `{ max }` dans les libellés (`passwordTooShortCount`).

## Sécurité

- **Aucun secret côté client.** Seuls `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont exposés (toujours la clé dite "publishable").
- Anti open-redirect : `isSafeRedirectPath()` n'accepte que les chemins relatifs
  à un seul `/` (rejette `//host`, `https://`, `javascript:`, `\`, > 2048).
- Toutes les entrées sont validées côté serveur (Zod).
- RLS activée sur toutes les tables métier ; jamais `USING (true)`.

## Tests

Cadre adapté aux outils déjà présents (aucune nouvelle dépendance) :

- Sources de test : `tests/*.test.ts` (node:test + node:assert).
- Compilation CommonJS persistée dans `dist-tests/` via
  `tsconfig.tests.json`, puis exécution : `npm test`
  (`tsc -p tsconfig.tests.json && node --test "dist-tests/tests/*.test.js"`).

Coverage : routes/redirections sûres, mapping des erreurs, services (client
injecté simulé), schémas Zod, résolveur RHF, parité des clés i18n fr/en/ar
pour `auth.json` et `validation.json`.

Cas notables couverts par la suite : `getCurrentProfile` sans session utilise
l'`id` du token ; `maybeSingle()` renvoie un thenable (les builders PostgREST
sont des `PromiseLike`), le type structurel le reflète pour rester acceptable
par de vrais clients Supabase.

## Vérification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Pièges connus

- **Next.js 16** : `searchParams` est une `Promise` (les pages font
  `const params = await searchParams`).
- **Convention proxy** : `src/middleware.ts` est déprécié au profit de
  `src/proxy.ts` (export `proxy` + `config.matcher` inchangés).
- **Typage structurel** : comparer le client Supabase typé complet à une petite
  interface déclenche parfois "Type instantiation excessively deep" ; les
  appels passant de vrais clients utilisent un cast `as unknown as AuthClientLike`.
