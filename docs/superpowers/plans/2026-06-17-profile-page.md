# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/profile` route that displays the signed-in user's account info + usage stats, lets email/password users change their password, and lets any user delete their account (with a typed-confirmation dialog).

**Architecture:** Server-component page at `src/app/profile/page.tsx` fetches the user row + stats in parallel and composes a `ProfileHeader`, a `ProfileStats` card, a `ChangePasswordForm` (hidden for OAuth-only users), and a `DeleteAccountSection` (with a shadcn `Dialog`). Data lives in a new `src/lib/db/profile.ts` module following the existing `src/lib/db/items.ts` pattern. Two server actions in `src/actions/` handle password change and account deletion (hard delete with Prisma cascade). Route protection is added to the existing proxy matcher.

**Tech Stack:** Next.js 16, React 19, Prisma 7, NextAuth v5, Zod 4, bcryptjs, shadcn/ui (`Card`, `Dialog`), Tailwind CSS v4.

**Design doc:** `docs/superpowers/specs/2026-06-17-profile-page-design.md`
**Working branch:** `feature/profile-page` (already created and contains the spec commit)

---

## File Map

**New (10 files):**
- `src/lib/db/profile.ts` — data layer (`getProfileData`, `getProfileStats`)
- `src/actions/change-password.ts` — server action
- `src/actions/delete-account.ts` — server action
- `src/components/profile/ProfileHeader.tsx` — server, avatar + name + email + joined date
- `src/components/profile/ProfileStats.tsx` — server, 2 stat cards + 7-type breakdown bars
- `src/components/profile/ChangePasswordForm.tsx` — client, `useActionState`
- `src/components/profile/DeleteAccountSection.tsx` — client, shadcn `Dialog` + DELETE-typed guard
- `src/app/profile/page.tsx` — server, async, composes everything
- `src/components/ui/card.tsx` — shadcn Card
- `src/components/ui/dialog.tsx` — shadcn Dialog
- `scripts/test-profile.ts` — smoke test for the data layer

**Modified (2 files):**
- `src/proxy.ts` — add `/profile` to the matcher
- `src/app/signin/page.tsx` — add `?deleted=true` banner

**Unmodified but touched by test/verify:**
- `src/lib/utils.ts` — add `formatDateLong`
- `package.json` — new `test:profile` script
- `context/current-feature.md` — History entry at the end (final task)

---

## Task 1: Install shadcn Card + Dialog components

**Files:**
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Install both components via the shadcn CLI**

```bash
npx shadcn@latest add card dialog
```

If the CLI prompts for confirmation, accept the defaults (overwrite if asked). This should create `src/components/ui/card.tsx` and `src/components/ui/dialog.tsx` matching the rest of the shadcn install pattern in this repo (Base UI, not Radix — matches the existing `button.tsx`, `input.tsx`, `badge.tsx`).

- [ ] **Step 2: Verify the files exist**

```bash
ls src/components/ui/card.tsx src/components/ui/dialog.tsx
```

Expected: both paths print, no errors.

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: 0 errors. (shadcn components are generated to match the existing setup.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/dialog.tsx
git commit -m "feat(ui): install shadcn Card and Dialog components"
```

---

## Task 2: Add `formatDateLong` helper to `src/lib/utils.ts`

**Files:**
- Modify: `src/lib/utils.ts:1-10`

- [ ] **Step 1: Add the helper**

Append the new function after the existing `formatDate` in `src/lib/utils.ts`:

```ts
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
```

The file should now look like:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
```

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(utils): add formatDateLong helper for profile page"
```

---

## Task 3: Add data layer `src/lib/db/profile.ts` with smoke test

**Files:**
- Create: `src/lib/db/profile.ts`
- Create: `scripts/test-profile.ts`
- Modify: `package.json:7` (add `test:profile` script)

- [ ] **Step 1: Write the smoke test first (TDD)**

Create `scripts/test-profile.ts`:

```ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getProfileData, getProfileStats } from "../src/lib/db/profile";

async function main() {
  console.log("Looking up demo user...");
  const user = await prisma.user.findUnique({
    where: { email: "demo@devstash.io" },
    select: { id: true, createdAt: true },
  });
  if (!user) {
    throw new Error('Demo user "demo@devstash.io" not found. Run `npm run db:seed`.');
  }
  const userId = user.id;
  console.log(`  userId = ${userId}\n`);

  console.log("Profile data...");
  const profile = await getProfileData(userId);
  console.log(`  email        = ${profile.email}`);
  console.log(`  name         = ${profile.name}`);
  console.log(`  image        = ${profile.image}`);
  console.log(`  hasPassword  = ${profile.hasPassword}`);
  console.log(`  createdAt    = ${profile.createdAt.toISOString()}\n`);

  console.log("Profile stats...");
  const stats = await getProfileStats(userId);
  console.log(`  itemCount       = ${stats.itemCount}`);
  console.log(`  collectionCount = ${stats.collectionCount}\n`);

  console.log("Item type breakdown:");
  for (const row of stats.breakdown) {
    console.log(`  - ${row.name.padEnd(10)} icon=${row.icon.padEnd(12)} color=${row.color} count=${row.count}`);
  }

  if (stats.breakdown.length !== 7) {
    throw new Error(`Expected 7 breakdown rows, got ${stats.breakdown.length}`);
  }
  const sum = stats.breakdown.reduce((a, b) => a + b.count, 0);
  if (sum !== stats.itemCount) {
    throw new Error(`Breakdown sum (${sum}) does not match itemCount (${stats.itemCount})`);
  }

  console.log("\nOK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the test to verify it fails (TDD)**

```bash
npx tsx scripts/test-profile.ts
```

Expected: error like `Cannot find module '../src/lib/db/profile'` or similar import resolution error. (Confirms the test runs but the module doesn't exist yet.)

- [ ] **Step 3: Implement `src/lib/db/profile.ts`**

Create the file with this content:

```ts
import { prisma } from "@/lib/prisma";

export type ProfileData = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  hasPassword: boolean;
};

export type ItemTypeBreakdownRow = {
  typeId: string;
  name: string;
  icon: string;
  color: string;
  count: number;
};

export type ProfileStats = {
  itemCount: number;
  collectionCount: number;
  breakdown: ItemTypeBreakdownRow[];
};

export async function getProfileData(userId: string): Promise<ProfileData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      password: true,
    },
  });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt,
    hasPassword: user.password !== null,
  };
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [itemCount, collectionCount, grouped, systemTypes] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.item.groupBy({
      by: ["itemTypeId"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.itemType.findMany({
      where: { isSystem: true },
      select: { id: true, name: true, icon: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const countByTypeId = new Map<string, number>();
  for (const row of grouped) {
    countByTypeId.set(row.itemTypeId, row._count._all);
  }

  const breakdown: ItemTypeBreakdownRow[] = systemTypes.map((t) => ({
    typeId: t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    count: countByTypeId.get(t.id) ?? 0,
  }));

  return { itemCount, collectionCount, breakdown };
}
```

- [ ] **Step 4: Add the `test:profile` script to `package.json`**

Edit the `"scripts"` block in `package.json` (currently around line 16). Add the line at the end of the scripts block (before the closing `}`):

```json
"test:profile": "tsx scripts/test-profile.ts"
```

The final scripts block should include both `test:collections` and `test:profile`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:status": "prisma migrate status",
  "db:seed": "prisma db seed",
  "db:studio": "prisma studio",
  "test:collections": "tsx scripts/test-collections.ts",
  "test:profile": "tsx scripts/test-profile.ts"
},
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run test:profile
```

Expected output (values match the seed):

```
Looking up demo user...
  userId = <some cuid>

Profile data...
  email        = demo@devstash.io
  name         = Demo User
  image        = null
  hasPassword  = true
  createdAt    = 2026-06-13T...

Profile stats...
  itemCount       = 18
  collectionCount = 5

Item type breakdown:
  - command    icon=Terminal    color=#f97316 count=4
  - file       icon=File        color=#6b7280 count=0
  - image      icon=Image       color=#ec4899 count=0
  - link       icon=Link        color=#10b981 count=5
  - note       icon=StickyNote  color=#fde047 count=1
  - prompt     icon=Sparkles    color=#8b5cf6 count=2
  - snippet    icon=Code        color=#3b82f6 count=6

OK
```

(The exact per-type counts will match the seed in `prisma/seed.ts`. The total must equal 18 and the row count must be 7. The seed breakdown is: React Patterns=3 snippets, AI Workflows=3 prompts, DevOps=4 (2 link + 1 command + 1 snippet), Terminal Commands=4 commands, Design Resources=4 (3 link + 1 note). So the per-type totals are: snippet=4, prompt=3, command=5, note=1, link=5, file=0, image=0 — but verify against your actual seed output.)

If the breakdown sum doesn't match `itemCount`, the script throws. If the row count isn't 7, the script throws.

- [ ] **Step 6: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/profile.ts scripts/test-profile.ts package.json
git commit -m "feat(profile): add data layer (getProfileData, getProfileStats) with smoke test"
```

---

## Task 4: Add `change-password` server action

**Files:**
- Create: `src/actions/change-password.ts`

- [ ] **Step 1: Implement the action**

Create the file:

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
  errors?: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
};

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: NonNullable<ChangePasswordState["errors"]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof typeof fieldErrors;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { errors: fieldErrors };
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { errors: { confirmPassword: "Passwords do not match" } };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user || !user.password) {
      return { error: "Cannot change password for this account" };
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return { errors: { currentPassword: "Current password is incorrect" } };
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    });

    return { success: true };
  } catch (error) {
    console.error("[CHANGE_PASSWORD]", error);
    return { error: "Something went wrong. Please try again." };
  }
}
```

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/change-password.ts
git commit -m "feat(profile): add change-password server action"
```

---

## Task 5: Add `delete-account` server action

**Files:**
- Create: `src/actions/delete-account.ts`

- [ ] **Step 1: Implement the action**

Create the file:

```ts
"use server";

import { z } from "zod/v4";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const schema = z.object({
  confirmText: z.literal("DELETE", {
    message: "Type DELETE to confirm",
  }),
});

export type DeleteAccountState = {
  error?: string;
};

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const raw = {
    confirmText: formData.get("confirmText") as string,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confirmation required" };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    await prisma.user.delete({
      where: { id: session.user.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Account no longer exists" };
    }
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[DELETE_ACCOUNT]", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/signin?deleted=true");
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
```

Note: the `Prisma` import path is `../../src/generated/prisma/client` resolved via the `@/generated/prisma/client` alias (or use the project's existing Prisma client). If `@/generated/prisma/client` does not resolve, import via relative path:

```ts
import { Prisma } from "../../generated/prisma/client";
```

Use whichever import path works — verify with `npx tsc --noEmit` in the next step. (Per the prisma-neon-setup commit, the generator output is at `src/generated/prisma`, and the Prisma namespace should be importable from the client module.)

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors. If the Prisma import path is wrong, fix it per the note in Step 1.

- [ ] **Step 3: Commit**

```bash
git add src/actions/delete-account.ts
git commit -m "feat(profile): add delete-account server action with cascade"
```

---

## Task 6: Add `ProfileHeader` and `ProfileStats` server components

**Files:**
- Create: `src/components/profile/ProfileHeader.tsx`
- Create: `src/components/profile/ProfileStats.tsx`

- [ ] **Step 1: Create `ProfileHeader.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import UserAvatar from "@/components/auth/UserAvatar";
import { formatDateLong } from "@/lib/utils";
import type { ProfileData } from "@/lib/db/profile";

export default function ProfileHeader({ profile }: { profile: ProfileData }) {
  const displayName = profile.name ?? profile.email;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <UserAvatar src={profile.image} name={displayName} size={64} />
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

- [ ] **Step 2: Create `ProfileStats.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIcon } from "@/lib/db/icons";
import type { ProfileStats } from "@/lib/db/profile";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

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

- [ ] **Step 3: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileStats.tsx
git commit -m "feat(profile): add ProfileHeader and ProfileStats server components"
```

---

## Task 7: Add `ChangePasswordForm` and `DeleteAccountSection` client components

**Files:**
- Create: `src/components/profile/ChangePasswordForm.tsx`
- Create: `src/components/profile/DeleteAccountSection.tsx`

- [ ] **Step 1: Create `ChangePasswordForm.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type ChangePasswordState } from "@/actions/change-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ChangePasswordState = {};

function Field({
  id,
  label,
  type,
  error,
}: {
  id: string;
  label: string;
  type: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        {state.success && (
          <div className="mb-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            Password updated successfully.
          </div>
        )}
        {state.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <form ref={formRef} action={formAction} className="space-y-4">
          <Field
            id="currentPassword"
            label="Current password"
            type="password"
            error={state.errors?.currentPassword}
          />
          <Field
            id="newPassword"
            label="New password"
            type="password"
            error={state.errors?.newPassword}
          />
          <Field
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            error={state.errors?.confirmPassword}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `DeleteAccountSection.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/actions/delete-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
          Permanently delete your account and all of your items, collections, and
          custom types. This cannot be undone.
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
                This will permanently delete your account and all associated data.
                Type DELETE below to confirm.
              </DialogDescription>
            </DialogHeader>
            <form action={formAction} className="space-y-4">
              <Input
                name="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                aria-label="Type DELETE to confirm"
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!canDelete || pending}
                >
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

- [ ] **Step 3: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors. (The shadcn `Dialog` and `DialogClose` exports from Task 1 must exist.)

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/ChangePasswordForm.tsx src/components/profile/DeleteAccountSection.tsx
git commit -m "feat(profile): add ChangePasswordForm and DeleteAccountSection client components"
```

---

## Task 8: Add `src/app/profile/page.tsx` server page

**Files:**
- Create: `src/app/profile/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
import { getCurrentUserId } from "@/lib/db/user";
import { getProfileData, getProfileStats } from "@/lib/db/profile";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileStats from "@/components/profile/ProfileStats";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";
import DeleteAccountSection from "@/components/profile/DeleteAccountSection";

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

- [ ] **Step 2: Lint + typecheck + build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Expected: 0 errors. The build should complete and produce a route for `/profile`. (Visiting `/profile` directly won't work yet — the proxy matcher still needs updating in Task 9 — but the build itself should succeed.)

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): add /profile page composing all profile components"
```

---

## Task 9: Update proxy matcher to protect `/profile`

**Files:**
- Modify: `src/proxy.ts:15-17`

- [ ] **Step 1: Add `/profile` to the matcher**

Edit `src/proxy.ts`. The final `config` object should be:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/profile"],
};
```

(The existing logic in the `proxy` export is unchanged — it already handles `req.auth` redirects for any matched route, but the `isDashboard` check inside the function only redirects for `/dashboard/*` paths. Read the current `proxy.ts` and update both the `isDashboard` check AND the matcher.)

The corrected full file:

```ts
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isProfile = req.nextUrl.pathname === "/profile";
  if ((isDashboard || isProfile) && !req.auth) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile"],
};
```

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(profile): protect /profile route via proxy matcher"
```

---

## Task 10: Add `?deleted=true` banner to signin page

**Files:**
- Modify: `src/app/signin/page.tsx:8-31`

- [ ] **Step 1: Update the type and destructure for `deleted`**

Edit `src/app/signin/page.tsx`. Change the `searchParams` type to include `deleted`:

```ts
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; registered?: string; deleted?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, registered, deleted } = await searchParams;
```

- [ ] **Step 2: Add the banner below the existing `registered` banner**

Add this block immediately after the existing `{registered === "true" && (...)}` block:

```tsx
{deleted === "true" && (
  <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
    Your account has been deleted.
  </div>
)}
```

- [ ] **Step 3: Lint + typecheck + build**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/signin/page.tsx
git commit -m "feat(profile): show success banner on signin after account deletion"
```

---

## Task 11: Final verification + history entry

**Files:**
- Modify: `context/current-feature.md` (History section)

- [ ] **Step 1: Run all checks**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Expected: 0 errors across all three.

- [ ] **Step 2: Run smoke test**

```bash
npm run test:profile
```

Expected: prints profile data + 7 breakdown rows + `OK`. Compare counts against the seed.

- [ ] **Step 3: Manual browser verification**

Start the dev server: `npm run dev` (in a separate terminal or background).

Sign in at `/signin` as `demo@devstash.io` / `12345678`. Then verify each step:

1. **Visit `/profile`** — page loads, shows:
   - Header: avatar (initials `D` since image is null), name `Demo User`, email `demo@devstash.io`, `Member since {date}`
   - Usage card: `Items 18`, `Collections 5`, 7 rows of breakdown (matches the smoke test output)
   - Change password card: visible (hasPassword is true)
   - Danger zone card: visible
2. **Change password card** — submit empty form → see field errors. Submit wrong current password → "Current password is incorrect". Submit mismatched confirm → "Passwords do not match". Submit valid (current=`12345678`, new=`newpass123`, confirm=`newpass123`) → success banner, form clears. Sign out, sign in with new password → success. Restore seed: `npm run db:seed`.
3. **Delete account card** — click button → dialog opens, type "DELETE" → button enables. Click → redirect to `/signin?deleted=true` → see "Your account has been deleted" banner. Sign in again: `npm run db:seed` re-creates the demo user (since the cascade wiped them).
4. **OAuth-only user simulation** — temporarily flip `password` to null in the DB for the demo user (`prisma.user.update({ where: { email: 'demo@devstash.io' }, data: { password: null } })`), then visit `/profile`. Confirm the Change password card is hidden; Danger zone is still visible. Restore: `npm run db:seed`.
5. **Unauthed visit** — sign out, visit `/profile` directly → redirect to `/signin?callbackUrl=/profile`.
6. **Empty stats** — `npx tsx -e "import { prisma } from './src/lib/prisma'; (await prisma.item.deleteMany({ where: { user: { email: 'demo@devstash.io' } } })).count"` then visit `/profile` → breakdown shows 7 rows all with count 0, bar widths 0%. Restore: `npm run db:seed`.

- [ ] **Step 4: Append history entry to `context/current-feature.md`**

Edit `context/current-feature.md`. Add this bullet at the end of the `## History` list (the last entry currently is the Auth Phase 3 line):

```markdown
- 2026-06-17: **Profile Page** completed on `feature/profile-page`. **Spec & Plan:** source spec `context/features/profile-spec.md`; design doc `docs/superpowers/specs/2026-06-17-profile-page-design.md`; implementation plan `docs/superpowers/plans/2026-06-17-profile-page.md`. **Goals:** standalone `/profile` route (outside the dashboard layout, protected by extending the proxy matcher to include `/profile`) with read-only account info, 7-type item breakdown with bar visualization, change-password form (hidden for OAuth-only users, requires current password verification), and delete-account with shadcn `Dialog` + literal "DELETE" typed confirmation. **Process — skills used:** `brainstorming` (4 clarifying questions on delete behavior, password flow, page structure, and breakdown display), `writing-plans` (11-task plan), `subagent-driven-development` (recommended for execution). **Implementation:** new shadcn `Card` + `Dialog` components; `formatDateLong` added to `src/lib/utils.ts`; `src/lib/db/profile.ts` with `getProfileData` (selects `password` and reduces to `hasPassword` boolean) and `getProfileStats` (parallel `item.count` + `collection.count` + `item.groupBy` + `itemType.findMany` for 7-row breakdown with zero-fill); `src/actions/change-password.ts` and `src/actions/delete-account.ts` server actions (hard delete with Prisma cascade; `P2025` handled as "Account no longer exists"); `src/components/profile/{ProfileHeader,ProfileStats,ChangePasswordForm,DeleteAccountSection}.tsx`; `src/app/profile/page.tsx` async server component composing all four; proxy matcher extended to `["/dashboard/:path*", "/profile"]`; signin page shows `?deleted=true` banner. `scripts/test-profile.ts` smoke test exercises both data functions against the demo user; 7 breakdown rows asserted; per-type count sum asserted to equal total item count. `npm run lint` + `npx tsc --noEmit` + `npm run build` all green.
```

- [ ] **Step 5: Commit final state**

```bash
git add context/current-feature.md
git commit -m "docs(profile): mark profile page complete, add history entry"
```

- [ ] **Step 6: Confirm branch state**

```bash
git log --oneline main..HEAD
```

Expected: ~12 commits, oldest to newest:
1. `chore(profile): add spec and set current-feature status to In Progress`
2. `docs(profile): add design spec for profile page feature`
3. `feat(ui): install shadcn Card and Dialog components`
4. `feat(utils): add formatDateLong helper for profile page`
5. `feat(profile): add data layer (getProfileData, getProfileStats) with smoke test`
6. `feat(profile): add change-password server action`
7. `feat(profile): add delete-account server action with cascade`
8. `feat(profile): add ProfileHeader and ProfileStats server components`
9. `feat(profile): add ChangePasswordForm and DeleteAccountSection client components`
10. `feat(profile): add /profile page composing all profile components`
11. `feat(profile): protect /profile route via proxy matcher`
12. `feat(profile): show success banner on signin after account deletion`
13. `docs(profile): mark profile page complete, add history entry`

(The first two commits were made during the brainstorming/setup phase. Tasks 3–11 of this plan add commits 3–13.)

---

## Self-Review (checked after writing the plan)

**1. Spec coverage:**
- ✅ `/profile` route — Task 8
- ✅ Display user info (email, name, avatar, account creation date) — Task 6 (`ProfileHeader`)
- ✅ Usage stats (total items, total collections, breakdown by item type) — Task 6 (`ProfileStats`) + Task 3 (data layer)
- ✅ Change password (email users only) — Task 4 (action) + Task 7 (`ChangePasswordForm`) + Task 8 (conditional render)
- ✅ Delete account with confirmation — Task 5 (action) + Task 7 (`DeleteAccountSection` with Dialog) + Task 10 (post-delete banner)
- ✅ Follow existing patterns — reuses `getCurrentUserId`, `UserAvatar`, `getIcon`, `Button`, `Input`, `getDashboardCollectionStats` pattern, `useActionState`, `prisma.item.count`/`groupBy`/`findMany`, shadcn UI
- ✅ Route protected — Task 9 (proxy matcher)

**2. Placeholder scan:** No TBD/TODO. No "implement later". Every code block is complete and copy-pasteable. No "similar to Task N" — each task's code is self-contained.

**3. Type consistency:** `ProfileData`, `ProfileStats`, `ItemTypeBreakdownRow` are defined in Task 3 and used in Task 6. `ChangePasswordState` defined in Task 4 and used in Task 7. `DeleteAccountState` defined in Task 5 and used in Task 7. All match.

**4. Import path check:** The `Prisma` import in Task 5 has a fallback note for the import path. The shadcn `Dialog` exports are assumed to match the shadcn default (which is `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`). If shadcn's output differs, the engineer must adjust the imports in Task 7 — verify after Task 1.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-profile-page.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
