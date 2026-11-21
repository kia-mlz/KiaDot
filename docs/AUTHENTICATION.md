# Authentication

One `User` row is the account for every department.

## Ways to sign in

- Phone OTP: `POST /api/auth/otp/request` then `POST /api/auth/otp/verify`.
  Iranian numbers are normalized to `09xxxxxxxxx`. This remains the learner
  path on `/education`.
- Email + password: `POST /api/auth/login` and the `/login` page.
- Email registration: `POST /api/auth/register`. Duplicate email returns 409.
  The account is created with `emailVerified: false` and no session. Login is
  not blocked on an unverified email, so a machine without SMTP can still be
  used. The verification link is emailed when SMTP is configured and logged
  once in development when it is not.

## Sessions

Access tokens are short-lived JWTs. The refresh token is an HttpOnly cookie
backed by a `RefreshToken` row. `GET /api/auth/sessions` lists those rows.
Revoking one id, logging out, or deactivating the account removes refresh
tokens. The next request with an access token for a deactivated, suspended, or
banned user is rejected by the JWT guard.

`LoginEvent` records success and failure (method, IP, user agent). A failure
to write the audit row does not block login.

## Passwords

Forgot-password and reset-password reuse `PasswordResetToken`. Change-password
requires the current password. The register and login DTOs require at least
8 characters with a letter and a digit.

## Two-factor authentication

Staff TOTP is implemented (`apps/api/src/group/auth/two-factor`). Learner 2FA
is not implemented and is not presented as enabled.

## Deactivate

`POST /api/auth/deactivate` sets `User.deletedAt` and revokes refresh tokens.
The row is kept. Login and JWT validation treat `deletedAt` as blocked.
