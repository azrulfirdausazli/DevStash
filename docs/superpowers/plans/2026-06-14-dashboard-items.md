# Dashboard Items DB Wire-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's `mockItems` data in both the **Pinned Items** and **Recent Items** sections with real Prisma-fetched data from Neon, hide the Pinned section when empty, derive each card's icon container color from the item's type, and keep the visual design from `context/screenshots/dashboard-ui-main.png` intact. The 2 item-related stat cards stay at `0` (per the brainstorming decision — out of scope).

**Architecture:** New `src/lib/db/items.ts` holds the data layer (one file: 2 types + 2 single-purpose functions). The dashboard page becomes a 4-call `Promise.all` (existing 2 collection calls + 2 new item calls). `PinnedItems` and `RecentItems` become prop-driven server components, with the hardcoded `TYPE_MAP` replaced by the existing `getIcon` helper. No new dependencies, no schema changes, no migrations, no new smoke-test script.

**Tech Stack:** Next.js 16 App Router (server components), Prisma 7 + `@prisma/adapter-neon` (already in place), `lucide-react` for icons, TypeScript strict mode. No test framework — verification is via `npm run lint`, `tsc --noEmit`, `npm run build`, and a manual `/dashboard` browser check.

---

## File Structure

### New files
- `src/lib/db/items.ts` — `DashboardItemType` + `DashboardItem` types and two functions: `getDashboardPinnedItems(userId)` and `getDashboardRecentItems(userId)`. Each is a single `prisma.item.findMany` with `itemType` and `tags` includes.

### Modified files
- `src/app/dashboard/page.tsx` — add the 2 new db imports; extend the existing `Promise.all` to 4 entries; pass results to `PinnedItems` and `RecentItems` as new props. `StatsCards` placeholders (`itemCount={0}`, `favoriteItemCount={0}`) stay as-is.
- `src/components/dashboard/PinnedItems.tsx` — drop `mockItems` import + the 7 `lucide-react` icon imports + the hardcoded `TYPE_MAP`; accept `items: DashboardItem[]` prop; resolve icon via `getIcon(item.itemType.icon)`; tint container via `${item.itemType.color}22`; empty-state guard `if (items.length === 0) return null;` preserved.
- `src/components/dashboard/RecentItems.tsx` — same pattern as `PinnedItems`, plus drop the client-side `.sort(...).slice(0, 10)` (server does it).

### Untouched
- `src/lib/prisma.ts` (existing singleton, reused as-is)
- `src/lib/mock-data.ts` (still used by `Sidebar` and `TopBar`)
- `src/lib/db/user.ts`, `src/lib/db/icons.ts`, `src/lib/db/collections.ts` (all reused as-is)
- `src/components/dashboard/StatsCards.tsx` (unchanged — already prop-driven)
- `src/components/dashboard/RecentCollections.tsx` (unchanged)
- `prisma/schema.prisma` and `prisma/seed.ts` (no changes)
- `package.json` (no script changes)

---

## Task 1: `src/lib/db/items.ts` — types + 2 functions

**Files:**
- Create: `src/lib/db/items.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/db/items.ts` with the following content:

```ts
import { prisma } from "@/lib/prisma";

export type DashboardItemType = {
  name: string;
  icon: string;
  color: string;
};

export type DashboardItem = {
  id: string;
  title: string;
  description: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  language: string | null;
  createdAt: Date;
  itemType: DashboardItemType;
  tags: { name: string }[];
};

export async function getDashboardPinnedItems(
  userId: string,
): Promise<DashboardItem[]> {
  return prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { createdAt: "desc" },
    include: {
      itemType: { select: { name: true, icon: true, color: true } },
      tags: { select: { name: true } },
    },
  });
}

export async function getDashboardRecentItems(
  userId: string,
): Promise<DashboardItem[]> {
  return prisma.item.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      itemType: { select: { name: true, icon: true, color: true } },
      tags: { select: { name: true } },
    },
  });
}
```

- [ ] **Step 2: Type-check to verify**

Run: `npx tsc --noEmit`
Expected: zero errors. (The functions are typed and Prisma's `include` returns a fully-typed shape; no runtime smoke test is needed for this task — Task 5 covers end-to-end verification.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/items.ts
git commit -m "feat(db): add getDashboardPinnedItems + getDashboardRecentItems"
```

---

## Task 2: Wire `src/app/dashboard/page.tsx` to the items db helpers

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite, 35 lines → 38 lines)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/app/dashboard/page.tsx` with:

```tsx
import { getCurrentUserId } from "@/lib/db/user";
import {
  getDashboardCollections,
  getDashboardCollectionStats,
} from "@/lib/db/collections";
import {
  getDashboardPinnedItems,
  getDashboardRecentItems,
} from "@/lib/db/items";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentCollections from "@/components/dashboard/RecentCollections";
import PinnedItems from "@/components/dashboard/PinnedItems";
import RecentItems from "@/components/dashboard/RecentItems";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [collections, collStats, pinnedItems, recentItems] = await Promise.all([
    getDashboardCollections(userId),
    getDashboardCollectionStats(userId),
    getDashboardPinnedItems(userId),
    getDashboardRecentItems(userId),
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
      <PinnedItems items={pinnedItems} />
      <RecentItems items={recentItems} />
    </div>
  );
}
```

`itemCount={0}` and `favoriteItemCount={0}` are documented placeholders (per the design's brainstorming decision); they remain unchanged and will be wired in a future feature.

- [ ] **Step 2: Type-check — confirm exactly 2 errors from PinnedItems + RecentItems**

Run: `npx tsc --noEmit`
Expected: exactly two errors, both of the form `Property 'items' is missing in type '{}' ...`, pointing at `<PinnedItems />` and `<RecentItems />`. These are the planned errors; Tasks 3 and 4 fix them.

- [ ] **Step 3: Commit (the errors are expected and isolated to the next two tasks)**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): wire page to items db helpers (stats still 0)"
```

---

## Task 3: Refactor `src/components/dashboard/PinnedItems.tsx`

**Files:**
- Modify: `src/components/dashboard/PinnedItems.tsx` (full rewrite, 86 lines → 60 lines)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/dashboard/PinnedItems.tsx` with:

```tsx
import { Pin, Star } from "lucide-react";
import type { DashboardItem } from "@/lib/db/items";
import { getIcon } from "@/lib/db/icons";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PinnedItems({ items }: { items: DashboardItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Pin className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Pinned</h2>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const { itemType } = item;
          const Icon = getIcon(itemType.icon);
          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
            >
              <div
                className="size-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${itemType.color}22` }}
              >
                <Icon className="size-4" style={{ color: itemType.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  {item.isFavorite && (
                    <Star className="size-3.5 text-yellow-400 shrink-0" fill="currentColor" />
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{item.description}</p>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((t) => (
                      <span
                        key={t.name}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{formatDate(item.createdAt)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check — confirm exactly 1 error from RecentItems**

Run: `npx tsc --noEmit`
Expected: exactly one error, `Property 'items' is missing in type '{}' ...` pointing at `<RecentItems />`. The PinnedItems error from Task 2 is resolved.

- [ ] **Step 3: Lint — confirm zero errors**

Run: `npm run lint`
Expected: zero errors. (No unused imports — the 7 dropped `lucide-react` icon imports are no longer referenced; the dropped `LucideIcon` type import is also unused.)

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/PinnedItems.tsx
git commit -m "feat(dashboard): render pinned items from prop with type-derived color"
```

---

## Task 4: Refactor `src/components/dashboard/RecentItems.tsx`

**Files:**
- Modify: `src/components/dashboard/RecentItems.tsx` (full rewrite, 88 lines → 65 lines)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/dashboard/RecentItems.tsx` with:

```tsx
import { Clock, Star } from "lucide-react";
import type { DashboardItem } from "@/lib/db/items";
import { getIcon } from "@/lib/db/icons";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentItems({ items }: { items: DashboardItem[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recent Items</h2>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const { itemType } = item;
          const Icon = getIcon(itemType.icon);
          return (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
            >
              <div
                className="size-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${itemType.color}22` }}
              >
                <Icon className="size-3.5" style={{ color: itemType.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{item.title}</span>
                  {item.isFavorite && (
                    <Star className="size-3 text-yellow-400 shrink-0" fill="currentColor" />
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {item.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {item.tags.slice(0, 2).map((t) => (
                      <span
                        key={t.name}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check — confirm zero errors**

Run: `npx tsc --noEmit`
Expected: zero errors. (The RecentItems error from Task 3 is resolved; the whole project now type-checks.)

- [ ] **Step 3: Lint — confirm zero errors**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/RecentItems.tsx
git commit -m "feat(dashboard): render recent items from prop with type-derived color"
```

---

## Task 5: Final verification + history update

**Files:**
- Modify: `context/current-feature.md` (append History entry)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: completes successfully (a few `Compiled successfully` / route-summary lines, zero errors). Confirms the production build is clean.

- [ ] **Step 4: Dev server visual check**

Run: `npm run dev` (in a separate terminal, or in the background if your shell supports it).
Then: open `http://localhost:3000/dashboard` in the browser.

Expected:

- **Pinned section is NOT rendered.** The current seed has 0 items with `isPinned: true` — confirms the `if (items.length === 0) return null;` guard works.
- **Recent Items** shows 10 cards (the 10 most recent of the 18 seed items), in `createdAt desc` order. The 10 most recent (by seed creation time, all set to `now` at seed time, so insertion order is `createdAt desc`):
  1. "Lucide icon library" (link) → green
  2. "Radix UI Primitives" (link) → green
  3. "shadcn/ui components" (link) → green
  4. "Tailwind CSS documentation" (link) → green
  5. "Upgrade all npm dependencies to latest" (command) → orange
  6. "Kill the process listening on a port" (command) → orange
  7. "Prune all unused Docker objects" (command) → orange
  8. "Undo last commit, keep changes staged" (command) → orange
  9. "Docker official documentation" (link) → green
  10. "Vercel deployment docs" (link) → green
- **Each card's icon container is tinted in the correct item-type color** (orange for commands, green for links).
- **Tags sections are empty** for all items — the current seed creates no tags. (No visual difference from the mock data flow, which would also show empty tag rows.)
- **No console errors or hydration warnings** in the browser devtools.
- **The Collections section + the 2 collection-related stat cards are unaffected** (they were already wired in `feature/dashboard-collections-db`).
- **The "Items" and "Favorite Items" stat cards continue to show `0`** (documented placeholder; expected and out of scope per the design).

If any of the above is wrong, do **not** commit — debug before continuing.

- [ ] **Step 5: Update `context/current-feature.md`**

Two edits to this file:

**(a)** Append a new bullet to the **History** section (bottom of the file) summarizing the work. Follow the format of the existing bullets — single-line, date prefix, em-dash-separated headline, **Goals**, **Process** (skills used), **Implementation** (files + key changes), **Verification** (commands run).

Suggested text (replace the `YYYY-MM-DD` references in the existing bullets with the current date if different — use the format of the most recent entry):

```
- 2026-06-14: **Dashboard Items — Wire to Real Database Data** completed on `feature/dashboard-items-db`. **Spec & Plan:** source spec `context/features/dashboard-items-spec.md`; design doc `docs/superpowers/specs/2026-06-14-dashboard-items-design.md`; implementation plan `docs/superpowers/plans/2026-06-14-dashboard-items.md`. **Goals:** replace `mockItems` in the dashboard's Pinned + Recent Items sections with real Prisma data from Neon; hide the Pinned section when empty; derive each card's icon container color from the item's type. Per the brainstorming decision, the 2 item-related stat cards (Items, Favorite Items) stay at `0` placeholders (out of scope; deferred to a later feature). **Process — relied on the `superpowers` opencode plugin skills:** `brainstorming` (collected 2 clarifying questions on stats scope + db function shape, presented design, got approval), `using-git-worktrees` (branch isolation check, created `feature/dashboard-items-db` from main per established workflow), `writing-plans` (produced this plan), then `executing-plans` (4-task implementation). **Implementation:** new `src/lib/db/items.ts` with `DashboardItem` + `DashboardItemType` types and two single-purpose functions — `getDashboardPinnedItems` (`where: { userId, isPinned: true }, orderBy: { createdAt: "desc" }`) and `getDashboardRecentItems` (`where: { userId }, orderBy: { createdAt: "desc" }, take: 10`); both include `itemType { name, icon, color }` and `tags { name }`. Extended `src/app/dashboard/page.tsx` `Promise.all` from 2 to 4 entries (collections pair + items pair); `StatsCards` placeholders unchanged. Refactored `src/components/dashboard/PinnedItems.tsx` and `src/components/dashboard/RecentItems.tsx` to be prop-driven: dropped `mockItems` import + hardcoded `TYPE_MAP` + 7 `lucide-react` icon imports; resolve icon via `getIcon(item.itemType.icon)`; tint container via `${item.itemType.color}22`; `PinnedItems` keeps the `if (items.length === 0) return null;` empty-state guard. **Verification:** `tsc --noEmit` + `npm run lint` + `npm run build` all green; `/dashboard` shows 10 recent items in `createdAt desc` order, icon containers tinted correctly per item type (orange for commands, green for links), Pinned section hidden (current seed has 0 pinned items — confirms the empty-state guard), Collections section + 2 collection-related stat cards unaffected.
```

**(b)** After committing the design doc, the `Status` in `context/current-feature.md` should be flipped to `Completed` and the `Goals` section cleared. The next feature will create its own `Goals` block.

Replace the current `Status` + `Goals` blocks with:

```markdown
## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Current feature goals. Update as scope is refined. -->

_(None — feature complete. See History below.)_
```

- [ ] **Step 6: Commit the history update**

```bash
git add context/current-feature.md
git commit -m "docs(context): record dashboard-items feature completion"
```

- [ ] **Step 7: Merge to main and push (per the ai-interaction.md workflow)**

Per `context/ai-interaction.md` workflow steps 7 + 8:

```bash
git checkout main
git merge --no-ff feature/dashboard-items-db
git push origin main
git branch -d feature/dashboard-items-db
```

Verify with `git log --oneline -10` that the merge commit is on main and the feature branch is gone.

---

## Plan Self-Review

**1. Spec coverage:**
- Create `src/lib/db/items.ts` with data fetching → Task 1 ✓
- Fetch items directly in server component → Task 2 ✓
- Item card icon/border derived from the item type → Task 3 (Pinned) + Task 4 (Recent), via `getIcon` + `${itemType.color}22` ✓
- Display item type tags and anything else currently there → Task 3 + Task 4, `item.tags.map((t) => ...)` + the existing `description` + `favorite` + `date` rendering preserved ✓
- Update collection stats display (spec is a copy-paste; out of scope per the brainstorming decision) → explicitly NOT done; documented in design + Step 5 of Task 5 ✓
- If there are no pinned items, nothing should display there → Task 3 preserves the `if (items.length === 0) return null;` guard ✓
- Single hardcoded demo user → `getCurrentUserId` reused, unchanged ✓
- No Prisma migration → no schema changes ✓
- `src/lib/mock-data.ts` stays in place → explicitly listed in "Untouched" ✓

**2. Placeholder scan:** No TBD/TODO. All code blocks are complete. The `itemCount={0}` and `favoriteItemCount={0}` placeholders are explicit and documented (in the code comment, in the design, and in the spec).

**3. Type consistency:** `DashboardItem`, `DashboardItemType`, `getDashboardPinnedItems`, `getDashboardRecentItems`, `getIcon`, `getCurrentUserId` all use the exact signatures defined in Task 1 and used in Tasks 2–4. The `border` interpretation in the spec ("icon container tint") is consistently rendered as `style={{ backgroundColor: \`${itemType.color}22\` }}` in both Pinned and Recent components.
