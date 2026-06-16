# Auth Phase 1 — NextAuth v5 + GitHub OAuth

**Status:** Approved
**Date:** 2026-06-17
**Source Spec:** `context/features/auth-phase-1-spec.md`

## Goal

Wire NextAuth v5 with the Prisma adapter and GitHub OAuth to protect `/dashboard/*` routes. End-to-end: a new GitHub user gets a freshly auto-created `User` row (via the Prisma adapter on first signin) and an empty dashboard. The `demo@devstash.io` seed user stays in the database (orphaned from the new user — no migration).

The data layer stops using the hardcoded `getCurrentUserId() → demo@devstash.io` shortcut. A new `getCurrentUserId()` (same name, same return type) derives the id from the live session via NextAuth's `auth()`. Call sites in `src/app/dashboard/layout.tsx:12` and `src/app/dashboard/page.tsx:17` change minimally (same `Promise<string>` return).

## Constraints

- Existing Next.js 16 / React 19 / Tailwind v4 / shadcn project must keep building (`npm run build`)
- `npm run lint` and `tsc --noEmit` must remain green
- NextAuth v5 split-config pattern (Context7-verified against the official `nextauthjs/next-auth` docs)
- No Prisma migration — `Account`, `Session`, `VerificationToken` already exist in `prisma/schema.prisma:38-76` and match the official Prisma adapter schema
- No new npm scripts
- Three env vars must be set manually by the developer before the test plan can run: `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` (from a GitHub OAuth app) and `AUTH_SECRET` (from `npx auth secret`)
- No client components added; the proxy and `auth.ts` are server-only

## Architecture

```
src/
  auth.config.ts                                  [NEW — edge-safe, providers only]
  auth.ts                                         [NEW — full config + Prisma adapter + JWT]
  proxy.ts                                        [NEW — Next.js 16 proxy, protects /dashboard/*]
  types/next-auth.d.ts                            [NEW — Session + JWT module augmentation]
  app/api/auth/[...nextauth]/route.ts             [NEW — re-exports GET, POST handlers]
  lib/db/user.ts                                  [MODIFY — now wraps auth() instead of prisma.user.findUnique]
  app/dashboard/layout.tsx                        [UNCHANGED — same getCurrentUserId() return]
  app/dashboard/page.tsx                          [UNCHANGED — same getCurrentUserId() return]
  components/dashboard/TopBar.tsx                 [UNCHANGED — no avatar/user dep]
  app/page.tsx                                    [UNCHANGED — root stub]
  prisma/seed.ts                                  [UNCHANGED — demo user stays]
  prisma/schema.prisma                            [UNCHANGED — NextAuth models already present]
.env.example                                      [MODIFY — append AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET]
package.json                                      [MODIFY — add next-auth@beta, @auth/prisma-adapter]
```

Five new files, three modified (one of which is `.env.example`, one is `package.json`).

## File-by-File

### `src/auth.config.ts` — edge-safe providers

Exports a config object only. **No `NextAuth()` call, no adapter, no callbacks that touch the DB.** This file is imported by both the edge-bound proxy and the full server-side `auth.ts`.

```ts
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

export default {
  providers: [GitHub],
} satisfies NextAuthConfig;
```

No `pages` key — NextAuth's default signin page (`/api/auth/signin`) is used per the spec.

### `src/auth.ts` — full config

Spreads the edge-safe config and adds the Prisma adapter + JWT strategy + the two callbacks that propagate `user.id` from the OAuth profile → JWT → session.

```ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
```

`PrismaAdapter` requires the JWT strategy when used with a credentials provider in v5, and is also the simpler path for OAuth-only setups because session reads don't need a DB hit on every request.

### `src/app/api/auth/[...nextauth]/route.ts` — handlers

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

Standard NextAuth v5 catch-all route. The two verbs cover all of NextAuth's auth endpoints (`/api/auth/signin`, `/api/auth/callback/github`, `/api/auth/signout`, `/api/auth/session`, etc.).

### `src/proxy.ts` — route protection

Named export, not default. Uses NextAuth's `auth()` wrapper to get the session per request, then redirects unauthenticated users on `/dashboard/*` to the default signin page with a `callbackUrl` so they're returned to the page they wanted.

```ts
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  if (isDashboard && !req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

**Why the matcher is just `/dashboard/:path*`:** Next.js proxy/middleware runs on every request by default — including `_next/static`, image optimizations, and other static files. Restricting the matcher to `/dashboard/:path*` means the proxy never fires for `/`, `/api/auth/*`, `/_next/*`, or any other path. This is the cleanest exclusion strategy: the proxy only runs where it needs to decide something.

**Why the `startsWith("/dashboard")` check inside the callback:** The matcher guarantees this, but a defensive `startsWith` is cheap and keeps the intent readable. If the matcher is ever widened, the redirect logic is still correct.

### `src/types/next-auth.d.ts` — module augmentation

```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
```

Augmenting both `Session` (for `session.user.id` in `auth.ts` callbacks and server components) and `JWT` (for `token.userId` in the `jwt` callback). `DefaultSession["user"]` preserves the default fields (`name`, `email`, `image`).

### `src/lib/db/user.ts` — refactor

Preserve the existing API: `getCurrentUserId(): Promise<string>`. Internally switch from a `prisma.user.findUnique` lookup to `auth()`. Keep the `cache()` wrapper so `layout.tsx` and `page.tsx` still share a single session read per request (matching QW-2 from the audit).

```ts
import { cache } from "react";
import { auth } from "@/auth";

export const getCurrentUserId = cache(async (): Promise<string> => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(
      "Unauthenticated request reached a server component. " +
        "The /dashboard/* proxy should have redirected to /api/auth/signin before this.",
    );
  }
  return session.user.id;
});
```

The `throw` is a safety net, not a primary control. The proxy is the real gate. If the throw ever fires in production, the proxy matcher was misconfigured.

The `DEMO_USER_EMAIL` constant and the `prisma.user.findUnique` call are removed. Seed data for `demo@devstash.io` remains in the DB (no migration, no deletion) but is now orphaned from the active user.

### `.env.example` — additions

Append:

```
# NextAuth v5
# Generate with: npx auth secret
AUTH_SECRET=

# GitHub OAuth app
# Create at: https://github.com/settings/developers
# Authorization callback URL: http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

### `package.json` — dependencies

Add two packages (both via `npm install`):

- `next-auth@beta` — NextAuth v5 (the spec's `next-auth@beta` is correct; `@latest` would install v4)
- `@auth/prisma-adapter` — Prisma adapter for NextAuth v5

No script changes.

## Data Flow (signin)

```
Browser
  → GET /dashboard
  → proxy fires (matcher: /dashboard/:path*)
  → auth() returns null
  → Response.redirect("/api/auth/signin?callbackUrl=/dashboard")
  → user clicks "Sign in with GitHub"
  → redirect to https://github.com/login/oauth/authorize?...
  → user approves
  → GitHub redirects to /api/auth/callback/github?code=...
  → NextAuth exchanges code for access token
  → PrismaAdapter creates User + Account rows in Neon (first signin only)
  → NextAuth sets session cookie (encrypted JWT)
  → Response.redirect(callbackUrl) → /dashboard
  → proxy fires again
  → auth() returns { user: { id, email, name, image } }
  → proxy callback is a no-op
  → page.tsx renders
  → getCurrentUserId() returns session.user.id
  → db functions return empty arrays (new user, no data)
  → dashboard shows empty stats (0 items, 0 collections) + empty lists
```

## Manual Prerequisites (developer setup)

The test plan cannot run without these:

1. **Create a GitHub OAuth app** at `https://github.com/settings/developers` → "New OAuth App":
   - Application name: anything (e.g. "DevStash Local")
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
2. **Generate `AUTH_SECRET`**: `npx auth secret` (uses `openssl rand -base64 32` under the hood) → paste into `.env` as `AUTH_SECRET=...`
3. **Copy the OAuth app's Client ID and Client secret** into `.env` as `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`

These three lines are added to `.env` (not committed) and `.env.example` documents the shape (committed).

## Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Unauthenticated request to `/dashboard/*` | Proxy redirects to `/api/auth/signin?callbackUrl=<original>` |
| Unauthenticated request to non-dashboard path | No proxy interference; page renders normally (root stub, etc.) |
| `auth()` returns null in a server component (shouldn't happen if proxy is correct) | `getCurrentUserId` throws; Next.js error boundary renders. Indicates proxy misconfiguration. |
| GitHub OAuth app callback URL mismatch | NextAuth returns a 500 on `/api/auth/callback/github` with a `Configuration` error message. The dev sees the error in the browser. Fix the OAuth app's callback URL. |
| `AUTH_SECRET` not set | NextAuth throws at request time ("NO_SECRET") or refuses to start. The dev sees this immediately. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` not set | Provider config fails at request time with a "Missing required parameter" error. |
| User signs in for the first time | PrismaAdapter auto-creates `User` + `Account` rows. The new `User` has no items, collections, or item types → empty dashboard. |
| User signs in again (returning) | PrismaAdapter finds the existing `User` by `Account.provider + providerAccountId`; no duplicate row. |
| Sign-in callback URL is an open-redirect vector | NextAuth's `callbackUrl` only allows same-origin URLs by default. No additional validation needed. |
| Proxy matcher typo (`/dashbord`) | No proxy fires; `/dashbord/*` returns 404 from the page. The original `/dashboard` URL still works. |
| Build runs without `.env` set | `npm run build` succeeds (auth is only invoked at request time). The dev page renders an error only at request time. |

## What This Feature Does NOT Include

- Sign-out button in TopBar or sidebar (deferred to a later feature; manual `/api/auth/signout` works)
- Migrating the `demo@devstash.io` seed data to a real GitHub user (orphaned, not deleted)
- Removing `src/lib/mock-data.ts` (`QW-1` from the audit, still applies)
- Email/password provider (`User.password` column stays in schema but is unused)
- `useSession` for client components (no client-side session reads needed in Phase 1)
- `signIn` / `signOut` server actions (the exported functions from `src/auth.ts` are ready for future use)
- Production OAuth callback URL setup (only the local URL is documented)
- Production `AUTH_SECRET` rotation strategy
- Rate limiting on the signin flow (rely on NextAuth defaults)
- Email verification UI (GitHub provides verified emails; the schema's `emailVerified` field is set automatically by the adapter)
- The root `/` page redirecting to `/dashboard` (it's a stub `<h1>Devstash</h1>` and stays that way; the developer visits `/dashboard` directly)

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `next-auth@beta` vs `@latest` confusion | Spec mandates `@beta`; package.json comment notes the v4 trap. CI/install runs use `@beta` explicitly. |
| Prisma adapter + JWT strategy subtlety (JWT is required for OAuth-only with the adapter in v5) | Spec mandates JWT; design matches Context7-verified pattern. |
| Proxy matcher not excluding `api/auth/*` (the redirect target) | Matcher's strict path match (`/dashboard/:path*`) means the proxy never fires for `/api/auth/*`. Sign-in works. |
| `getCurrentUserId` is called in `page.tsx` and `layout.tsx` — both will await the same session | `cache()` wrapper deduplicates within a single render. Same as before. |
| `prisma` import inside `auth.ts` is now a transitive dep of every server component (via `getCurrentUserId`) | This is already true today (`getCurrentUserId` already calls `prisma.user.findUnique`). No new coupling. |
| Proxy throws on first sign-in if cookies are partitioned by browser | Standard NextAuth issue. Solution: set `cookies.secure` and use `__Secure-` cookie prefix in production. Out of scope for Phase 1 (local dev). |
| GitHub OAuth app created in dev's personal account, not an org | Acceptable for local dev. Production will need a separate OAuth app under the DevStash org. Documented in the manual prerequisites, not solved here. |

## Workflow / Verification

All steps assume the developer has set `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` in `.env`.

1. Create branch `feature/auth-phase-1` from `main`
2. `npm install next-auth@beta @auth/prisma-adapter`
3. Create `src/auth.config.ts` (edge-safe)
4. Create `src/auth.ts` (full config)
5. Create `src/app/api/auth/[...nextauth]/route.ts`
6. Create `src/types/next-auth.d.ts`
7. Create `src/proxy.ts`
8. Modify `src/lib/db/user.ts` to wrap `auth()` (same return type)
9. Modify `.env.example` to document the three new env vars
10. `npm run lint` — zero errors
11. `tsc --noEmit` — zero errors
12. `npm run build` — completes successfully; confirms module augmentation compiles
13. `npm run dev` → manual smoke test:
    - Visit `http://localhost:3000/dashboard` while signed out → expect redirect to `/api/auth/signin?callbackUrl=/dashboard`
    - Click "Sign in with GitHub" → expect GitHub consent screen
    - Approve → expect redirect to `/dashboard` and dashboard renders (empty stats/lists)
    - Open `npx prisma studio` → expect a new `User` + `Account` row for the GitHub account (under `users` and `accounts` tables)
    - Re-visit `/dashboard` while signed in → expect no redirect; dashboard renders immediately
    - Visit `http://localhost:3000/` → expect the root stub `<h1>Devstash</h1>` (no proxy interference)
    - Visit `http://localhost:3000/api/auth/signout` → expect the default NextAuth signout page (confirms sign-out path exists)
14. `git add` + commit on `feature/auth-phase-1`
15. Push branch + open PR (if remote PR workflow is in use)

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. The "orphan demo user" is explicit; the "no client signout UI" is explicit. Manual prerequisites are step-by-step.
- [x] **Internal consistency:** `getCurrentUserId` return type is unchanged; call sites in `layout.tsx` and `page.tsx` are not modified. `prisma` import path matches existing convention (`@/lib/prisma`).
- [x] **Scope check:** Single feature, single plan, 5 new files + 3 modified. Fits in one plan.
- [x] **Ambiguity check:** Proxy matcher pattern is exact; `callbackUrl` handling is exact; Prisma adapter auto-create behavior is explicit; the throw on null session is called out as a safety net, not a primary control.
