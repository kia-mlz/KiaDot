# Deployment

Single host, no Docker required.

## Processes

1. PostgreSQL 16, database and role matching `DATABASE_URL`.
2. API: `node apps/api/dist/main` (after `pnpm --filter @kia./api build`). Listens on `PORT` (3001) under `/api`.
3. Web: `pnpm --filter @kia./group start` after `pnpm --filter @kia./group build`. Listens on 3000.

Build libraries first: `pnpm build:libs` (permissions, brand, shared, platform,
then the department packages).

Apply migrations before serving traffic:

```bash
pnpm db:migrate:deploy
```

Seed only on a new environment, and never with `NODE_ENV=production` against
real users. Create the super admin out of band and rotate the seed password
if you do seed a staging box.

## Reverse proxy

Terminate TLS on the proxy. Send `/` to the Next.js process and `/api` to the
API, or send everything to Next.js and keep `API_PROXY_TARGET` pointed at the
API on localhost. Set:

- `APP_URL` and `NEXT_PUBLIC_APP_URL` to the public https origin
- `CORS_ORIGIN` to that origin
- `TRUST_PROXY=true` on the API
- `NODE_ENV=production`
- `OTP_DEV_EXPOSE` unset
- payment provider to a live gateway with its keys only in the API environment
  (or in Admin → Payment gateway). The `dev` provider refuses to confirm
  payments when `NODE_ENV=production`.

## What not to do

Do not expose `uploads/material` as a static directory. The API rejects
`/api/uploads/material`. Do not put `JWT_SECRET`, SMTP passwords, Kavenegar
keys, or gateway secrets in the frontend.

Department disable is data (`DepartmentRegistry.enabled`), so it survives a
restart and does not require a second deploy.
