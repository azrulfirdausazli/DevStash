# Auth Phase 3 — Auth UI: Sign In, Register & Sign Out

**Status:** Approved
**Date:** 2026-06-17
**Source Spec:** `context/features/auth-phase-3-spec.md`

## Goal

Replace the basic sign-in page from Phase 2 with a polished version, add a register page, and wire the sidebar user area to real session data with avatar + sign-out dropdown.

## Architecture

```
src/
  app/
    signin/page.tsx                      [MODIFY — restyle, add Zod validation + error display + register link]
    register/page.tsx                    [NEW — register form with validation, submit to /api/auth/register]
    register/actions.ts                  [NEW — server action for register]
  components/
    auth/UserAvatar.tsx                  [NEW — reusable avatar: GitHub image or initials fallback]
  components/dashboard/Sidebar.tsx      [MODIFY — replace hardcoded user with session data + UserAvatar + sign-out]
```

## File-by-File

### `src/app/signin/page.tsx` — restyle

Keep the existing route at `/signin`. Improvements:
- Add Zod validation schema for email format and password min length
- Show inline error messages per field (red text below input)
- Show general error banner at top (e.g., "Invalid credentials")
- Add link at bottom: "Don't have an account? Register" → `/register`
- Clean up styling to match spec

### `src/app/register/actions.ts` — server action

```ts
"use server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
});

export async function registerUser(formData: FormData) {
  // ...same logic as /api/auth/register but returns { success, error }
}
```

### `src/app/register/page.tsx` — new page

Client component (needs `useState` for form state + error feedback):
- Fields: Name, Email, Password, Confirm Password
- On submit: calls `registerUser` server action
- On success: redirect to `/signin` with success message
- On error: show inline errors
- Link to `/signin` at bottom: "Already have an account? Sign in"

### `src/components/auth/UserAvatar.tsx` — reusable component

```tsx
interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: number;
}

export default function UserAvatar({ src, name, size = 28 }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return <Image src={src} alt={name} width={size} height={size} className="rounded-full" />;
  }

  return (
    <div
      className="rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
```

### `src/components/dashboard/Sidebar.tsx` — user area

Replace the hardcoded "D" / "Demo User" / "demo@devstash.io" / Settings icon at the bottom with a session-backed user area:
- Read session via `auth()` in `layout.tsx` and pass down user data
- UserAvatar (GitHub image or initials)
- User name and email (conditionally shown when sidebar expanded)
- Click opens a dropdown/popover with:
  - "View Profile" → `/profile`
  - "Sign out" → calls `signOut({ redirectTo: "/signin" })`

## Files Not Modified

- `src/auth.ts` — no changes needed
- `src/auth.config.ts` — stays edge-safe
- `src/proxy.ts` — already redirects to `/signin`
- `src/app/api/auth/register/route.ts` — unchanged API endpoint
- `src/lib/db/user.ts` — no changes needed

## Verification

1. `npm run lint` + `tsc --noEmit` + `npm run build` — all green
2. Visit `/signin` — polished form with validation, error display, register link
3. Visit `/register` — create account → redirect to `/signin`
4. Sign in with email/password → dashboard shows real user avatar + name in sidebar
5. Click sidebar avatar → dropdown with "View Profile" + "Sign out"
6. Sign out → redirect to `/signin`
7. Sign in with GitHub → sidebar shows GitHub avatar image

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. All behaviors defined.
- [x] **Internal consistency:** Route naming consistent (uses existing `/signin`). UserAvatar handles both image and initials.
- [x] **Scope check:** Single feature, 2 new files + 3 modified. Fits one plan.
- [x] **Ambiguity check:** Avatar server-rendered via session (no client-side session reads). Sign-out uses server action.
