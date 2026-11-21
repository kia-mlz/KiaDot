# Departments

Public brand: KiaDot. Department product names stay Kia Academy, Kia Work,
Kia Material, Kia Lab, Kia Event, and Kia Community. Paths come from
`DepartmentRegistry` and default to:

| Key | Path | Package | What is implemented |
| --- | --- | --- | --- |
| academy | `/academy` (redirects to `/education`), courses at `/courses`, practice at `/academy/practice` | `@kia./kia-academy` | Existing courses, exams, educational games, plus playable activities (quiz, multiple choice, matching, true/false, flashcards, fill-blank), certificates, class sessions |
| work | `/work` redirects to `/freelance` | `@kia./kia-work` | Specialist profile, skills, jobs and applications, freelance projects, proposals, hire, milestones, invoices |
| material | `/material` studio, `/material/catalog` store | `@kia./kia-material` | Existing studio, plus catalog, paid/free/subscription access, private files, timed download, creator stats |
| labs | `/labs` | `@kia./kia-lab` | Projects, members, phases, experiments, tasks, reports, ideas (score and convert), public/private visibility |
| events | `/events`, live events at `/events/live` | `@kia./kia-event` | Existing competitions and bootcamps, plus live events, registration, waitlist, ticket code check-in, speakers, agenda |
| community | `/community` | `@kia./kia-community` | Posts, likes, comments, follows, groups, messages, block, report, restrictions |

## Disable switch

Admin → Departments (`/admin/departments`) or `PATCH /api/departments/:key`
with `{ "enabled": false }`. Only that department 404s. Re-enable with
`{ "enabled": true }`. A missing registry row is treated as enabled so a
fresh database does not take the site down before seed.

## Cross-links

- Academy certificates appear on a published Work profile via
  `GET /api/contracts/work-profile/:userId`.
- A published live event can be shared into Community.
- A Material resource can be attached to an Academy lesson by id.
- A lab project can publish a result into Community.
- Skills are `UserSkill` rows on the platform user, written from Work and
  readable by the work-profile contract.

Join links use `describeConference`. If the event has no URL and
`CONFERENCE_PROVIDER_URL` is unset, the API returns `configured: false`.
