# Auth Credentials — Email/Password Provider Design

## Overview

Add Credentials provider for email/password authentication alongside the existing GitHub OAuth, plus a registration API route.

## Decisions

- **Separate sign-in:** Registration only creates the user. Sign-in happens via `/api/auth/signin`. Simpler API, matches spec testing steps.
- **No migration needed:** `password String?` already exists in the User schema.
- **No new dependencies:** bcryptjs v3.0.3 + @types/bcryptjs already installed.
- **Split pattern preserved:** `auth.config.ts` stays edge-safe (no Prisma), `auth.ts` owns the real logic.

## Files

### 1. `src/auth.config.ts` — Add Credentials placeholder

Add `Credentials` import and include it in the providers array with `authorize: () => null`. This keeps the config edge-safe (no database imports) while declaring the provider's existence.

### 2. `src/auth.ts` — Override with real validation

Override the `providers` array entirely with `[GitHub, Credentials({ authorize: real bcrypt validate })]`. The `...authConfig` spread provides all other config fields (pages, callbacks base, etc.). The Credentials `authorize` function:

- Extracts `email` and `password` from credentials
- Looks up user by email via Prisma
- Returns `null` if no user or no password set
- Compares password with `bcrypt.compare()`
- Returns `{ id, email, name, image }` on success, `null` on failure

Adapter and JWT callbacks remain unchanged.

### 3. `src/app/api/auth/register/route.ts` — New registration endpoint

`POST /api/auth/register` — accepts JSON body:

```json
{ "name": "string", "email": "string", "password": "string", "confirmPassword": "string" }
```

Validation:
- All 4 fields required (400)
- `password === confirmPassword` (400)
- `password.length >= 8` (400)
- Email not already registered (409)

On success: hash with bcryptjs (cost 12, matching seed), create user with `emailVerified: new Date()`, return 201 with `{ message, user: { id, name, email } }`.

## What doesn't change

- No migration required
- No new packages installed
- `src/proxy.ts` — edge-safe proxy unchanged
- `src/types/next-auth.d.ts` — session type augmentation unchanged
- `src/lib/db/user.ts` — `getCurrentUserId()` unchanged
- All dashboard routes, components, and DB layer untouched
- GitHub OAuth path fully preserved
