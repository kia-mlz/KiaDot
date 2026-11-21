<div align="center">

<img src="apps/group/public/brand/logo.svg" alt="KiaDot — کیادات" width="140" />

# KiaDot · کیادات

**Learn · Work · Create · Connect · Grow**

[![CI](https://github.com/kia-mlz/KiaDot/actions/workflows/ci.yml/badge.svg)](https://github.com/kia-mlz/KiaDot/actions/workflows/ci.yml)
[![E2E](https://github.com/kia-mlz/KiaDot/actions/workflows/e2e.yml/badge.svg)](https://github.com/kia-mlz/KiaDot/actions/workflows/e2e.yml)
[![Security](https://github.com/kia-mlz/KiaDot/actions/workflows/security.yml/badge.svg)](https://github.com/kia-mlz/KiaDot/actions/workflows/security.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.13-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[📄 GitHub Pages mirror](https://kia-mlz.github.io/KiaDot/)**

</div>

---

**KiaDot (کیادات)** is the public name of this platform. Packages, the database,
and routes stay `kia` so existing data keeps working. KiaDot is a production-grade
platform for Iranian talent, built around six departments: Kia Academy (learning),
Kia Work (freelancing and hiring), Kia Material (design assets), Kia Event
(contests, bootcamps, live events), Kia Community (people) and Kia Lab (research).
Guests land on a minimal Persian hero, explore **Material Studio**, then follow a guided
journey: phone OTP → profile → free goal assessment → free readiness test → personalized
roadmap → paid bundle checkout → lesson player. The learner experience is entirely
**فارسی / RTL**; staff sign in with email + password and manage everything from a
role-scoped admin panel.

> 💡 The live demo runs in **in-browser demo mode** (`NEXT_PUBLIC_DEMO_MODE=true`): the
> full UI works against mock data with zero backend required — perfect for exploring the
> product before self-hosting. Hosted at <https://kia-academy.dashploy.app> (DashPloy,
> static tier).

## ✨ Highlights

| Area                      | Details                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 🇮🇷 **Persian-first UX**   | Full-fa RTL UI, Iranian phone OTP signup, province/city picker, prices shown in تومان over IRR storage          |
| 🧭 **Adaptive engine**    | Goal assessment → readiness exam grading → per-track roadmap with module levels                                 |
| 🎓 **Lesson player**      | Markdown lessons, video, notes and an HTML/CSS/JS playground                                                    |
| 👛 **Learner panel**      | Wallet, orders/invoices, exams, courses, bootcamp rank, todos, tickets, messages, profile                       |
| 🛡️ **Admin governance**   | `SUPER_ADMIN` vs matrix-limited `ADMIN` permissions, editable test banks, site settings catalog                 |
| 🔍 **SEO-ready**          | Dynamic sitemap/robots, JSON-LD, canonical URLs, OG/Twitter cards, noindex on private routes                    |
| 🔒 **Hardened by design** | Helmet+CSP headers, short-lived split JWT secrets, hardened password hashing, rate limiting, upload allow-lists |

## 🎯 Learner Journey

```
Landing (/) ──► Material Studio (/material)          free, no account
        │
        ▼
Education (/education)      phone OTP (09xxxxxxxxx)  ← always phone-first
        │
        ▼
Profile complete            firstName/city/province/email
        │
        ▼
Assessment (/assessment)    first-goal wizard        free
        │
        ▼
Readiness Test (/readiness/test)   server-graded     free · silent scoring
        │
        ▼
Results (/readiness/results) ─► Roadmap (/roadmap) ──► Checkout ──► /learn
```

## 🏗️ Tech Stack

| Layer    | Technology                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------ |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, lucide-react, local Persian brand font (Pelak FA) |
| Backend  | NestJS 11, Passport JWT, class-validator, @nestjs/throttler, helmet                              |
| Database | PostgreSQL 16 + Prisma ORM 7 (one schema, see [`docs/DATABASE.md`](docs/DATABASE.md))            |
| Shared   | `@kia./shared` — types, banks, grading, entitlements, validators (built first)                   |
| Quality  | ESLint flat config, Prettier, Vitest (shared) + Jest (api), Playwright e2e                       |
| Infra    | Docker multi-stage images, GitHub Actions CI, GH Pages static export (demo mode)                 |

## 📐 Architecture

kia. is a **modular monolith in a pnpm monorepo**: the parent platform owns
identity, navigation, permissions, search, commerce and settings; the six
departments are independent business domains that share the platform instead of
each other.

```text
KiaDot/
├── apps/
│   ├── group/          # Next.js 16 — port 3000, fa locale, proxies /api → API
│   │   ├── src/app/          # route groups: (academy) (work) (material) (events)
│   │   │                     #   (community) (labs) (group) + dashboard/admin
│   │   └── public/brand/     # logos used across the app + this README
│   └── api/            # NestJS 11 — port 3001 under /api (the connection point:
│       │                     #   composes platform + department packages)
│       ├── src/group/        # PLATFORM SHELL: auth · admin · sms · contact ·
│       │                     #   health · support · commerce · search
│       └── prisma/
│           ├── schema.prisma       # 102 models → generates client into platform
│           └── migrations/         # init_baseline + hardening migrations
├── kia./                 # ★ THE SIX DEPARTMENTS — each a separate package
│   ├── kia-academy/     # courses, exams, games, activities, certificates, classes
│   ├── kia-event/       # competitions, challenges, bootcamps, live events
│   ├── kia-work/        # jobs, freelance projects, specialist profiles
│   ├── kia-material/    # Material Studio UI + catalog API (./catalog)
│   ├── kia-lab/         # research projects, experiments, ideas, reports
│   └── kia-community/   # posts, groups, messages, moderation
├── packages/
│   ├── brand/          # @kia./brand — the seven brand tokens (TS + CSS)
│   ├── permissions/    # @kia./permissions — roles · admin matrix · dept taxonomy
│   ├── platform/       # @kia./platform — KERNEL: Prisma client · guards ·
│   │   │               #   decorators · domain events · site-settings · media · email
│   │   └── src/generated/prisma/   # prisma generate output (git-ignored)
│   └── shared/         # @kia./shared — contracts, banks, grading, validators
├── docker/             # entrypoint scripts (wait-for-db, migrate, seed)
├── docs/               # architecture · security · database · development
└── scripts/            # utility tooling
```

### The seven brands

| Brand         | Colour    | Token                     | Department code                                |
| ------------- | --------- | ------------------------- | ---------------------------------------------- |
| Kia           | `#FFC864` | `--group-gold` (reserved) | platform                                       |
| Kia Academy   | `#6464FF` | `--dept-academy`          | `kia./kia-academy/` · `app/(academy)`          |
| Kia Work      | `#6492FF` | `--dept-work`             | `kia./kia-work/` · `app/(work)` → `/freelance` |
| Kia Material  | `#148165` | `--dept-material`         | `kia./kia-material/` · `app/(material)`        |
| Kia Lab       | `#28C793` | `--dept-labs`             | `kia./kia-lab/` · `app/(labs)`                 |
| Kia Event     | `#E32B1B` | `--dept-events`           | `kia./kia-event/` · `app/(events)`             |
| Kia Community | `#FF7344` | `--dept-community`        | `kia./kia-community/` · `app/(community)`      |

Colours are defined **once** in [`packages/brand`](packages/brand) and pinned by
tests on both sides (TypeScript tokens _and_ the stylesheet that consumes them).
On-fill ink is chosen by measured contrast, never by hand.

### Department isolation

- Each department lives in its own workspace package under `kia./` (like a
  standalone project): it may depend on `@kia./platform` (kernel) and
  `@kia./shared`, **never on another department** — enforced by ESLint
  (`no-restricted-imports` in the shared flat config). `apps/api` is the
  connection point that composes the packages in `app.module.ts`.
- Cross-department behaviour goes through shared contracts, the platform
  (search / commerce / identity) or
  **domain events** (`packages/platform/src/common/events` — `group.user.registered`,
  `group.user.profile_completed`, `group.payment.completed`,
  `events.registration.created`, `academy.course.completed`,
  `academy.certificate.issued`, `events.live.registered`,
  `labs.result.published`, `community.post.created`).
  Duplicate handling is skipped when `dedupeKey` is already in `DomainEventReceipt`.
- Global search fans out to registered `SearchableProvider`s and tags every hit
  with its source department (`GET /api/search`).
- One identity across all seven brands — see
  [`docs/architecture/authentication.md`](docs/architecture/authentication.md).

**Why one web app instead of seven?** The departments share a learner journey
(OTP → profile → assessment → roadmap → checkout → lesson player) and one
session. Splitting them into seven Next apps would duplicate auth, i18n and the
checkout flow for a separation that route groups + API domains already give
(§34 modular monolith). Extraction to per-department apps remains possible: each
department is already a self-contained package (own routes, API domain,
token and search provider), so extraction stays a matter of unwiring it from
`app.module.ts`.

**Request flow:** Browser → Next.js (`rewrites /api/*`) → NestJS guards chain
(`JwtAuthGuard` → `RolesGuard` → `AdminAccessGuard`) → DTO validation → Prisma →
PostgreSQL. Lesson videos are served through signed authenticated media URLs — never a
public static dump.

## 🚀 Getting Started

**Prerequisites:** Node **≥ 22.13**, pnpm via Corepack, PostgreSQL 16 (local or Docker).

```bash
git clone https://github.com/kia-mlz/KiaDot.git KiaDot
cd KiaDot

corepack enable && corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile        # also generates the Prisma client

# environment templates (git-ignored)
cp apps/api/.env.example apps/api/.env          # set DATABASE_URL + JWT secrets
cp apps/group/.env.example apps/group/.env.local    # leave NEXT_PUBLIC_DEMO_MODE unset for real API

# Postgres 16. Docker is optional. On a host without Docker:
#   sudo pg_ctlcluster 16 main start
pnpm build:libs                       # permissions → brand → shared → platform → departments
pnpm db:migrate:deploy                # non-interactive; do not use migrate dev in CI
pnpm db:seed                          # catalog + banks + KiaDot registry + starter users

pnpm dev:local                        # web :3000 · api :3001 · health /api/health
```

`pnpm dev` expects Infisical. Use `pnpm dev:local` when secrets are already in
`apps/api/.env`. See [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) and
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

> 🔐 Development seeding creates starter accounts (including admin & learner) for local
> testing only. **No real credentials are ever committed** — production passwords are
> generated at deploy time and rotated; see [`SECURITY.md`](SECURITY.md).

> Playwright one-time setup for e2e:
> `pnpm --filter @kia./group exec playwright install chromium`

### Run modes

| Mode                     | Command                               | Notes                                                           |
| ------------------------ | ------------------------------------- | --------------------------------------------------------------- |
| A — Local Postgres       | steps above with your own DB URL      | no Docker needed                                                |
| B — Docker Postgres only | `pnpm docker:db` then `pnpm dev`      | hot-reload DX (recommended)                                     |
| C — Full Docker stack    | `pnpm docker:setup && pnpm docker:up` | production-like containers                                      |
| D — Static Pages export  | `pnpm build:pages`                    | demo mode, basePath `/KiaDot` (override with `PAGES_REPO_NAME`) |

## 🧰 Scripts

| Root script                             | Description                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                              | Web + API via Infisical. Use `pnpm dev:local` when `.env` is already filled |
| `pnpm build`                            | `build:libs`, then the API, then the web app                                |
| `pnpm build:libs`                       | Workspace libraries only (required before api/web)                          |
| `pnpm lint` / `pnpm typecheck`          | ESLint flat config / tsc project references                                 |
| `pnpm test`                             | Jest (api) + Vitest (shared, brand, permissions, web) suites                |
| `pnpm test:e2e`                         | Playwright end-to-end flows                                                 |
| `pnpm build:pages`                      | Static GitHub Pages demo export (basePath `/KiaDot`)                        |
| `pnpm db:migrate` / `db:migrate:deploy` | Dev migrate / non-interactive apply                                         |
| `pnpm db:seed`                          | Idempotent upserts (catalog, banks, settings, starter users)                |
| `pnpm docker:*`                         | db/db:down/db:reset/setup/up/down/logs/build                                |

## 🔐 Environment Variables

Everything ships as templates — only `*.example` files are committed.

| Variable                                   | Where            | Purpose                                                                                |
| ------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | api `.env`       | PostgreSQL connection string                                                           |
| `JWT_SECRET` / `JWT_REFRESH_SECRET`        | api `.env`       | ≥32 chars; weak values rejected in production by Joi schema                            |
| `CORS_ORIGIN`                              | api `.env`       | Public web origin, credential-safe single origin                                       |
| `OTP_DEV_EXPOSE`                           | api `.env`       | ⚠️ dev-only flag returning `devCode`; must stay unset in production                    |
| `NEXT_PUBLIC_API_URL` / `API_PROXY_TARGET` | web `.env.local` | Same-origin proxy in local/Docker; external origin on static hosting                   |
| `NEXT_PUBLIC_DEMO_MODE`                    | web `.env.local` | `true` → fully in-browser mock API (static hosting: Pages/DashPloy), no backend needed |
| `STRIPE_SECRET_KEY`, SMTP_*                | api `.env`       | Optional providers (IRR gateways ZarinPal/IDPay supported natively)                    |

## 🧪 Quality Gates

- ESLint and `tsc --noEmit` across workspaces
- Jest (API) and Vitest (shared, brand, permissions, web) in CI
- CI (`.github/workflows/ci.yml`) boots PostgreSQL, then migrate, seed, lint, typecheck, test, and build on every push and pull request to `main`
- E2E (`.github/workflows/e2e.yml`) runs the Playwright learner journey against a production build and PostgreSQL
- Security (`.github/workflows/security.yml`) blocks `pnpm audit --prod --audit-level=high`, plus gitleaks and CodeQL
- Dependabot opens weekly dependency, action, and Docker updates

## 🛡️ Security Posture

| Control           | Implementation                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AuthN/AuthZ       | Short-lived access JWT + revocable refresh cookie, each with an independent rotating secret; bcrypt-hashed credentials |
| Rate limiting     | Enforced per-route limits on auth/OTP/global traffic to slow credential abuse                                          |
| Headers           | Helmet (api) + full security headers incl. CSP/HSTS/XFO on Next responses                                              |
| Validation        | class-validator whitelist + forbidNonWhitelisted; Joi env schema at boot                                               |
| Uploads           | MIME allow-lists, size caps, safe-path helper, authenticated media URLs                                                |
| Payment integrity | In-app free confirmation blocked in production; gateway callbacks verify through provider APIs                         |
| Dependencies      | pnpm workspace `overrides` pin patched transitive versions; CI blocks high and critical production advisories          |

Report vulnerabilities responsibly per [`SECURITY.md`](SECURITY.md) — please use private advisories instead of public issues.

## ☁️ Deployment

- **DashPloy (primary demo):** the live demo is published as a static site at
  <https://kia-academy.dashploy.app> (free static tier, `NEXT_PUBLIC_DEMO_MODE=true`,
  no backend). To redeploy, build with `GITHUB_PAGES=true NEXT_BASE_PATH= NEXT_PUBLIC_DEMO_MODE=true pnpm --filter @kia./group build`,
  then push `apps/group/out` via the DashPloy API (`POST /api/v1/deploy`, see
  <https://dashploy.com/llms.txt>).
- **GitHub Pages (mirror):** the `Deploy GitHub Pages` workflow builds the demo app on every push to `main` (`NEXT_PUBLIC_DEMO_MODE=true`, basePath `/KiaDot/`, owner/repo taken from `PAGES_OWNER` + `PAGES_REPO_NAME`) and deploys it automatically — live at <https://kia-mlz.github.io/KiaDot/>. The old `/KIA-GROUP/` address 404s after the rename. Local preview: `pnpm build:pages` → serve `apps/group/out`.
- **Self-host Docker:** hardened multi-stage images (`docker build --target api|web`) running as a non-root `node` user, OCI-labelled, with built-in healthchecks; Compose adds `init: true` and `no-new-privileges` on app containers. See run mode **C** above.
- **CI:** every commit is validated against a live Postgres before merge

## 📚 Documentation

| Document                                                                     | Contents                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                               | Current KiaDot architecture decision                         |
| [`docs/DATABASE.md`](docs/DATABASE.md)                                       | Schema ownership and migration notes                         |
| [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)                     | HTTP surface added for the ecosystem                         |
| [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md)                           | Registration, sessions, verification                         |
| [`docs/AUTHORIZATION.md`](docs/AUTHORIZATION.md)                             | Platform and department permissions                          |
| [`docs/DEPARTMENTS.md`](docs/DEPARTMENTS.md)                                 | The six departments and how they connect                     |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)                                   | Local, production, and single-host deploy                    |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)                                 | Environment variables                                        |
| [`docs/SECURITY.md`](docs/SECURITY.md)                                       | Security controls for this tree                              |
| [`docs/TESTING.md`](docs/TESTING.md)                                         | How to run the suites                                        |
| [`docs/BACKUP_AND_RESTORE.md`](docs/BACKUP_AND_RESTORE.md)                   | Backup and restore                                           |
| [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md)                     | Day-to-day development                                       |
| [`docs/architecture/overview.md`](docs/architecture/overview.md)             | Modular-monolith layout, dependency rule, request flow       |
| [`docs/architecture/departments.md`](docs/architecture/departments.md)       | Per-department routes, API domains, colours, status          |
| [`docs/architecture/authentication.md`](docs/architecture/authentication.md) | One identity: OTP, email, 2FA, sessions                      |
| [`docs/architecture/authorization.md`](docs/architecture/authorization.md)   | Roles, the moderator access matrix, department roles         |
| [`docs/architecture/integrations.md`](docs/architecture/integrations.md)     | How departments talk: contracts, events, platform services   |
| [`docs/database/architecture.md`](docs/database/architecture.md)             | Model ownership map and database rules                       |
| [`docs/security/security-model.md`](docs/security/security-model.md)         | Control-by-control security map                              |
| [`docs/security/threat-model.md`](docs/security/threat-model.md)             | STRIDE per trust boundary + accepted risks                   |
| [`docs/development/setup.md`](docs/development/setup.md)                     | Bootstrap, build order, workspace map                        |
| [`docs/development/testing.md`](docs/development/testing.md)                 | Test layers and priorities                                   |
| [`docs/development/contributing.md`](docs/development/contributing.md)       | Conventions and review checks                                |
| [`docs/AUDIT.md`](docs/AUDIT.md)                                             | The production-readiness audit (findings + status)           |
| [`docs/FINAL_AUDIT_REPORT.md`](docs/FINAL_AUDIT_REPORT.md)                   | Final gate results: lint/typecheck/tests/E2E/audit verdict   |
| [`docs/PRE_LAUNCH_CHECKLIST.md`](docs/PRE_LAUNCH_CHECKLIST.md)               | Operator-only launch blockers (gateway, SMTP, DNS, backups…) |
| [`docs/DEPLOY_RUNBOOK.md`](docs/DEPLOY_RUNBOOK.md)                           | Persian deploy/rollback runbook (Docker + GHCR images)       |
| [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md)                   | Pre-launch security sign-off list                            |
| [`docs/REBUILD_ARCHITECTURE.md`](docs/REBUILD_ARCHITECTURE.md)               | Product shape history (pre-department-split)                 |
| [`docs/ADMIN_SETTINGS_CATALOG.md`](docs/ADMIN_SETTINGS_CATALOG.md)           | Every controllable admin setting                             |
| [`docs/LEARNER_DASHBOARD.md`](docs/LEARNER_DASHBOARD.md)                     | Dashboard section-by-section spec                            |
| [`docs/design-system/MASTER.md`](docs/design-system/MASTER.md)               | UI design system source of truth                             |
| `docs/*.docx`                                                                | Generated guidebook / feature inventory                      |

## 🤝 Contributing

1. Fork → feature branch from `main`
2. Keep all gates green: `pnpm lint && pnpm typecheck && pnpm test`
3. Conventional Commits style (`feat:`, `fix:`…) preferred

## 📄 License

[MIT](LICENSE) © [Kian Malekzadeh](https://github.com/kian-malekzadeh)
