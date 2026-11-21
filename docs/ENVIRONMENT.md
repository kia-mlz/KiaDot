# Environment

Copy the templates. Do not commit the copies.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/group/.env.example apps/group/.env.local
```

## API (`apps/api/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL URL, including `?schema=public` for Prisma |
| `PORT` | no | Default 3001 |
| `NODE_ENV` | yes | `development` locally. `production` disables dev OTP and the dev payment confirm |
| `CORS_ORIGIN` | yes | Web origin |
| `APP_URL` | yes | Public web origin used in links and payment callbacks |
| `JWT_SECRET` | yes | Access tokens and activity timing. Min 32 characters outside local dev |
| `JWT_REFRESH_SECRET` | yes | Must differ from `JWT_SECRET` in production |
| `JWT_EXPIRES_IN` | no | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | no | Default `7d` |
| `OTP_DEV_EXPOSE` | no | Returns `devCode` only outside production |
| `TRUST_PROXY` | no | `true` behind a reverse proxy |
| `REDIS_URL` | no | Shared rate-limit store. Without it, limits are in-memory |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Email. Without them, messages are logged |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | no | Stripe. Checkout stays pending when unset |
| `CONFERENCE_PROVIDER` | no | Label for the join-link adapter |
| `CONFERENCE_PROVIDER_URL` | no | Fallback join URL. Unset means “not configured” |

Kavenegar, Zarinpal, and IDPay keys are stored in site settings from the admin
panel, not in the frontend.

## Web (`apps/group/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Leave empty to use the same-origin `/api` proxy |
| `API_PROXY_TARGET` | API origin, `http://127.0.0.1:3001` |
| `NEXT_PUBLIC_APP_URL` | Public origin for canonical URLs |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional. The secret stays on the API |
| `NEXT_PUBLIC_DEMO_MODE` | Must stay `false` for a real backend |

Local Postgres without Docker:

```bash
sudo pg_ctlcluster 16 main start
```

The role and database in the example URL are `kia_academy` / `kia_academy`.
The role needs `CREATEDB` only if you run `prisma migrate dev`.
