# CafeRest

POS/ERP application for cafes and restaurants.

## Tech Stack

- **Next.js 16** — App Router, React 19, TypeScript
- **Tailwind CSS v4** — Utility-first CSS
- **Supabase** — PostgreSQL, Auth, Storage, Realtime, RLS
- **Zod** — Schema validation
- **React Hook Form** — Form management
- **Zustand** — State management
- **Lucide React** — Icons
- **Vercel** — Deployment

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project

### Installation

```bash
git clone <repo-url>
cd caferest
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm run start
```

### Lint & Type Check

```bash
npm run lint
npm run typecheck
npm run format:check
```

## Project Structure

```
src/
├── app/              # App Router pages and layouts
├── components/       # UI components, layout, shared
├── features/         # Feature modules (auth, pos, products, etc.)
├── lib/              # Utilities, constants, Supabase clients
├── services/         # Service layer
├── hooks/            # Custom React hooks
├── stores/           # Zustand stores
├── types/            # TypeScript type definitions
├── validations/      # Zod validation schemas
├── locales/          # Translation files (fr, en, ar)
└── styles/           # Additional styles
supabase/
├── migrations/       # Versioned SQL migrations
└── seed.sql          # Seed data
```

## Supabase

### Database Migrations

Migrations are stored in `supabase/migrations/` as versioned SQL files.

### TypeScript Types

Types are generated from the Supabase schema and stored in `src/types/database.ts`.

### Row Level Security

All tables use Supabase RLS policies for security.

## Deployment (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## License

Private — All rights reserved.
