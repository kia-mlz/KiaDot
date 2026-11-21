# Backup and restore

The database is the source of truth. Material file bytes also live on the API
disk under `uploads/material` (relative to the API process working directory).
Back both up together. A database restore without the files makes download
tokens point at missing objects.

## Backup

```bash
pg_dump --format=custom --file=kiadot.dump "$DATABASE_URL"
tar -C apps/api -czf material-uploads.tgz uploads/material
```

If `DATABASE_URL` contains `?schema=public`, strip the query string before
passing it to `pg_dump`. Prisma needs the query string; `pg_dump` does not.

Take the dump from a replica or during a quiet window. The dump is
non-destructive.

## Restore

Stop the API so it does not write during the restore.

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" kiadot.dump
tar -C apps/api -xzf material-uploads.tgz
pnpm db:migrate:deploy
```

`--clean` drops objects that are in the dump before recreating them. Use it
only on the database you intend to replace. Then start the API and the web
process. Confirm `GET /api/health` reports `database: up`.

Department enable flags are rows in `DepartmentRegistry` and come back with
the dump. No extra restore step is required.
