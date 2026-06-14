# Stats & Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dashboard's main-area **stats** cards and the entire **sidebar** to real Prisma data from Neon, ending the dashboard's reliance on `src/lib/mock-data.ts` for these surfaces. Keep the visual design identical to the current screenshots.

**Architecture:** Add 3 small db helpers (`getSidebarItemTypes`, `getSidebarCollections`, `getDashboardItemStats`) — 2 in existing files, 1 in a new `src/lib/db/item-types.ts`. Convert `Sidebar` from a client component to a server component by extracting the only client behavior (collapse toggles) into a new `SidebarSection` client component. Thread the new data from `app/dashboard/page.tsx` through `DashboardShell` (new props) into `Sidebar` (new props). No new dependencies, no schema changes, no migrations, no new smoke-test script.

**Tech Stack:** Next.js 16 App Router (server components by default), Prisma 7 + `@prisma/adapter-neon` (already in place), `lucide-react` for icons, TypeScript strict mode. No test framework — verification is via `npx tsc --noEmit`, `npm run lint`, `npm run build`, and a manual `/dashboard` browser check.

---

## File Structure

### New files
- `src/lib/db/item-types.ts` — `SidebarItemType` type + `getSidebarItemTypes()` function. Returns the 7 system `ItemType` rows (alphabetical) with `{ name, icon, color }`.
- `src/components/dashboard/SidebarSection.tsx` — small client component wrapping the collapsible section header (label + chevron + `useState` + conditional `children` render). Default-open.

### Modified files
- `src/lib/db/collections.ts` — add `SidebarCollection` type + `getSidebarCollections(userId)` function. Returns the 8 most-recently-updated collections as `{ id, name, isFavorite, dominantTypeColor }` after running the dominant-type aggregation in JS.
- `src/lib/db/items.ts` — add `DashboardItemStats` type + `getDashboardItemStats(userId)` function. Two parallel `prisma.item.count` calls, mirrors `getDashboardCollectionStats`.
- `src/components/dashboard/Sidebar.tsx` — drop `'use client'`, `useState`, `mockCollections`, `mockItemTypeCounts`, the hardcoded `itemTypes` array, the 7 `lucide-react` icon imports + `Link as LinkIcon`, the `Star` and `Settings` imports it no longer needs; accept `itemTypes: SidebarItemType[]` and `collections: SidebarCollection[]` props; render the new "View all collections" link; render a small colored `span` (size-2.5, rounded-full) on each non-favorite collection row; replace the inline toggle `button`s with `<SidebarSection>` wrappers. The user-avatar `Settings` icon is kept (still used).
- `src/components/dashboard/DashboardShell.tsx` — accept `sidebarItemTypes: SidebarItemType[]` + `sidebarCollections: SidebarCollection[]` props; forward both to the desktop and mobile-drawer `<Sidebar>` instances.
- `src/app/dashboard/page.tsx` — extend the `Promise.all` from 4 to 7 entries (add `getDashboardItemStats`, `getSidebarItemTypes`, `getSidebarCollections`); pass `itemStats.itemCount` and `itemStats.favoriteItemCount` to `StatsCards` (replacing the two `0` placeholders); wrap the existing main content in `<DashboardShell>` and pass the sidebar data through.

### Untouched
- `src/lib/prisma.ts` (existing singleton, reused as-is)
- `src/lib/mock-data.ts` (still used by `TopBar` — `mockUser`)
- `src/lib/db/user.ts` (`getCurrentUserId`, reused)
- `src/lib/db/icons.ts` (`getIcon` + `ICON_REGISTRY`, reused)
- `src/components/dashboard/StatsCards.tsx` (unchanged — already prop-driven)
- `src/components/dashboard/RecentCollections.tsx` (unchanged)
- `src/components/dashboard/PinnedItems.tsx` (unchanged)
- `src/components/dashboard/RecentItems.tsx` (unchanged)
- `src/components/dashboard/TopBar.tsx` (unchanged)
- `prisma/schema.prisma` and `prisma/seed.ts` (no changes)
- `package.json` (no script changes, no new deps)

---

## Task 1: `src/lib/db/item-types.ts` — system item types for the sidebar

**Files:**
- Create: `src/lib/db/item-types.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/db/item-types.ts` with the following content:

```ts
import { prisma } from "@/lib/prisma";

export type SidebarItemType = {
  name: string;
  icon: string;
  color: string;
};

export async function getSidebarItemTypes(): Promise<SidebarItemType[]> {
  return prisma.itemType.findMany({
    where: { isSystem: true },
    orderBy: { name: "asc" },
    select: { name: true, icon: true, color: true },
  });
}
```

- [ ] **Step 2: Type-check to verify**

Run: `npx tsc --noEmit`
Expected: zero errors. The function is fully typed; the return shape is the `select` projection.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/item-types.ts
git commit -m "feat(db): add getSidebarItemTypes for system item types"
```

---

## Task 2: Add `getSidebarCollections` to `src/lib/db/collections.ts`

**Files:**
- Modify: `src/lib/db/collections.ts` (append the new type + function at the bottom)

- [ ] **Step 1: Append the new type and function**

Open `src/lib/db/collections.ts` and append the following at the end of the file (after the closing of `getDashboardCollections`):

```ts

export type SidebarCollection = {
  id: string;
  name: string;
  isFavorite: boolean;
  dominantTypeColor: string | null;
};

export async function getSidebarCollections(
  userId: string,
): Promise<SidebarCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      items: {
        include: {
          item: {
            select: {
              itemType: { select: { color: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const counts = new Map<string, { color: string; count: number }>();
    for (const { item } of row.items) {
      const { color } = item.itemType;
      counts.set(color, {
        color,
        count: (counts.get(color)?.count ?? 0) + 1,
      });
    }
    const dominant = Array.from(counts.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.color.localeCompare(b.color);
    })[0];
    return {
      id: row.id,
      name: row.name,
      isFavorite: row.isFavorite,
      dominantTypeColor: dominant?.color ?? null,
    };
  });
}
```

Note: keep the existing `TypeSummary`, `DashboardCollection`, `DashboardCollectionStats`, `getDashboardCollectionStats`, and `getDashboardCollections` exports untouched.

- [ ] **Step 2: Type-check to verify**

Run: `npx tsc --noEmit`
Expected: zero errors. (No consumers yet — Task 5 wires it in.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/collections.ts
git commit -m "feat(db): add getSidebarCollections with dominant-type color"
```

---

## Task 3: Add `getDashboardItemStats` to `src/lib/db/items.ts`

**Files:**
- Modify: `src/lib/db/items.ts` (append the new type + function at the bottom)

- [ ] **Step 1: Append the new type and function**

Open `src/lib/db/items.ts` and append the following at the end of the file (after the closing of `getDashboardRecentItems`):

```ts

export type DashboardItemStats = {
  itemCount: number;
  favoriteItemCount: number;
};

export async function getDashboardItemStats(
  userId: string,
): Promise<DashboardItemStats> {
  const [itemCount, favoriteItemCount] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);
  return { itemCount, favoriteItemCount };
}
```

Note: keep the existing `DashboardItemType`, `DashboardItem`, `getDashboardPinnedItems`, and `getDashboardRecentItems` exports untouched.

- [ ] **Step 2: Type-check to verify**

Run: `npx tsc --noEmit`
Expected: zero errors. (No consumers yet — Task 7 wires it in.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/items.ts
git commit -m "feat(db): add getDashboardItemStats (items + favorite items counts)"
```

---

## Task 4: Create `src/components/dashboard/SidebarSection.tsx` (client component)

**Files:**
- Create: `src/components/dashboard/SidebarSection.tsx`

- [ ] **Step 1: Create the file**

Create `src/components/dashboard/SidebarSection.tsx` with the following content:

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SidebarSection({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-2 py-1 mb-1 rounded hover:bg-muted/50 transition-colors group"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <ChevronDown
          className={`size-3 text-muted-foreground transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && children}
    </>
  );
}
```

- [ ] **Step 2: Type-check to verify**

Run: `npx tsc --noEmit`
Expected: zero errors. (No consumers yet — Task 5 wires it in.)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SidebarSection.tsx
git commit -m "feat(sidebar): add SidebarSection client component for collapse toggle"
```

---

## Task 5: Refactor `src/components/dashboard/Sidebar.tsx` to a server component

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx` (full rewrite, 161 lines → ~110 lines)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/dashboard/Sidebar.tsx` with:

```tsx
import Link from 'next/link';
import { Star, Settings } from 'lucide-react';
import type { SidebarItemType } from '@/lib/db/item-types';
import type { SidebarCollection } from '@/lib/db/collections';
import { getIcon } from '@/lib/db/icons';
import SidebarSection from './SidebarSection';

const TYPE_LABELS: Record<string, string> = {
  snippet: 'Snippets',
  prompt: 'Prompts',
  command: 'Commands',
  note: 'Notes',
  file: 'Files',
  image: 'Images',
  link: 'Links',
};

interface SidebarProps {
  collapsed: boolean;
  itemTypes: SidebarItemType[];
  collections: SidebarCollection[];
}

export default function Sidebar({ collapsed, itemTypes, collections }: SidebarProps) {
  const favoriteCollections = collections.filter((c) => c.isFavorite);
  const allCollections = collections.filter((c) => !c.isFavorite);

  return (
    <div className="flex flex-col h-full py-2">
      {/* Types */}
      <div className="px-3">
        {!collapsed ? (
          <SidebarSection label="Types">
            <nav className="space-y-0.5">
              {itemTypes.map((t) => {
                const Icon = getIcon(t.icon);
                const label = TYPE_LABELS[t.name] ?? t.name;
                return (
                  <Link
                    key={t.name}
                    href={`/items/${t.name}s`}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Icon className="size-4 shrink-0" style={{ color: t.color }} />
                    <span className="flex-1">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </SidebarSection>
        ) : (
          <nav className="space-y-0.5">
            {itemTypes.map((t) => {
              const Icon = getIcon(t.icon);
              return (
                <Link
                  key={t.name}
                  href={`/items/${t.name}s`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Icon className="size-4 shrink-0" style={{ color: t.color }} />
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Collections */}
      {!collapsed && (
        <div className="mt-2 px-3 border-t border-border pt-3">
          <SidebarSection label="Collections">
            <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Favorites
            </p>
            <nav className="space-y-0.5 mb-3">
              {favoriteCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <Star
                    className="size-3 text-yellow-400 shrink-0"
                    fill="currentColor"
                  />
                </Link>
              ))}
            </nav>

            <p className="px-2 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              All Collections
            </p>
            <nav className="space-y-0.5">
              {allCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.id}`}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  {c.dominantTypeColor && (
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.dominantTypeColor }}
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 truncate">{c.name}</span>
                </Link>
              ))}
              <Link
                href="/collections"
                className="block px-2 py-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all collections
              </Link>
            </nav>
          </SidebarSection>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar */}
      <div className="px-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="size-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
            D
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  Demo User
                </p>
                <p className="text-xs text-muted-foreground truncate leading-tight">
                  demo@devstash.io
                </p>
              </div>
              <Settings className="size-4 text-muted-foreground shrink-0" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Notes on the diff:**
- `'use client'` and the `useState` import are gone — the toggle state now lives in `SidebarSection`.
- The hardcoded `itemTypes` array and the 7 `lucide-react` icon imports (`Code`, `Sparkles`, `Terminal`, `StickyNote`, `File`, `Image`, `Link as LinkIcon`) are gone. Icons are resolved via the existing `getIcon(t.icon)` helper.
- `mockCollections`, `mockItemTypeCounts`, and `mockUser` imports are gone.
- The Types nav loses the count badge (per the design's brainstorming decision).
- The All Collections nav rows show a `size-2.5 rounded-full` colored `span` (when `c.dominantTypeColor` is set) on the left, before the name. The Favorites rows keep the yellow star on the right (unchanged).
- A new "View all collections" `<Link href="/collections">` is rendered as the last child of the All Collections `<nav>`, styled like the main area's "View all" link.
- The user-avatar block falls back to hardcoded `D` / `Demo User` / `demo@devstash.io` (matches the seed) so the avatar stops reading from `mockUser`. This is a minimal change; the next feature can plumb in the real `User` row from the db.

- [ ] **Step 2: Type-check — expect 1 error in `DashboardShell`**

Run: `npx tsc --noEmit`
Expected: 1 error in `src/components/dashboard/DashboardShell.tsx` of the form `Property 'sidebarItemTypes' is missing in type ...` (or similar — the prop is now required but the shell doesn't pass it). This is the planned error; Task 6 fixes it.

- [ ] **Step 3: Lint — confirm zero errors in `Sidebar.tsx`**

Run: `npm run lint`
Expected: zero errors in `Sidebar.tsx`. (No unused imports — the dropped `mockCollections`, `mockItemTypeCounts`, `mockUser`, the 7 `lucide-react` icon imports + `Link as LinkIcon`, the `useState` import, and `'use client'` are all gone.)

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx
git commit -m "feat(sidebar): convert to server component, render from db props"
```

---

## Task 6: Update `src/components/dashboard/DashboardShell.tsx` to forward sidebar props

**Files:**
- Modify: `src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/dashboard/DashboardShell.tsx` to confirm its current shape (it wraps `TopBar`, the main content area, and a mobile drawer containing a `<Sidebar>`).

- [ ] **Step 2: Apply the edits**

Three edits to `DashboardShell.tsx`:

**(a)** Add the two new imports at the top (alongside the existing React / `Sidebar` import):

```tsx
import type { SidebarItemType } from '@/lib/db/item-types';
import type { SidebarCollection } from '@/lib/db/collections';
```

**(b)** Extend the `DashboardShellProps` interface to include the two new props:

```tsx
interface DashboardShellProps {
  children: React.ReactNode;
  sidebarItemTypes: SidebarItemType[];
  sidebarCollections: SidebarCollection[];
}
```

**(c)** Destructure the new props from the function signature and forward them to **both** the desktop and mobile-drawer `<Sidebar>` instances:

```tsx
export default function DashboardShell({
  children,
  sidebarItemTypes,
  sidebarCollections,
}: DashboardShellProps) {
  // ...existing body, with every <Sidebar /> updated to:
  //   <Sidebar
  //     collapsed={...}
  //     itemTypes={sidebarItemTypes}
  //     collections={sidebarCollections}
  //   />
}
```

Read the file to find the exact `<Sidebar />` JSX (there is at least one desktop instance and one inside a mobile drawer), then update each instance to pass the new props. Do not change any other markup.

- [ ] **Step 3: Type-check — expect 1 error in `app/dashboard/page.tsx`**

Run: `npx tsc --noEmit`
Expected: 1 error in `src/app/dashboard/page.tsx` of the form `Property 'sidebarItemTypes' is missing in type ...` (the page doesn't pass the new props yet). This is the planned error; Task 7 fixes it.

- [ ] **Step 4: Lint — confirm zero errors**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardShell.tsx
git commit -m "feat(sidebar): forward sidebarItemTypes + sidebarCollections through DashboardShell"
```

---

## Task 7: Update `src/app/dashboard/page.tsx` (Promise.all 4→7, wire stats, pass sidebar data)

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite, 41 lines → ~60 lines)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/app/dashboard/page.tsx` with:

```tsx
import { getCurrentUserId } from "@/lib/db/user";
import {
  getDashboardCollections,
  getDashboardCollectionStats,
  getSidebarCollections,
} from "@/lib/db/collections";
import {
  getDashboardPinnedItems,
  getDashboardRecentItems,
  getDashboardItemStats,
} from "@/lib/db/items";
import { getSidebarItemTypes } from "@/lib/db/item-types";
import DashboardShell from "@/components/dashboard/DashboardShell";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentCollections from "@/components/dashboard/RecentCollections";
import PinnedItems from "@/components/dashboard/PinnedItems";
import RecentItems from "@/components/dashboard/RecentItems";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [
    collections,
    collStats,
    itemStats,
    pinnedItems,
    recentItems,
    sidebarItemTypes,
    sidebarCollections,
  ] = await Promise.all([
    getDashboardCollections(userId),
    getDashboardCollectionStats(userId),
    getDashboardItemStats(userId),
    getDashboardPinnedItems(userId),
    getDashboardRecentItems(userId),
    getSidebarItemTypes(),
    getSidebarCollections(userId),
  ]);

  return (
    <DashboardShell
      sidebarItemTypes={sidebarItemTypes}
      sidebarCollections={sidebarCollections}
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your developer knowledge hub</p>
        </div>
        <StatsCards
          itemCount={itemStats.itemCount}
          collectionCount={collStats.collectionCount}
          favoriteItemCount={itemStats.favoriteItemCount}
          favoriteCollectionCount={collStats.favoriteCollectionCount}
        />
        <RecentCollections collections={collections} />
        <PinnedItems items={pinnedItems} />
        <RecentItems items={recentItems} />
      </div>
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Type-check — confirm zero errors**

Run: `npx tsc --noEmit`
Expected: zero errors. The 3 new db calls are typed; `StatsCards` receives real values for `itemCount` and `favoriteItemCount`; `DashboardShell` receives the new sidebar props.

- [ ] **Step 3: Lint — confirm zero errors**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): wire item stats + pass sidebar data through DashboardShell"
```

---

## Task 8: Final verification + history update + merge

**Files:**
- Modify: `context/current-feature.md` (flip Status, clear Goals, append History entry)

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

- **Top stats row (4 cards):**
  - `Items` shows the total item count for the demo user (the seed has 18 items — expect `18`, or whatever the current seed total is).
  - `Collections` shows the collection count (seed has 5 → expect `5`).
  - `Favorite Items` shows the count of items with `isFavorite: true` in the seed (varies — confirm the number is non-zero and looks plausible).
  - `Favorite Collections` shows the count of collections with `isFavorite: true` (seed has at least 1 → confirm non-zero).
  - **All 4 cards now show real DB values — no more `0` placeholders.**

- **Sidebar Types section:**
  - 7 rows: Snippets, Prompts, Commands, Notes, Files, Images, Links — in alphabetical order.
  - Each row's icon is the correct lucide icon and the icon's color matches the seed (`#3b82f6` blue, `#8b5cf6` purple, `#f97316` orange, `#fde047` yellow, `#6b7280` gray, `#ec4899` pink, `#10b981` green).
  - No count badge on the right (per the brainstorming decision).
  - The "Types" header has the chevron; clicking it collapses the list; clicking again expands it.

- **Sidebar Collections section:**
  - "Favorites" subheader is followed by favorited collection rows, each with a small yellow star on the right.
  - "All Collections" subheader is followed by non-favorite collection rows, each with a small colored circle on the left (12px, `rounded-full`) whose color is the dominant item type's color for that collection (e.g., the React Patterns collection has snippets as the dominant type → expect a blue circle; the AI Workflows collection has prompts as dominant → purple; etc.). A collection with no items shows no circle.
  - "View all collections" link is the last child of the All Collections `<nav>`, styled subtly, with `href="/collections"`.
  - The "Collections" header has the chevron; clicking it collapses the entire Collections section; clicking again expands it.

- **Main area Collections grid:** unchanged — left border colors + type icons + star indicators all rendered from `getDashboardCollections` (per `feature/dashboard-collections-db`).

- **Pinned section:** unchanged — still hidden if no items are pinned.

- **Recent Items section:** unchanged — 10 most recent items in `createdAt desc` order, tinted icon containers.

- **No console errors or hydration warnings** in the browser devtools. (Watch for any `"useState"`/client-component warnings — the Sidebar should not be a client component anymore.)

If any of the above is wrong, do **not** commit — debug before continuing.

- [ ] **Step 5: Update `context/current-feature.md`**

Three edits to this file:

**(a)** Replace the current `Status` block with:

```markdown
## Status

<!-- Not Started|In Progress|Completed -->

Completed
```

**(b)** Replace the current `Goals` block (the Stats & Sidebar bullets) with:

```markdown
## Goals

<!-- Current feature goals. Update as scope is refined. -->

_(None — feature complete. See History below.)_
```

**(c)** Append a new bullet to the **History** section (bottom of the file) summarizing the work. Follow the format of the existing bullets — single-line, date prefix, em-dash-separated headline, **Goals**, **Process** (skills used), **Implementation** (files + key changes), **Verification** (commands run). Suggested text:

```
- 2026-06-14: **Stats & Sidebar — Wire to Real Database Data** completed on `feature/stats-sidebar-db`. **Spec & Plan:** source spec `context/features/stats-sidebar-spec.md`; design doc `docs/superpowers/specs/2026-06-14-stats-sidebar-design.md`; implementation plan `docs/superpowers/plans/2026-06-14-stats-sidebar.md`. **Goals:** wire the dashboard's main-area stats cards and the entire sidebar (Types + Collections) to real Prisma data from Neon, ending the dashboard's reliance on `src/lib/mock-data.ts` for these surfaces. The 2 item-related stat cards (`Items`, `Favorite Items`) — hardcoded to `0` since `feature/dashboard-collections-db` — now show real counts. The sidebar Types section shows the 7 system `ItemType` rows (alphabetical, with icon + color from the DB). The sidebar Collections section shows favorites with the existing yellow star, and the "All Collections" (= recents) list shows a small colored `span` (12px, rounded-full) per row whose color is the dominant item type in that collection. A new "View all collections" `<Link href="/collections">` is rendered at the bottom of the All Collections list. **Process — relied on the `superpowers` opencode plugin skills:** `brainstorming` (collected 2 clarifying questions on `items.ts` scope + which "recents" list gets the colored circle, presented design, got approval), `using-git-worktrees`-equivalent (branch isolation, created `feature/stats-sidebar-db` from main per established workflow), `writing-plans` (produced this plan). **Implementation:** added `getDashboardItemStats` (parallel `prisma.item.count` calls for `itemCount` + `favoriteItemCount`) to `src/lib/db/items.ts`; added `getSidebarCollections` (returns 8 most-recently-updated collections with `{ id, name, isFavorite, dominantTypeColor }` after running the same dominant-type aggregation as `getDashboardCollections` in JS, with `localeCompare` color tie-breaker) to `src/lib/db/collections.ts`; new `src/lib/db/item-types.ts` with `getSidebarItemTypes` (`where: { isSystem: true }, orderBy: { name: "asc" }, select: { name, icon, color }`); new `src/components/dashboard/SidebarSection.tsx` — a small client component that owns the `useState` for the collapse toggle and renders the label + chevron + `children`. Refactored `src/components/dashboard/Sidebar.tsx` to be a **server component** (dropped `'use client'`, `useState`, `mockCollections`, `mockItemTypeCounts`, `mockUser`, the hardcoded `itemTypes` array, and 7 `lucide-react` icon imports; added `TYPE_LABELS` map for the pluralized display labels since the DB stores singular type names; replaced the inline toggle `button`s with `<SidebarSection>`; rendered a `size-2.5 rounded-full` `span` per non-favorite collection row with `style={{ backgroundColor: c.dominantTypeColor }}` + `aria-hidden`; appended the "View all collections" link). User-avatar block now uses hardcoded `D` / `Demo User` / `demo@devstash.io` (matches the seed) to stop reading from `mockUser` — minimal change; the next feature can plumb in the real `User` row. Extended `src/components/dashboard/DashboardShell.tsx` to accept + forward `sidebarItemTypes` + `sidebarCollections` to both the desktop and mobile-drawer `<Sidebar>` instances. Updated `src/app/dashboard/page.tsx` to extend the `Promise.all` from 4 to 7 entries (adds `getDashboardItemStats`, `getSidebarItemTypes`, `getSidebarCollections`), passes `itemStats.itemCount` and `itemStats.favoriteItemCount` to `StatsCards` (replacing the two `0` placeholders), and wraps the main content in `<DashboardShell>` with the new sidebar props. **Verification:** `npx tsc --noEmit` + `npm run lint` + `npm run build` all green; `npm run dev` → `/dashboard` confirms the 4 stats cards show real DB values (no more `0` placeholders), the sidebar Types section lists 7 rows in alphabetical order with correct icons + colors, the sidebar Collections section shows the favorites with yellow stars and the "All Collections" (= recents) list with colored circles matching the dominant item type per collection, and the "View all collections" link is visible at the bottom of the All Collections list. Main-area `RecentCollections` grid + Pinned + Recent Items sections are unchanged. `src/lib/mock-data.ts` still in place (used by `TopBar`'s `mockUser`); full removal is a separate cleanup.
```

- [ ] **Step 6: Commit the history update**

```bash
git add context/current-feature.md
git commit -m "docs(context): record stats & sidebar feature completion"
```

- [ ] **Step 7: Merge to main and push (per the ai-interaction.md workflow)**

Per `context/ai-interaction.md` workflow steps 7 + 8:

```bash
git checkout main
git merge --no-ff feature/stats-sidebar-db
git push origin main
git branch -d feature/stats-sidebar-db
```

Verify with `git log --oneline -10` that the merge commit is on main and the feature branch is gone.

---

## Plan Self-Review

**1. Spec coverage:**
- Display stats pertaining to database data, keeping the current design/layout → Task 7 (Promise.all 4→7), Task 3 (`getDashboardItemStats`), Step 4 of Task 8 (visual check) ✓
- Display item types in sidebar with their icons, linking to /items/[typename] → Task 1 (`getSidebarItemTypes`), Task 5 (refactored `Sidebar` renders Types from `itemTypes` prop with `getIcon(t.icon)` and `href={\`/items/${t.name}s\`}`) ✓
- Add "View all collections" link under the collections list that goes to /collections → Task 5 (the `Link href="/collections"` appended to the All Collections `<nav>`) ✓
- Keep the star icons for favorite collections → Task 5 (Favorites `<nav>` renders `<Star>` on the right, unchanged) ✓
- For recents, each collection should show a colored circle based on the most-used item type in that collection → Task 2 (`getSidebarCollections` runs the dominant-type aggregation, returns `dominantTypeColor`), Task 5 (the `size-2.5 rounded-full` `span` on non-favorite rows) ✓
- Create `src/lib/db/items.ts` and add the database functions → Task 3 (`getDashboardItemStats` added to existing `items.ts`; the spec line about creating the file is satisfied by the existing `items.ts` from `feature/dashboard-items-db`) ✓
- Use the collections file for reference if needed → Tasks 2 + 3 mirror the `getDashboardCollectionStats` pattern (two parallel `count` calls; purpose-built function returning a typed shape; `userId` as the only argument) ✓

**2. Placeholder scan:** No TBD/TODO. All code blocks are complete. The hardcoded avatar fallback (`D` / `Demo User` / `demo@devstash.io`) is explicit and documented in the Task 5 commit message; it is a deliberate, minimal, reversible change.

**3. Type consistency:**
- `SidebarItemType` is defined in Task 1, imported in Task 5, re-imported in Task 6, and passed through the `Promise.all` in Task 7. All four usages match.
- `SidebarCollection` is defined in Task 2, imported in Task 5, re-imported in Task 6, and passed through the `Promise.all` in Task 7. All four usages match.
- `DashboardItemStats` is defined in Task 3 and consumed only in Task 7 (the `Promise.all` + the two `StatsCards` props). Both usages match.
- `getSidebarItemTypes()`, `getSidebarCollections(userId)`, `getDashboardItemStats(userId)` are called in Task 7 with the exact argument shapes defined in their tasks. ✓
- `SidebarSection` is defined in Task 4 and consumed only in Task 5. The `defaultOpen` prop is declared but never overridden (Task 5 uses `<SidebarSection label="Types">` and `<SidebarSection label="Collections">` — `defaultOpen` defaults to `true` per the definition). ✓
