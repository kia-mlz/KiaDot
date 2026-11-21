# Database

PostgreSQL 16. One database (`kia_academy` in local examples). Prisma schema:
`apps/api/prisma/schema.prisma`. The client is generated into
`packages/platform/src/generated/prisma` (not committed).

## Ownership

The schema is shared. Each department owns the tables it writes. Other
departments do not query those tables. Cross-department reads go through
`apps/api/src/group/contracts`.

| Owner | Tables |
| --- | --- |
| Platform | `User`, `RefreshToken`, `PasswordResetToken`, `LoginEvent`, `UserSkill`, `Notification`, `DepartmentRegistry`, `DepartmentMembership`, `PlatformContent`, `DomainEventReceipt`, `DepartmentInvoice`, existing auth/admin/commerce/support tables |
| Academy | existing `Course`, `Lesson`, exams, games, plus `Certificate`, `ClassSession`, `ClassAttendance`, `LearningActivity`, `LearningActivityAttempt`, `LessonMaterialLink` |
| Work | `SpecialistProfile`, `JobPost`, `JobApplication`, `FreelanceProject`, `FreelanceProposal`, `FreelanceMilestone`, `WorkReview` |
| Material | `MaterialResource`, `MaterialFile`, `MaterialDownloadToken` |
| Labs | `LabProject`, `LabMember`, `LabPhase`, `LabExperiment`, `LabIdea`, `LabTask`, `LabReport` |
| Events | existing competitions/bootcamps, plus `LiveEvent`, `EventTicketType`, `EventSignup`, `EventSpeaker`, `EventAgendaItem` |
| Community | `CommunityPost`, `CommunityComment`, `CommunityLike`, `CommunitySave`, `CommunityFollow`, `CommunityGroup`, `CommunityGroupMember`, `CommunityMessage`, `CommunityBlock`, `CommunityReport`, `CommunityShare`, `CommunityRestriction` |

`LessonMaterialLink.materialResourceId` is an opaque id. There is no foreign key
from Academy to Material.

## Migrations

Migrations live in `apps/api/prisma/migrations`. Apply with:

```bash
pnpm db:migrate:deploy
```

`pnpm db:migrate` (`prisma migrate dev`) needs a shadow database and `CREATEDB`
on the role. Prefer `db:migrate:deploy` outside an interactive workstation.
Do not drop tables to “reset” a shared database.

`20261121120000_kiadot_ecosystem` only creates the tables above and their
indexes and foreign keys. It does not alter or drop existing product tables.

## Seed

`pnpm db:seed` upserts courses, exams, games, site settings, the six
`DepartmentRegistry` rows, `PlatformContent`, and starter users:

- `admin@kia.academy` — `SUPER_ADMIN`
- `alex@kia.academy` — `LEARNER`, plus Academy `STUDENT` and Work `FREELANCER`

The seed refuses `NODE_ENV=production`. The local password is
`KiaAcademy123!` and must be rotated before any shared deploy.
