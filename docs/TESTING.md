# Testing

## Unit and package tests

```bash
pnpm --filter @kia./shared test
pnpm --filter @kia./brand test
pnpm --filter @kia./platform test
pnpm --filter @kia./kia-work test
pnpm --filter @kia./kia-lab test
pnpm --filter @kia./kia-community test
pnpm --filter @kia./kia-material test
pnpm --filter @kia./api test
pnpm --filter @kia./group test
```

`pnpm test` builds libraries and runs every workspace test. It is the command
CI should use. Targeted runs above are what to use while changing one package.

Covered by the KiaDot additions:

- register, duplicate register, login success, login failure
  (`apps/api/src/group/auth/auth.service.register.spec.ts` plus existing auth specs)
- guest blocked from notifications (`notifications.access.spec.ts`)
- department permission denied and super-admin allowed (`kia-work`, `kia-lab`, `kia-community` specs)
- private file denied (`kia-material/catalog/material.service.spec.ts`)
- certificate on the work-profile contract (`contracts.service.spec.ts`)
- activity grading (`packages/shared/src/activities/grade.test.ts`)

## Typecheck and lint

```bash
pnpm --filter @kia./api typecheck
pnpm --filter @kia./group typecheck
pnpm lint
```

## End to end

```bash
pnpm --filter @kia./group exec playwright install chromium
pnpm test:e2e
```

E2E needs the web app and API running (`pnpm dev:local`) and a seeded database.

## Production build

```bash
pnpm build:libs
pnpm --filter @kia./api build
pnpm --filter @kia./group build
```

`pnpm build` runs that order for the whole repo.
