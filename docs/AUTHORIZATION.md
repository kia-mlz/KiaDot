# Authorization

Roles and the admin matrix live in `@kia./permissions`. Department memberships
live in `DepartmentMembership`. There is no second permission system.

## Platform roles

- `SUPER_ADMIN` — full admin API and every department admin check.
- `ADMIN` — limited by `adminPanelAccess` (template from site settings when the
  user is promoted). Enforced by `AdminAccessGuard`, not by hiding buttons.
- `LEARNER` — own learner data. A learner may also hold department roles.

## Department roles

A user can be `STUDENT` in Academy and `FREELANCER` or `EMPLOYER` in Work at
the same time. `DepartmentRoleGuard` (`@DepartmentRoles`) checks the membership
for one department. `SUPER_ADMIN` bypasses it.

New department routes also check the actor inside the service (owner, or a
listed department role, or `SUPER_ADMIN`). Examples:

- Scoring a lab idea requires `LABS_ADMIN` or `RESEARCHER` (or super admin).
- Community moderation requires `COMMUNITY_ADMIN` or `MODERATOR`.
- A department membership does not authorize another department’s admin data.
- Material download checks author, free+published, or a paid `DepartmentInvoice`.

## Registry

`PATCH /api/departments/:key` and `PATCH /api/content` require `SUPER_ADMIN`.
The change is written to `AdminAudit`. Disabling a department returns 404 from
that department’s API and `notFound()` from its Next.js layout. Other
departments keep serving.
