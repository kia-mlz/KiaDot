# Development guide

Node `>=22.13`, pnpm `11.19.0` (Corepack). Read `AGENTS.md` for the Cloud VM
notes: Postgres is not started by `pnpm dev`, and `pnpm dev` itself expects
Infisical.

## Local run

```bash
sudo pg_ctlcluster 16 main start
cp apps/api/.env.example apps/api/.env
cp apps/group/.env.example apps/group/.env.local
pnpm install
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev:local
```

Web: http://localhost:3000  
API: http://localhost:3001/api/health

Build order if you compile by hand: `@kia./permissions` and `@kia./brand`,
then `@kia./shared`, then `@kia./platform`, then department packages, then the
API. `pnpm build:libs` does this. `kia-material` builds the studio types and
the catalog Nest output (`tsconfig.catalog.json`).

## Where to edit

- Shared kernel (schema, auth, guards, landing, central admin): one person at
  a time. See `docs/ARCHITECTURE.md`.
- A department feature: the matching `kia./kia-*` package and the route group
  under `apps/group/src/app`. Do not import another `kia./` package.
- New cross-department behaviour: `apps/api/src/group/contracts` or a domain
  event with a `dedupeKey`.

## Conventions

UI copy is Persian by default (`apps/group/src/i18n/messages/fa.ts`). Code and
docs are English. Prices are stored in IRR and shown as تومان. Department
colours come from `@kia./brand` (`brandToken` on the registry is a CSS
variable name, not a hex).

Do not commit `.env`, `.env.local`, or `uploads/`.
