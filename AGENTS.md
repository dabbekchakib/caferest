# AGENTS.md — CafeRest

## Project Overview

CafeRest is a POS/ERP application for cafes and restaurants built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

- **Frontend**: Next.js (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime, RLS)
- **Validation**: Zod
- **Forms**: React Hook Form
- **State**: Zustand
- **Icons**: Lucide React
- **Deployment**: Vercel

## Code Rules

- Always use TypeScript strict mode. Never use `any`, `@ts-ignore`, or `@ts-nocheck`.
- Use App Router exclusively. Never use Pages Router.
- Use Supabase as the sole data access layer. Never connect directly to PostgreSQL.
- Never install or use Prisma.
- Never expose server-side secrets in `NEXT_PUBLIC_*` environment variables.
- Always use `@/` import alias for project imports.
- Prefer Server Components by default. Add `"use client"` only when necessary.
- Use Zod for all validation schemas.
- Use React Hook Form for all forms.
- Follow Tailwind CSS utility-first approach. Avoid custom CSS when possible.
- All components must be TypeScript, accessible, and responsive.
- Never commit secrets, keys, tokens, or credentials to git.

## File Organization

- `src/app/` — App Router pages and layouts
- `src/components/ui/` — Reusable UI components (Button, Card, Input, Badge)
- `src/components/layout/` — Layout components
- `src/components/shared/` — Shared components
- `src/features/` — Feature modules (auth, pos, products, etc.)
- `src/lib/` — Utilities, constants, config, Supabase clients
- `src/services/` — Service layer
- `src/hooks/` — Custom React hooks
- `src/stores/` — Zustand stores
- `src/types/` — TypeScript type definitions
- `src/validations/` — Zod validation schemas
- `src/locales/` — Translation files (fr, en, ar)
- `supabase/migrations/` — SQL migration files

## Database

- All tables are created via Supabase PostgreSQL.
- Every table must have RLS policies defined.
- Migrations are versioned SQL files in `supabase/migrations/`.
- Types are generated from the Supabase schema.

## Security

- Never store secrets in client-side code.
- Always use RLS on Supabase tables.
- Validate all inputs server-side with Zod.
- Use Supabase middleware for session management.

## Git

- Never commit `.env`, `.env.local`, or any file containing secrets.
- Commit messages should be concise and descriptive.
