# Auth Phase 2 — Credentials Email/Password Provider

**Status:** Approved
**Date:** 2026-06-17
**Source Spec:** `context/features/auth-phase-2-spec.md`

## Goal

Add a Credentials (email/password) provider to NextAuth v5 alongside the existing GitHub OAuth. Users can register via a `POST /api/auth/register` endpoint and sign in with email + password. The existing GitHub-only users continue to work unchanged.

## Constraints

- `npm run lint`, `tsc --noEmit`, `npm run build` must remain green
- `bcryptjs` already installed (no new deps beyond what's needed)
- `User.password` field already exists in schema — no migration
- The split-config pattern must be preserved: `auth.config.ts` stays edge-safe (no Prisma/Node imports)
- Credentials provider goes ONLY in `auth.ts` — `auth.config.ts` stays unchanged
- No client components, no signin page customization (NextAuth default page is used)

## Architecture

```
src/
  auth.config.ts                                [UNCHANGED — still edge-safe, GitHub only]
  auth.ts                                       [MODIFY — add Credentials provider with bcrypt]
  app/api/auth/register/route.ts                [NEW — POST handler for registration]
  app/api/auth/[...nextauth]/route.ts           [UNCHANGED]
  proxy.ts                                      [UNCHANGED — still protects /dashboard/*]
  lib/db/user.ts                                [UNCHANGED]
```

One new file, one modified file.

## File-by-File

### `src/auth.ts` — add Credentials provider

Import `Credentials` from `next-auth/providers/credentials` and `bcryptjs`. Add a Credentials provider with a real `authorize` function that:

1. Receives `email` and `password` from the signin form
2. Finds the user by email via `prisma.user.findUnique`
3. If user is found but has no password (GitHub-only account), returns `null`
4. Uses `bcrypt.compare` to validate the password
5. Returns the user object (minus password) on success, or `null` on failure

The providers array merges the real Credentials provider with the existing providers from `auth.config.ts`:

```ts
providers: [
  Credentials({
    async authorize(credentials) {
      // ...
    },
  }),
  ...authConfig.providers,
],
```

This keeps GitHub working and the proxy (`proxy.ts`) doesn't need to know about Credentials — it only checks `req.auth` which works regardless of provider.

### `src/app/api/auth/register/route.ts` — registration endpoint

`POST` handler at `/api/auth/register`:

1. Parse body: `{ name, email, password, confirmPassword }`
2. Validate `password === confirmPassword` — return 400 if not
3. Check `prisma.user.findUnique({ where: { email } })` — return 409 if exists
4. Hash password with `bcryptjs.hash(password, 12)`
5. `prisma.user.create({ data: { name, email, password: hashedPassword } })`
6. Return `Response.json({ success: true })` with 201
7. Catch-all error returns 500 with `{ error: "Something went wrong" }`

## Files Not Modified

- `src/auth.config.ts` — stays edge-safe with just GitHub
- `src/proxy.ts` — already redirects unauthenticated `/dashboard/*` to signin
- `src/app/api/auth/[...nextauth]/route.ts` — unchanged handlers
- `src/lib/db/user.ts` — getCurrentUserId already works via session, no changes needed
- `prisma/schema.prisma` — password field already exists

## Data Flow (registration)

```
Browser → POST /api/auth/register { name, email, password, confirmPassword }
  → validate passwords match
  → check existing user (409 if duplicate)
  → bcryptjs.hash(password, 12)
  → prisma.user.create
  → 201 { success: true }
```

## Data Flow (signin)

```
Browser → GET /dashboard
  → proxy redirects to /api/auth/signin
  → user fills email + password on NextAuth default signin page
  → POST /api/auth/callback/credentials
  → auth.ts Credentials.authorize runs:
    → prisma.user.findUnique({ where: { email } })
    → user?.password ? bcrypt.compare : null
    → return user or null
  → success: JWT set, redirect to /dashboard
  → failure: error shown on signin page
```

## Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Passwords don't match | 400 `{ error: "Passwords do not match" }` |
| Email already registered | 409 `{ error: "A user with this email already exists" }` |
| Missing required fields | 400 `{ error: "All fields are required" }` |
| User tries to sign in with email but registered via GitHub | User has no password → `authorize` returns null → "Invalid credentials" on signin page |
| GitHub-only user tries to sign in with credentials | Same as above — no password in DB |
| Credentials user signs in successfully | Standard JWT session, same as GitHub flow |

## Verification

1. `npm run lint` — zero errors
2. `tsc --noEmit` — zero errors
3. `npm run build` — completes successfully
4. Manual testing (see Workflow below)

## Workflow

1. Create branch `feature/auth-phase-2` from `main`
2. Modify `src/auth.ts` — add Credentials provider
3. Create `src/app/api/auth/register/route.ts`
4. `npm run lint` + `tsc --noEmit` + `npm run build`
5. Manual smoke test:
   - `curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"name":"Test2","email":"test2@devstash.io","password":"12345678","confirmPassword":"12345678"}'` → 201
   - Go to `/api/auth/signin` → sign in with test2@devstash.io / 12345678 → redirect to `/dashboard`
   - Verify GitHub OAuth still works (sign out, sign in with GitHub)

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. Each behavior is defined.
- [x] **Internal consistency:** `auth.config.ts` unchanged; providers merge correctly. No type mismatches.
- [x] **Scope check:** Single feature, one new file, one modified file. Fits one plan.
- [x] **Ambiguity check:** Credentials provider only in auth.ts (confirmed with user). Error responses are explicit. GitHub-only user with no password is handled explicitly.
