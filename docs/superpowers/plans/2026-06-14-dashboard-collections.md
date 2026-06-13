# Dashboard Collections DB Wire-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's `mockCollections` data with real Prisma-fetched data from Neon, render the correct border color and type icons per collection, and wire the 2 collection-related stats to the DB — keeping the visual design from `context/screenshots/dashboard-ui-main.png` intact.

**Architecture:** New `src/lib/db/` namespace holds the data layer (`user.ts`, `icons.ts`, `collections.ts`). The dashboard page becomes an async server component that runs the db calls in parallel and passes the result to the existing `StatsCards` (unchanged) and a refactored `RecentCollections` (now prop-driven). No new dependencies, no schema changes, no migrations.

**Tech Stack:** Next.js 16 App Router (server components), Prisma 7 + `@prisma/adapter-neon` (already in place), `tsx` for the smoke-test script, TypeScript strict mode. No test framework is added in this feature — verification is via a `scripts/test-collections.ts` smoke script (matches the existing `scripts/test-db.ts` pattern) plus `npm run lint`, `tsc --noEmit`, and `npm run build`.

---

## File Structure

### New files
- `src/lib/db/user.ts` — `getCurrentUserId()`: looks up the hardcoded demo user by email; throws a helpful error if the seed hasn't been run.
- `src/lib/db/icons.ts` — `ICON_REGISTRY` (string → Lucide component) + `getIcon(name)` with a `File` fallback. Pure module-level mapping; no I/O.
- `src/lib/db/collections.ts` — types (`TypeSummary`, `DashboardCollection`, `DashboardCollectionStats`) + two functions: `getDashboardCollectionStats` (two `count()` queries in `Promise.all`) and `getDashboardCollections` (single `findMany` with `include`, then in-memory aggregation of types and dominant type).
- `scripts/test-collections.ts` — smoke test that exercises all three new files and prints expected output for visual verification.

### Modified files
- `src/app/dashboard/page.tsx` — drop `mock-data` import; become `async`; call `getCurrentUserId()` + both `collections.ts` functions in `Promise.all`; pass results to `StatsCards` (2 new counts, 2 placeholders) and `RecentCollections` (new prop).
- `src/components/dashboard/RecentCollections.tsx` — drop `mock-data` import and hardcoded `PREVIEW_ICONS`; accept `collections: DashboardCollection[]` prop; add `border-l-4` + dynamic `borderLeftColor`; resolve icons via `getIcon`; cap render at 6 cards.

### Untouched
- `src/lib/prisma.ts` (existing singleton, reused as-is)
- `src/lib/mock-data.ts` (still used by `PinnedItems`, `RecentItems`, `Sidebar`, `TopBar`)
- `src/components/dashboard/StatsCards.tsx` (already prop-driven)
- `prisma/schema.prisma` and `prisma/seed.ts` (no changes)

---

## Task 1: `src/lib/db/user.ts` — current user lookup

**Files:**
- Create: `src/lib/db/user.ts`
- Create: `scripts/test-collections.ts`

- [ ] **Step 1: Create `src/lib/db/user.ts`**

```ts
import { prisma } from "@/lib/prisma";

const DEMO_USER_EMAIL = "demo@devstash.io";

export async function getCurrentUserId(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Demo user "${DEMO_USER_EMAIL}" not found. Run \`npm run db:seed\` to create it.`,
    );
  }
  return user.id;
}
```

- [ ] **Step 2: Create `scripts/test-collections.ts` (smoke test stub)**

```ts
import "dotenv/config";
import { getCurrentUserId } from "../src/lib/db/user";

async function main() {
  console.log("Looking up demo user...");
  const userId = await getCurrentUserId();
  console.log(`  userId = ${userId}`);
  console.log("OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
```

- [ ] **Step 3: Add the smoke-test script to `package.json`**

Edit `package.json` `scripts` block — add the new line (keep all existing lines):

```json
"test:collections": "tsx scripts/test-collections.ts"
```

Place it after `"db:studio"` (last db script), before the closing `}`. Result should be:

```json
"db:generate": "prisma generate",
"db:migrate":  "prisma migrate dev",
"db:deploy":   "prisma migrate deploy",
"db:status":   "prisma migrate status",
"db:seed":     "prisma db seed",
"db:studio":   "prisma studio",
"test:collections": "tsx scripts/test-collections.ts"
```

- [ ] **Step 4: Run the smoke test and verify it works**

Run: `npm run test:collections`
Expected output (exact user id will differ — `cuid()` is random):

```
Looking up demo user...
  userId = <some cuid like ckxxxxxxxxxxxxxxxxxxxxx>
OK
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/user.ts scripts/test-collections.ts package.json
git commit -m "feat(db): add getCurrentUserId() helper for demo user"
```

---

## Task 2: `src/lib/db/icons.ts` — lucide icon registry

**Files:**
- Create: `src/lib/db/icons.ts`

- [ ] **Step 1: Create `src/lib/db/icons.ts`**

```ts
import {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link,
  type LucideIcon,
} from "lucide-react";

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link,
};

export function getIcon(name: string): LucideIcon {
  return ICON_REGISTRY[name] ?? File;
}
```

- [ ] **Step 2: Type-check to verify**

Run: `npx tsc --noEmit`
Expected: zero errors. (This is the "test" for a pure mapping module — no I/O, no smoke test needed.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/icons.ts
git commit -m "feat(db): add lucide icon registry keyed by ItemType.icon"
```

---

## Task 3: `src/lib/db/collections.ts` — types + stats function

**Files:**
- Modify: `src/lib/db/collections.ts` (create with full content)
- Modify: `scripts/test-collections.ts` (extend smoke test)

- [ ] **Step 1: Create `src/lib/db/collections.ts` with types + stats function only**

```ts
import { prisma } from "@/lib/prisma";

export type TypeSummary = {
  name: string;
  icon: string;
  color: string;
  count: number;
};

export type DashboardCollection = {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  updatedAt: Date;
  types: TypeSummary[];
  dominantType: TypeSummary | null;
};

export type DashboardCollectionStats = {
  collectionCount: number;
  favoriteCollectionCount: number;
};

export async function getDashboardCollectionStats(
  userId: string,
): Promise<DashboardCollectionStats> {
  const [collectionCount, favoriteCollectionCount] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);
  return { collectionCount, favoriteCollectionCount };
}
```

- [ ] **Step 2: Extend `scripts/test-collections.ts` to exercise the stats function**

Replace the entire file with:

```ts
import "dotenv/config";
import { getCurrentUserId } from "../src/lib/db/user";
import {
  getDashboardCollectionStats,
  getDashboardCollections,
} from "../src/lib/db/collections";

async function main() {
  console.log("Looking up demo user...");
  const userId = await getCurrentUserId();
  console.log(`  userId = ${userId}\n`);

  console.log("Collection stats...");
  const stats = await getDashboardCollectionStats(userId);
  console.log(`  collectionCount       = ${stats.collectionCount}`);
  console.log(`  favoriteCollectionCount = ${stats.favoriteCollectionCount}\n`);

  console.log("Dashboard collections (with dominant type)...");
  const collections = await getDashboardCollections(userId);
  for (const c of collections) {
    const dom = c.dominantType
      ? `${c.dominantType.name} (${c.dominantType.color})`
      : "none";
    const typeList = c.types
      .map((t) => `${t.name}:${t.count}`)
      .join(", ");
    console.log(
      `  - ${c.name}  [items=${c.itemCount}, fav=${c.isFavorite}, dominant=${dom}]  types=[${typeList}]`,
    );
  }

  console.log("\nOK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
```

Note: this step **adds** the import of `getDashboardCollections` even though that function doesn't exist yet — that will be added in Task 4 and verified there. The `import` here causes a type error today, which the next task resolves.

- [ ] **Step 3: Type-check — confirm only the missing `getDashboardCollections` is flagged**

Run: `npx tsc --noEmit`
Expected: one error — `Module '"../src/lib/db/collections"' has no exported member 'getDashboardCollections'`. (This is the planned error; the stats function and types compile clean.)

- [ ] **Step 4: Run the partial smoke test (stats only) by temporarily commenting the missing call**

In `scripts/test-collections.ts`, **temporarily** wrap the collections block:

```ts
// console.log("Dashboard collections (with dominant type)...");
// const collections = await getDashboardCollections(userId);
// for (const c of collections) {
//   const dom = c.dominantType
//     ? `${c.dominantType.name} (${c.dominantType.color})`
//     : "none";
//   const typeList = c.types
//     .map((t) => `${t.name}:${t.count}`)
//     .join(", ");
//   console.log(
//     `  - ${c.name}  [items=${c.itemCount}, fav=${c.isFavorite}, dominant=${dom}]  types=[${typeList}]`,
//   );
// }
```

Run: `npm run test:collections`
Expected (exact counts depend on seed state — these are the current seed values):

```
Looking up demo user...
  userId = <some cuid>

Collection stats...
  collectionCount       = 5
  favoriteCollectionCount = 3

Dashboard collections (with dominant type)...
  <commented out>

OK
```

Verify `collectionCount = 5` and `favoriteCollectionCount = 3` (per the current seed: 3 favorites are React Patterns, Context Files, Git Commands).

- [ ] **Step 5: Restore the commented block in `scripts/test-collections.ts`**

Uncomment the lines that were commented in Step 4. (The file is back to the version shown in Step 2.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/collections.ts scripts/test-collections.ts
git commit -m "feat(db): add dashboard collection stats + types"
```

---

## Task 4: Add `getDashboardCollections` to `collections.ts` (with aggregation)

**Files:**
- Modify: `src/lib/db/collections.ts:1` (append the new function at the end of the file)

- [ ] **Step 1: Append `getDashboardCollections` to `src/lib/db/collections.ts`**

Append the following at the **end** of the file (after the closing brace of `getDashboardCollectionStats`):

```ts

export async function getDashboardCollections(
  userId: string,
): Promise<DashboardCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        select: {
          itemType: { select: { name: true, icon: true, color: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const typeMap = new Map<string, TypeSummary>();
    for (const { itemType } of row.items) {
      const existing = typeMap.get(itemType.name);
      if (existing) {
        existing.count += 1;
      } else {
        typeMap.set(itemType.name, {
          name: itemType.name,
          icon: itemType.icon,
          color: itemType.color,
          count: 1,
        });
      }
    }
    const types = Array.from(typeMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isFavorite: row.isFavorite,
      itemCount: row.items.length,
      updatedAt: row.updatedAt,
      types,
      dominantType: types[0] ?? null,
    };
  });
}
```

- [ ] **Step 2: Type-check — confirm zero errors**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run the full smoke test**

Run: `npm run test:collections`
Expected (counts depend on current seed):

```
Looking up demo user...
  userId = <some cuid>

Collection stats...
  collectionCount       = 5
  favoriteCollectionCount = 3

Dashboard collections (with dominant type)...
  - React Patterns  [items=3, fav=true, dominant=snippet (#3b82f6)]  types=[snippet:3]
  - AI Workflows  [items=3, fav=false, dominant=prompt (#8b5cf6)]  types=[prompt:3]
  - DevOps  [items=4, fav=false, dominant=snippet (#3b82f6)]  types=[snippet:1, link:2, command:1]
  - Terminal Commands  [items=4, fav=false, dominant=command (#f97316)]  types=[command:4]
  - Design Resources  [items=4, fav=false, dominant=link (#10b981)]  types=[link:4]

OK
```

Note: order may differ if `updatedAt` collides — that's fine. Verify each collection's `itemCount`, `dominant`, and per-type breakdown matches the seed. The most important cross-check is `DevOps` having 3 distinct types (snippet/link/command) summing to 4, with `snippet` and `link` both at 2 — in that case alphabetical tiebreak puts `link` first. Adjust expectations if the seed has changed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/collections.ts
git commit -m "feat(db): add getDashboardCollections with type aggregation"
```

---

## Task 5: Wire `src/app/dashboard/page.tsx` to the db

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite, 28 lines)

- [ ] **Step 1: Replace the file contents with the async version**

Replace the entire contents of `src/app/dashboard/page.tsx` with:

```tsx
import { getCurrentUserId } from "@/lib/db/user";
import {
  getDashboardCollections,
  getDashboardCollectionStats,
} from "@/lib/db/collections";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentCollections from "@/components/dashboard/RecentCollections";
import PinnedItems from "@/components/dashboard/PinnedItems";
import RecentItems from "@/components/dashboard/RecentItems";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [collections, collStats] = await Promise.all([
    getDashboardCollections(userId),
    getDashboardCollectionStats(userId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your developer knowledge hub</p>
      </div>
      <StatsCards
        itemCount={0}
        collectionCount={collStats.collectionCount}
        favoriteItemCount={0}
        favoriteCollectionCount={collStats.favoriteCollectionCount}
      />
      <RecentCollections collections={collections} />
      <PinnedItems />
      <RecentItems />
    </div>
  );
}
```

`itemCount={0}` and `favoriteItemCount={0}` are temporary placeholders; the item-stats feature will replace them in a later commit. Documented in the design spec.

- [ ] **Step 2: Type-check — confirm a single type error from `RecentCollections`**

Run: `npx tsc --noEmit`
Expected: exactly one error — `Property 'collections' is missing in type '{}' ...` pointing at `<RecentCollections />`. This is the planned error; Task 6 fixes it.

- [ ] **Step 3: Commit (the error is expected and isolated to the next task)**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): wire page to db helpers (item stats still mocked as 0)"
```

---

## Task 6: Refactor `src/components/dashboard/RecentCollections.tsx`

**Files:**
- Modify: `src/components/dashboard/RecentCollections.tsx` (full rewrite, 56 lines → ~60 lines)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/dashboard/RecentCollections.tsx` with:

```tsx
import Link from "next/link";
import { Star, MoreHorizontal } from "lucide-react";
import type { DashboardCollection } from "@/lib/db/collections";
import { getIcon } from "@/lib/db/icons";

export default function RecentCollections({
  collections,
}: {
  collections: DashboardCollection[];
}) {
  const visible = collections.slice(0, 6);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Collections</h2>
        <Link
          href="/collections"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((collection) => (
          <div
            key={collection.id}
            className="bg-card border border-border border-l-4 rounded-xl p-4 flex flex-col gap-2 group cursor-pointer hover:bg-muted/10 transition-colors"
            style={
              collection.dominantType
                ? { borderLeftColor: collection.dominantType.color }
                : undefined
            }
          >
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{collection.name}</h3>
                {collection.isFavorite && (
                  <Star className="size-3.5 text-yellow-400 shrink-0" fill="currentColor" />
                )}
              </div>
              <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{collection.itemCount} items</p>
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
              {collection.description}
            </p>
            {collection.types.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                {collection.types.map((t) => {
                  const Icon = getIcon(t.icon);
                  return <Icon key={t.name} className="size-3.5" style={{ color: t.color }} />;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check — confirm zero errors**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint — confirm zero errors**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/RecentCollections.tsx
git commit -m "feat(dashboard): render collections from prop with dynamic border + icons"
```

---

## Task 7: Final verification

**Files:** none modified

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: completes successfully (a few `Compiled successfully` / route-summary lines, zero errors).

- [ ] **Step 4: Dev server visual check**

Run: `npm run dev` (in a separate terminal, or in the background if your shell supports it).
Then: open `http://localhost:3000/dashboard` in the browser.
Expected:

- 5 collection cards render (matches the seed: React Patterns, AI Workflows, DevOps, Terminal Commands, Design Resources), in some `updatedAt desc` order
- Each card has a left border in its dominant type's color:
  - React Patterns → blue (`#3b82f6`, snippet)
  - AI Workflows → purple (`#8b5cf6`, prompt)
  - DevOps → green (`#10b981`, link) if link:2 > snippet:1 — otherwise blue (snippet:1, link:2) — actually with the alphabetical tiebreak on equal counts, the dominant for DevOps depends on which type is the highest count. Verify visually it matches the smoke-test output from Task 4 Step 3.
  - Terminal Commands → orange (`#f97316`, command)
  - Design Resources → green (`#10b981`, link)
- The "Collections" stat card shows `5`; the "Favorite Collections" stat card shows `3`
- The "Items" and "Favorite Items" stat cards show `0` (placeholder; expected and documented)
- The icons row at the bottom of each card reflects the actual types present (e.g., DevOps shows a snippet + command + 2 link icons)

If any of the above is wrong, do **not** commit — debug before continuing. (The smoke test in Task 4 is the authoritative source of truth for the data; the visual check confirms the UI mapping.)

- [ ] **Step 5: Update `context/current-feature.md` History**

Append a new bullet to the **History** section (bottom of the file) summarizing the work. Follow the format of the existing bullets — single-line, date prefix, em-dash-separated headline, **Goals**, **Process** (skills used), **Implementation** (files + key changes), **Verification** (commands run).

- [ ] **Step 6: Commit the history update**

```bash
git add context/current-feature.md
git commit -m "docs(context): record dashboard-collections feature completion"
```

---

## Plan Self-Review

**1. Spec coverage:**
- Create `src/lib/db/collections.ts` with data fetching → Tasks 3 + 4 ✓
- Fetch collections directly in server component → Task 5 ✓
- Border color from most-used content type → Task 4 (dominantType) + Task 6 (UI) ✓
- Show small icons of all types in collection → Task 4 (types aggregation) + Task 6 (UI via `getIcon`) ✓
- Keep current design → Task 6 (preserves card markup) ✓
- Update collection stats display → Task 3 (stats function) + Task 5 (wire to page) ✓
- `src/lib/db/user.ts` for current-user lookup → Task 1 ✓
- `src/lib/db/icons.ts` icon registry → Task 2 ✓
- `scripts/test-collections.ts` smoke test → Tasks 1, 3, 4 ✓
- Final verification → Task 7 ✓

**2. Placeholder scan:** No TBD/TODO. All code blocks are complete. The `[TEMP]` placeholders for item stats are explicit and documented.

**3. Type consistency:** `DashboardCollection`, `TypeSummary`, `DashboardCollectionStats` defined once in Task 3 and reused unchanged in Tasks 4, 5, 6. `getCurrentUserId`, `getDashboardCollections`, `getDashboardCollectionStats`, `getIcon`, `ICON_REGISTRY` all use the exact signatures defined in their introducing task. The `border-l-4` Tailwind class + inline `borderLeftColor` style is consistent between spec and Task 6 code.
