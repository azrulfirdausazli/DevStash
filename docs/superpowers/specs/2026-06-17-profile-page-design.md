# Profile Page

**Status:** Draft
**Date:** 2026-06-17
**Source Spec:** `context/features/profile-spec.md`

## Goal

Build a standalone `/profile` route that displays the signed-in user's account info + usage stats and exposes two account actions: change password (email/password users only) and delete account (with confirmation). Route must be protected by the existing proxy.

## Decisions Locked During Brainstorming

| Question | Decision |
| --- | --- |
| Delete behavior | Hard delete with cascade (Prisma `User` cascades already wipe items, collections, custom item types, accounts, sessions) |
| Change password flow | Form requires current password + new password + confirm new password; server action verifies current password via `bcrypt.compare` before updating |
| Page structure | Async server component fetches all read-only data; two client sub-components own the interactive forms; delete confirmation uses shadcn `Dialog` |
| Item type breakdown display | Vertical list: type icon (colored) + name + horizontal bar (proportional to count) + count. Bar fill uses the type color; bar background uses `bg-muted` |
| Group new client components | `src/components/profile/` |
| `hasPassword` exposure | Boolean (cleaner than leaking `password: string \| null` to the page) |
| Delete confirmation pattern | User must type literal `"DELETE"` in the dialog before the Delete button enables (extra safety beyond the dialog) |
| Visual cards | Use shadcn `Card` (consistent with future dashboard patterns) |
| Post-delete redirect | `redirect("/signin?deleted=true")` from the action; signin page renders a banner if `?deleted=true` |

## Architecture

```
src/
  app/
    profile/
      page.tsx                        [NEW]  async server component, fetches data, composes UI
    signin/
      page.tsx                        [MOD]  show banner when ?deleted=true
  actions/
    change-password.ts                [NEW]  server action
    delete-account.ts                 [NEW]  server action
  components/
    profile/
      ProfileHeader.tsx               [NEW]  server, avatar + name + email + "Member since"
      ProfileStats.tsx                [NEW]  server, 2 stat cards + 7-type breakdown
      ChangePasswordForm.tsx          [NEW]  client, useActionState
      DeleteAccountSection.tsx        [NEW]  client, shadcn Dialog + "type DELETE" guard
    ui/
      card.tsx                        [NEW]  shadcn Card (npx shadcn add card)
      dialog.tsx                      [NEW]  shadcn Dialog (npx shadcn add dialog)
  lib/
    db/
      profile.ts                      [NEW]  getProfileData + getProfileStats
  proxy.ts                            [MOD]  add "/profile" to matcher
```

Unchanged: `prisma/schema.prisma` (cascades are already correct), `src/auth.ts`, `src/auth.config.ts`, `src/lib/db/user.ts`, `src/lib/db/items.ts`, `src/lib/db/collections.ts`, `src/components/auth/UserAvatar.tsx`, `src/components/dashboard/Sidebar.tsx`.

## Data Layer — `src/lib/db/profile.ts`

Two functions, each takes `userId: string`, returns a flat typed object. Reuses the existing `prisma` singleton; follows the same export pattern as `src/lib/db/items.ts`.

```ts
export type ProfileData = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  hasPassword: boolean; // user.password !== null
};

export type ItemTypeBreakdownRow = {
  typeId: string;
  name: string; // "snippet"
  icon: string; // "Code"
  color: string; // "#3b82f6"
  count: number;
};

export type ProfileStats = {
  itemCount: number;
  collectionCount: number;
  breakdown: ItemTypeBreakdownRow[]; // all 7 system types, 0 if no items
};

export async function getProfileData(userId: string): Promise<ProfileData> { ... }
export async function getProfileStats(userId: string): Promise<ProfileStats> { ... }
```

`getProfileStats` runs three queries in parallel:

1. `prisma.item.count({ where: { userId } })`
2. `prisma.collection.count({ where: { userId } })`
3. `prisma.item.groupBy({ by: ["itemTypeId"], where: { userId }, _count: { _all: true } })`

Then a single `prisma.itemType.findMany({ where: { isSystem: true }, select: { id, name, icon, color } })` fills in the 7 system types; the JS layer joins the two result sets so every type appears in `breakdown` (with `count: 0` when unused), sorted by `name` ascending.

## Server Actions

### `src/actions/change-password.ts`

```ts
"use server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm new password is required"),
});

export type ChangePasswordState = {
  success?: boolean;
  error?: string;
  errors?: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
};

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> { ... }
```

Flow:
1. `auth()` → if no session, return `{ error: "Not authenticated" }` (defense in depth; the proxy should already have redirected)
2. `schema.safeParse(formData)` → on failure, map Zod issues to `state.errors`
3. `prisma.user.findUnique({ where: { id: session.user.id } })` → if no user or no `password`, return `{ error: "Cannot change password for this account" }` (defense in depth — the form is hidden for OAuth users, but the action should still guard)
4. `bcrypt.compare(currentPassword, user.password)` → on mismatch, return `{ errors: { currentPassword: "Current password is incorrect" } }`
5. `newPassword === confirmPassword` check → on mismatch, return `{ errors: { confirmPassword: "Passwords do not match" } }`
6. `bcrypt.hash(newPassword, 12)` → `prisma.user.update({ where: { id }, data: { password: hashed } })`
7. Return `{ success: true }`

All errors caught by outer `try/catch` are logged with `console.error("[CHANGE_PASSWORD]", error)` and return `{ error: "Something went wrong. Please try again." }` — same pattern as `src/app/register/actions.ts`.

### `src/actions/delete-account.ts`

```ts
"use server";
import { z } from "zod/v4";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const schema = z.object({
  confirmText: z.literal("DELETE", { message: "Type DELETE to confirm" }),
});

export type DeleteAccountState = {
  error?: string;
};

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  // ...validate, auth, prisma.user.delete, redirect to /signin?deleted=true
}
```

Flow:
1. `auth()` → if no session, return `{ error: "Not authenticated" }`
2. `schema.safeParse({ confirmText: formData.get("confirmText") })` → on failure, return `{ error: parsed.error.issues[0]?.message ?? "Confirmation required" }`
3. `prisma.user.delete({ where: { id: session.user.id } })` — cascades wipe everything
4. `redirect("/signin?deleted=true")` (throws a `NEXT_REDIRECT` error; this is correct behavior)

Prisma `P2025` ("record not found") is caught specifically and returns `{ error: "Account no longer exists" }`. All other errors are caught, logged with `console.error("[DELETE_ACCOUNT]", error)`, and return `{ error: "Something went wrong. Please try again." }`.

The component is responsible for closing the dialog on success and navigating to `/signin?deleted=true` when the action returns successfully (no redirect needed because we want to keep the dialog's loading state through the redirect — see UI section).

## UI Components

### `src/app/profile/page.tsx` (server, async)

```tsx
export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  const [profile, stats] = await Promise.all([
    getProfileData(userId),
    getProfileStats(userId),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="sr-only">Profile</h1>
      <ProfileHeader profile={profile} />
      <ProfileStats stats={stats} />
      {profile.hasPassword && <ChangePasswordForm />}
      <DeleteAccountSection />
    </main>
  );
}
```

- Standalone page (no `Sidebar`, no `TopBar`, no `DashboardShell` wrap). The proxy protects the route; the layout is just the global app shell.
- `max-w-3xl` keeps the content readable on wide screens.
- The `sr-only` h1 is for accessibility; the visible title lives in `ProfileHeader`.

### `src/components/profile/ProfileHeader.tsx` (server)

```tsx
export default function ProfileHeader({ profile }: { profile: ProfileData }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <UserAvatar src={profile.image} name={profile.name ?? profile.email} size={64} />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">
            {profile.name ?? "Unnamed user"}
          </h2>
          <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Member since {formatDateLong(profile.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

`formatDateLong` is a new helper in `src/lib/utils.ts`:

```ts
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
```

### `src/components/profile/ProfileStats.tsx` (server)

```tsx
export default function ProfileStats({ stats }: { stats: ProfileStats }) {
  const maxCount = Math.max(...stats.breakdown.map((b) => b.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Items" value={stats.itemCount} />
          <StatCard label="Collections" value={stats.collectionCount} />
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Items by type</h3>
          <ul className="space-y-2">
            {stats.breakdown.map((row) => {
              const Icon = getIcon(row.icon);
              const pct = (row.count / maxCount) * 100;
              return (
                <li key={row.typeId} className="flex items-center gap-3 text-sm">
                  <Icon className="size-4 shrink-0" style={{ color: row.color }} />
                  <span className="w-24 shrink-0 capitalize">{row.name}s</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: row.color }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
```

`StatCard` is a small local helper inside `ProfileStats.tsx` (4-line card, not exported). `getIcon` comes from `src/lib/db/icons.ts` (existing). The bar background uses `bg-muted` (Tailwind); the bar fill uses an inline `style={{ backgroundColor: row.color }}` because the color is dynamic from the DB.

### `src/components/profile/ChangePasswordForm.tsx` (client)

```tsx
"use client";
import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/actions/change-password";

const initialState: ChangePasswordState = {};

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        {state.success && (
          <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            Password updated successfully.
          </div>
        )}
        {state.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <form action={formAction} className="space-y-4">
          {/* currentPassword, newPassword, confirmPassword fields — same shape as register form */}
          <Field id="currentPassword" label="Current password" type="password" error={state.errors?.currentPassword} />
          <Field id="newPassword" label="New password" type="password" error={state.errors?.newPassword} />
          <Field id="confirmPassword" label="Confirm new password" type="password" error={state.errors?.confirmPassword} />
          <Button type="submit" disabled={pending}>
            {pending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

`Field` is a small local helper inside the component (input + label + error text). On `{ success: true }`, the form is reset via `formRef.current?.reset()` in a `useEffect` watching `state.success`.

### `src/components/profile/DeleteAccountSection.tsx` (client)

```tsx
"use client";
import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/actions/delete-account";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: DeleteAccountState = {};

export default function DeleteAccountSection() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText === "DELETE";

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Permanently delete your account and all of your items, collections, and custom types. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This will permanently delete your account and all associated data. Type DELETE below to confirm.
              </DialogDescription>
            </DialogHeader>
            <form action={formAction} className="space-y-4">
              <Input
                name="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" variant="destructive" disabled={!canDelete || pending}>
                  {pending ? "Deleting..." : "Delete account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
```

The `Card` border uses `border-destructive/40` for a subtle warning cue. The `Dialog` from shadcn/ui renders the centered modal. The input value is controlled so the button enable/disable logic is reactive. On successful redirect (the action throws `NEXT_REDIRECT`), Next.js navigates automatically.

### `src/app/signin/page.tsx` — add `?deleted=true` banner

Add at the top of the existing form, conditional on `searchParams.deleted === "true"`:

```tsx
{searchParams.deleted === "true" && (
  <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
    Your account has been deleted.
  </div>
)}
```

The page must become `async` (it already is client-only? need to check). If it's a client component, the banner is computed from `useSearchParams`. **To confirm during planning**: `src/app/signin/page.tsx` is currently a client component. Either convert to a server component for `searchParams`, or use `useSearchParams` in the existing client component.

**Planning decision needed**: prefer converting `signin/page.tsx` to a server component if the only state is the banner, or keep it client and use `useSearchParams`. The latter is less invasive. Plan will choose `useSearchParams`.

## Route Protection — `src/proxy.ts`

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/profile"],
};
```

Logic unchanged. When unauthed user hits `/profile`, proxy redirects to `/signin?callbackUrl=/profile`.

## Files Not Modified

- `prisma/schema.prisma` — cascades already correct
- `src/auth.ts`, `src/auth.config.ts` — no auth flow changes
- `src/lib/db/user.ts` — `getCurrentUserId` reused as-is
- `src/lib/db/items.ts`, `src/lib/db/collections.ts`, `src/lib/db/item-types.ts` — no overlap
- `src/components/auth/UserAvatar.tsx` — reused as-is
- `src/components/dashboard/Sidebar.tsx` — the "View Profile" link to `/profile` already exists; this feature just makes that destination real
- `src/app/api/auth/register/route.ts` — out of scope
- `src/app/register/page.tsx` and `src/app/register/actions.ts` — out of scope

## Error Handling Summary

| Layer | Behavior |
| --- | --- |
| Proxy | Unauthed request to `/profile` → redirect to `/signin?callbackUrl=/profile` |
| `getCurrentUserId` | Throws if no session (defense in depth; proxy should have caught it) |
| Server action: no session | Return `{ error: "Not authenticated" }` |
| Server action: Zod failure | Map issues to `state.errors[field]` (one per field) |
| Server action: business logic failure (e.g., wrong current password) | Return `{ errors: { field: "message" } }` |
| Server action: unhandled exception | `console.error("[TAG]", error)`, return generic `{ error: "Something went wrong. Please try again." }` |
| Server action: `redirect()` (delete) | Next.js handles; dialog auto-closes; signin banner shows |
| Prisma `P2025` (delete) | Return `{ error: "Account no longer exists" }` |

## Verification

1. `npm run lint` + `tsc --noEmit` + `npm run build` — all green
2. `npm run dev` and visit `/profile` while signed in as the demo user
3. Header shows: avatar (initials `D`), name `Demo User`, email `demo@devstash.io`, `Member since {today-ish}`
4. Usage section shows: `Items 18`, `Collections 5`, then 7 rows of breakdown with the correct counts per the seed (totals: 3+3+4+4+4 = 18)
5. Change password card is visible (demo user has a password)
6. Submit empty form → see field errors
7. Submit wrong current password → "Current password is incorrect"
8. Submit mismatched confirm → "Passwords do not match"
9. Submit valid (current=`12345678`, new=`newpass123`, confirm=`newpass123`) → success banner, form resets
10. Sign out and sign back in with the new password → success (verifies the update actually happened)
11. Restore the seed password: `npm run db:seed` resets the demo user
12. Click "Delete account" → dialog opens, type "DELETE" → button enables → click → redirect to `/signin?deleted=true` with banner
13. Sign in as demo again (via seed) → confirm cascade actually happened (no items / collections remain for the deleted user; the seed re-creates them)
14. Sign in with GitHub OAuth (mock) → visit `/profile` → header shows GitHub image (or initials), "Change password" card is **hidden**, delete is still visible
15. Unauthed visit to `/profile` → proxy redirects to `/signin?callbackUrl=/profile`
16. Empty-state: temporarily clear all demo items (`prisma.item.deleteMany({ where: { userId: demoUserId } })`) → refresh `/profile` → breakdown shows 7 rows all with count 0, bar width 0%
17. Restore data: `npm run db:seed`

## Out of Scope

- Editing email or name (per spec — read-only display only)
- Profile picture upload (uses existing `image` field from OAuth or initials only)
- Account deactivation / soft delete
- Email change with verification flow
- Activity log / audit trail of account actions
- Exporting user data before delete (could be a follow-up feature)

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. All behaviors defined. The one design sub-decision (signin banner via `useSearchParams` vs server component) is resolved in the UI section.
- [x] **Internal consistency:** All file paths, function signatures, and types match across sections. `hasPassword` boolean is the single source of truth used by the page to conditionally render the form. Both actions log with consistent `[TAG]` prefix.
- [x] **Scope check:** Single feature, 7 new files + 2 modified. Fits one implementation plan.
- [x] **Ambiguity check:** "Email users only" detection is unambiguous (`user.password !== null`). "Account creation date" is `user.createdAt`. "Item type breakdown" lists all 7 system types even with 0 count.
