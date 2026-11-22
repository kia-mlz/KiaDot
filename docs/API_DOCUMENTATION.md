# API

Base URL: `http://localhost:3001/api` (the web app proxies `/api` to this).
Routes are unversioned. New ecosystem routes sit beside the existing auth,
course, exam, payment, and admin routes. Existing routes were not renamed.

Auth: `Authorization: Bearer <accessToken>` except public GETs. Refresh uses
the HttpOnly cookie set by login.

## Identity

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Email account. 409 if the email exists. Does not start a session. |
| POST | `/auth/login` | public | Email + password. 401 on failure. Rejects suspended, banned, and deactivated users. |
| POST | `/auth/otp/request` | public | Phone OTP. `devCode` only when `OTP_DEV_EXPOSE` and not production. |
| POST | `/auth/otp/verify` | public | Verifies the code and issues a session. |
| POST | `/auth/verify-email` | public | Consumes the emailed token. |
| POST | `/auth/forgot-password` | public | Always a generic response. |
| POST | `/auth/reset-password` | public | |
| POST | `/auth/change-password` | user | |
| GET | `/auth/sessions` | user | Refresh-token rows (devices). |
| POST | `/auth/sessions/:id/revoke` | user | |
| POST | `/auth/deactivate` | user | Sets `deletedAt`, revokes refresh tokens. |

## Registry and content

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/departments` | public |
| GET | `/departments/:key` | public |
| PATCH | `/departments/:key` | `SUPER_ADMIN` |
| GET | `/content` | public |
| PATCH | `/content` | `SUPER_ADMIN` |

A disabled department makes that department's API return 404.

## Departments

- Academy activities: `GET/POST /academy/activities`, `POST /academy/activities/:id/open`, `POST /academy/activities/:id/submit`, `POST /academy/certificates/claim`, `GET/POST /academy/sessions`, `POST /academy/sessions/:id/attend`.
- Labs: `GET/POST /labs/projects`, members, phases, experiments, tasks, reports, visibility, `GET/POST /labs/ideas`, `POST /labs/ideas/:id/score`, `POST /labs/ideas/:id/convert`.
- Work: `GET/POST /work/jobs`, `POST /work/jobs/:id/apply`, `PUT /work/profile`, `PUT /work/skills`, freelance project/proposal/hire/milestone routes, `POST /work/milestones/:id/invoice`.
- Material: `GET/POST /material/resources`, `POST /material/resources/:id/files` (multipart `file`), `POST /material/resources/:id/checkout`, `POST /material/files/:id/download`, `GET /material/downloads/:token`, `GET /material/creator/stats`.
- Live events: `GET/POST /events/live`, `GET /events/live/:slug`, `POST /events/live/:slug/register`, cancel, check-in by ticket code.
- Community: `GET/POST /community/posts`, like, comments, follow, groups, messages, block, report. Moderation requires a community role or `SUPER_ADMIN`.

Existing course, exam, educational-game, competition, bootcamp, checkout, and
admin routes remain in place.

Academy lesson motion studio (course editors only, except the learner reads):
`/admin/academy/motion/*` for storyboard, render jobs, and publish;
`GET /academy/motion/lessons/:lessonId` and `POST /academy/motion/lessons/:lessonId/progress`
for a published video. See [`MOTION_STUDIO.md`](MOTION_STUDIO.md).

## Contracts, billing, notifications

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/contracts/work-profile/:userId` | Published Work profile plus platform skills and Academy certificates. |
| POST | `/contracts/lessons/:lessonId/materials` | Attaches a Material resource id to a lesson. |
| POST | `/contracts/events/:eventId/share` | Shares a published live event into Community. |
| POST | `/contracts/labs/:projectId/publish` | Publishes a lab result into Community. |
| GET | `/billing/invoices` | Caller’s invoices. |
| POST | `/billing/invoices/:id/checkout` | Confirms only after the provider verifies. Dev provider is labeled `dev` and is refused in production. |
| POST | `/billing/invoices/:id/refund` | `SUPER_ADMIN`. Records the refund. Does not call the gateway. |
| GET | `/notifications` | 401 for guests. |
| POST | `/notifications/:id/read` | Owner only. |

`GET /api/uploads/material/*` is rejected. File bytes are served only through
the short-lived download token.
