# Security

## Controls that are in the code

- Nest `ValidationPipe` whitelist on DTOs. Text fields reject control characters
  and oversized input (`containsUnsafeText` on department writes).
- Queries go through Prisma. New code does not concatenate SQL.
- JWT access tokens plus HttpOnly refresh cookies. Deactivated, suspended, and
  banned users fail login and fail later requests.
- Auth routes are throttled. Community posts are also limited per minute in
  the service.
- Helmet and CORS stay as configured in `apps/api/src/main.ts`.
- `/api/uploads/material` returns 401. Material downloads require a JWT and a
  10-minute token bound to the user. Paid files require a paid invoice.
- Activity time limits use an HMAC of activity, user, and open time
  (`JWT_SECRET`). The client clock is not the source of the elapsed time.
- Payment status changes only after `provider.verifyPayment`. A gateway
  reference containing `-sim-` is rejected for non-dev invoices. The dev
  provider cannot confirm a payment when `NODE_ENV=production`.
- Refunds are recorded by a super admin and audited. They do not pretend the
  gateway refunded the charge.
- Department admin checks are on the API. A Work role does not read Labs admin
  actions.
- Errors returned to clients stay generic (`Unauthorized`, `Conflict`,
  `Purchase required`). Stack traces are not sent.

## Secrets

Secrets live in environment variables or admin site settings on the server.
The web bundle does not receive JWT, SMTP, Kavenegar, or merchant secrets.
`.env` and `.env.local` are git-ignored.

## Not implemented

Learner TOTP. Staff TOTP exists. A rendered QR image for tickets is not
generated; check-in uses the ticket code. Conferencing does not create rooms;
it only returns a stored or configured URL.
