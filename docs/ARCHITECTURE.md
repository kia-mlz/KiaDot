# KiaDot architecture decision

Public brand: **KiaDot / کیادات**. Code, packages, database role, and routes stay
`kia` / `@kia./` so existing data and imports keep working. Display copy, site
settings, and this document use KiaDot.

## Decision

Keep the **modular monolith**: one Next.js app (`apps/group`), one NestJS API
(`apps/api`), one PostgreSQL database, six department packages under `kia./`.
Do not split into microservices or a second auth system. The API shell is the
only place that may compose department packages. Departments never import each
other (ESLint). Cross-department work goes through:

1. `@kia./shared` contracts (types, grading, prices)
2. `@kia./platform` services (identity, settings, media, email, events)
3. `apps/api/src/group/contracts` — the shell reads both sides and writes
   platform-owned link rows (`LessonMaterialLink`, `CommunityShare`)
4. Domain events on `EventBusService` (`dedupeKey` makes handling idempotent)

Disabling a department flips `DepartmentRegistry.enabled`. That department's
API returns 404 and its routes call `notFound()`. Other departments stay up.

## Folder ownership

| Path | Owner |
| --- | --- |
| `apps/group` | Web shell: landing, auth UI, central home, admin, all department routes |
| `apps/api/src/group` | Platform shell: auth, admin, commerce, SMS, search, registry, billing, contracts, notifications |
| `apps/api/prisma` | One schema. Models are namespaced by comment; departments do not query each other's tables |
| `packages/platform` | Kernel: Prisma client, guards, events, settings, media, email |
| `packages/permissions` | Platform roles + department role vocabulary |
| `packages/brand` | Colour tokens (never hard-code a department hex) |
| `packages/shared` | Contracts shared by every department |
| `kia./kia-academy` | LMS, games, exams, activities, certificates, class sessions |
| `kia./kia-event` | Competitions, challenges, bootcamps, live events |
| `kia./kia-work` | Jobs, freelance projects, specialist profiles |
| `kia./kia-material` | Studio UI (package root) + catalog API (`./catalog`) |
| `kia./kia-lab` | Research projects, experiments, ideas |
| `kia./kia-community` | Posts, groups, messages, moderation |

## Route map

Path-based, no subdomains. Registry `path` is the public entry and can change
without a code rename of the package.

| Department | Public entry | Panel |
| --- | --- | --- |
| Academy | `/academy`, `/courses`, `/learn`, `/education` | `/dashboard`, `/academy/panel` |
| Work | `/work` → `/freelance` | `/work/panel` |
| Material | `/material` | `/material/panel` |
| Labs | `/labs` | `/labs/panel` |
| Events | `/events` | `/events/panel` |
| Community | `/community` | `/community/panel` |
| Platform | `/` landing, `/home` central dashboard, `/login` | `/admin` |

## API

- Global prefix: `/api` (unversioned, matching the existing surface).
- New ecosystem routes live beside the current ones (`/api/work`, `/api/labs`,
  `/api/material`, `/api/events/live`, `/api/community`, `/api/academy/activities`,
  `/api/departments`, `/api/contracts`, `/api/billing`, `/api/notifications`).
- Breaking changes to an existing route are not allowed in this iteration.
- Validation: Nest `ValidationPipe` whitelist. Clients receive generic messages.

## Auth

One `User` for the whole ecosystem.

- Learners: phone OTP (`POST /api/auth/otp/request` + `verify`) then profile.
- Email + password: `POST /api/auth/login`. `POST /api/auth/register` creates an
  unverified mailbox account and rejects duplicates with 409.
- Forgot / reset / change password, avatar, logout, refresh cookie.
- Staff TOTP 2FA is implemented. Learner 2FA is not offered.
- Sessions: refresh-token rows (`GET /api/auth/sessions`, revoke by id).
- Login attempts: `LoginEvent`.
- `SUSPENDED`, `BANNED`, and `deletedAt` are rejected on login and on every JWT
  validation. Deactivate sets `deletedAt` and revokes refresh tokens.

## Permissions

Defined in `@kia./permissions` (not a second system).

- Platform: `LEARNER`, `ADMIN` (matrix), `SUPER_ADMIN` (full).
- Department roles persist in `DepartmentMembership` (`STUDENT` and `EMPLOYER`
  can both exist on one user). `DepartmentRoleGuard` checks the membership.
  `SUPER_ADMIN` bypasses. A department admin's membership does not authorize
  another department's admin routes.

## Events

`group.user.registered`, `group.user.profile_completed`, `group.payment.completed`,
`events.registration.created`, `academy.course.completed`, plus
`academy.certificate.issued`, `events.live.registered`, `labs.result.published`,
`community.post.created`. Payloads are ids and timestamps. Optional `dedupeKey`
is stored in `DomainEventReceipt`; a duplicate key skips handlers.

## Shared vs department-owned

Shared kernel files (schema, platform guards, auth, design tokens, landing,
central admin, app shell) are edited in one place. Department packages own
their controllers and must not import sibling departments.
