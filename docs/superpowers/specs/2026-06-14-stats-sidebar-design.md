# Stats & Sidebar — Design

**Status:** Approved
**Date:** 2026-06-14
**Source Spec:** `context/features/stats-sidebar-spec.md`

## Goal

Wire the dashboard's main-area **stats** and the **sidebar** to real data from the Neon database via Prisma, ending the dashboard's reliance on `src/lib/mock-data.ts` for these surfaces. The visual design stays identical to the current screenshots; only the data source changes.

Three concrete changes:

1. The 2 item-related stat cards in `StatsCards` (`Items`, `Favorite Items`) — currently hardcoded to `0` placeholders — show real counts.
2. The sidebar's **Types** section shows the 7 system `ItemType` rows from the DB (with icons + colors).
3. The sidebar's **Collections** section shows the demo user's favorite + non-favorite collections from the DB. Non-favorite ("All Collections" = "recents") rows show a small colored circle derived from the most-used item type in that collection. A new "View all collections" link appears at the bottom of the collections list, pointing to `/collections`.

Out of scope: the per-type count badge in the sidebar Types list (the `mockItemTypeCounts` usage — confirmed during brainstorming), the `/collections` and `/items/[type]` route pages, the main-area `RecentCollections` grid's left-border + type icons (already wired in `feature/dashboard-collections-db`), item creation/edit, and auth integration.

## Constraints

- Existing Next.js 16 / React 19 / Tailwind v4 / shadcn project must keep building (`npm run build`)
- `npm run lint` and `tsc --noEmit` must remain green
- Single hardcoded demo user (`demo@devstash.io`) — auth is not wired yet
- No Prisma migration / no schema changes
- `src/lib/mock-data.ts` stays in place — `TopBar` still uses `mockUser`
- Reuse the existing Prisma 7 client singleton at `src/lib/prisma.ts`
- Reuse the existing `src/lib/db/icons.ts` `getIcon` helper for any icon-name lookups
- Reuse the existing `getCurrentUserId()` from `src/lib/db/user.ts`
- Follow the existing `src/lib/db/collections.ts` pattern for new db functions (typed return shape, `userId` as the only argument)
- Keep `'use client'` minimal — only on components that need `useState`

## Architecture

```
src/
  app/dashboard/page.tsx                  [MODIFY — add 3 db calls to Promise.all; pass new data to DashboardShell]
  components/dashboard/
    DashboardShell.tsx                    [MODIFY — accept + forward sidebarItemTypes + sidebarCollections]
    Sidebar.tsx                           [MODIFY — drop mock imports; become server component; accept props; render colored circle + "View all" link]
    SidebarSection.tsx                    [NEW client component — collapsible header w/ chevron + useState]
    StatsCards.tsx                        [UNCHANGED — already prop-driven]
  lib/
    db/
      items.ts                            [MODIFY — add getDashboardItemStats]
      item-types.ts                       [NEW — getSidebarItemTypes]
      collections.ts                      [MODIFY — add getSidebarCollections]
      user.ts                             [REUSED — getCurrentUserId()]
      icons.ts                            [REUSED — getIcon()]
    mock-data.ts                          [STILL USED — TopBar reads mockUser]
```

A new `SidebarSection` client component isolates the only client-only behavior (the collapse toggles), letting `Sidebar` itself become a server component that receives the data via props.

## Data Layer

### `src/lib/db/items.ts` — add `getDashboardItemStats`

Mirrors `getDashboardCollectionStats` exactly. Two parallel `count` calls, no joins, no aggregation.

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

The schema already has `@@index([userId])` on `Item` (see `prisma/schema.prisma`), so both counts hit a single index seek each.

### `src/lib/db/item-types.ts` — new file

A new file is justified because there's no `itemTypes.ts` today (the seed file is the only place that touches `ItemType` outside the relations). The system-item-type read is a distinct concern from the items/collections reads.

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

System types only, per the source spec ("Show the system item types in the sidebar"). `select` (not `include`) — we only need the 3 string fields, no relations. `orderBy: { name: "asc" }` gives a stable, alphabetical order (snippet, prompt, command, note, file, image, link).

Note: the `name` field on `ItemType` is the bare type name (`snippet`, `prompt`, …), not the pluralized label. The sidebar previously derived labels by adding an `s` (`/items/${name}s`). This feature preserves that convention — the route is `/items/snippets`, not `/items/snippet`. The display label is still hardcoded in the component as `Snippets`, `Prompts`, etc., mapped from the type name. **No change to the link or the visible label.**

### `src/lib/db/collections.ts` — add `getSidebarCollections`

A purpose-built, minimal payload — we don't need full `DashboardCollection` rows (no item counts, no description, no per-type icon set) for the sidebar. The sidebar only renders the name, the favorite indicator, and the dominant-type color.

```ts
export type SidebarCollection = {
  id: string;
  name: string;
  isFavorite: boolean;
  dominantTypeColor: string | null; // null when collection has no items
};

export async function getSidebarCollections(
  userId: string,
): Promise<SidebarCollection[]>;
```

Implementation: fetch all collections (the seed has 5; this is bounded by the user's data which is small for now), then run the same dominant-type aggregation as `getDashboardCollections` in JS. Limit to the 8 most-recently-updated collections to bound the sidebar visual density.

```ts
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
      counts.set(color, { color, count: (counts.get(color)?.count ?? 0) + 1 });
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

**Why limit to 8 and not paginate or render all?** Two reasons: (1) the source spec doesn't define a sidebar length; 8 keeps the visual density consistent with the mock which showed ~5, and gives a small headroom buffer; (2) the "View all collections" link handles the overflow — the user clicks through to `/collections` for the full list. The "View all" link is the explicit pagination mechanism in this design.

**Why not reuse `getDashboardCollections` and slice?** That function returns 9 fields per row plus a fully-typed `types[]` array. For the sidebar we only need 4 fields and the dominant color. Building a purpose-built function keeps the payload tight (4 strings vs 9 fields + a nested array) and avoids coupling sidebar rendering to the dashboard's richer shape.

**Tie-breaking note:** The `localeCompare` on `color` ensures deterministic ordering when two types have the same count. Without it, `Map` insertion order would dictate the "winner" and the displayed color would depend on row order in the DB.

## Component Changes

### `src/components/dashboard/SidebarSection.tsx` — new client component

A tiny wrapper that owns the `useState` for the collapse toggle. Server components can't have `useState`, and the only client behavior in the current `Sidebar` is the two collapse toggles.

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

Renders the header button and conditionally renders `children`. The `Types` section uses `defaultOpen={true}` (matches current behavior); the `Collections` section uses `defaultOpen={true}` too.

The current `Sidebar.tsx` types section uses `collapsed` (the sidebar's overall collapsed state, not the section's open state) to decide whether to show the header at all. The new `SidebarSection` does not handle that — the parent `Sidebar` will pass `null` for the header when `collapsed` is true (see below).

### `src/components/dashboard/Sidebar.tsx`

Convert from `'use client'` to a server component. Accept `itemTypes` and `collections` as props. Use `SidebarSection` for the two collapsible headers.

```tsx
import Link from 'next/link';
import { Code, Sparkles, Terminal, StickyNote, File, Image, Link as LinkIcon, Star, Settings } from 'lucide-react';
import type { SidebarItemType } from '@/lib/db/item-types';
import type { SidebarCollection } from '@/lib/db/collections';
import { getIcon } from '@/lib/db/icons';
import SidebarSection from './SidebarSection';

interface SidebarProps {
  collapsed: boolean;
  itemTypes: SidebarItemType[];
  collections: SidebarCollection[];
}
```

**Type-name → display-label map** is moved into a module-level const. The DB stores bare type names (`snippet`, `prompt`, …); the UI shows pluralized labels (`Snippets`, `Prompts`, …). The map stays in the component (not the DB) because the spec is silent on localization and the existing convention is the source of truth.

```tsx
const TYPE_LABELS: Record<string, string> = {
  snippet: 'Snippets',
  prompt: 'Prompts',
  command: 'Commands',
  note: 'Notes',
  file: 'Files',
  image: 'Images',
  link: 'Links',
};
```

**Type-name → route** is `\`/items/${name}s\`` (unchanged from the current mock). The DB stores the singular form; the route is plural. The 7 known types pluralize by adding `s` (one of them, `prompt`, becomes `prompts`; `command` → `commands`; etc.). This is preserved as-is — the source spec doesn't change routing.

**Types nav** stays the same shape (icon, label, no count badge per the brainstorming decision). The icon is resolved via `getIcon(itemTypes[i].icon)`, the color is `itemTypes[i].color`. The "no collapsed-only render" header is preserved (the header only shows when `!collapsed`).

**Collections nav:** split into `favoriteCollections` and `allCollections` (the latter being "recents"). For each `allCollections` row, render a small `span` (12px circular dot) before the name, with `style={{ backgroundColor: c.dominantTypeColor }}` — only when `c.dominantTypeColor` is not null. The favorites rows continue to render the yellow star (no circle, no color).

```tsx
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
```

The circle is rendered **before** the name (left edge, before the label). This is the natural reading order and matches how the favorites' star sits at the right edge — the dominant-color circle is the visual equivalent for non-favorites. `aria-hidden` because it's purely decorative.

**"View all collections" link** appears at the bottom of the All Collections `<nav>`. Same styling as the main area's "View all" link.

```tsx
<Link
  href="/collections"
  className="block px-2 py-1.5 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
>
  View all collections
</Link>
```

### `src/app/dashboard/page.tsx`

Extend the `Promise.all` from 4 entries to 7 (collections + coll stats + item stats + pinned + recent + sidebar item types + sidebar collections). The page currently renders `StatsCards`, `RecentCollections`, `PinnedItems`, `RecentItems`. After this change it also has to pass the new sidebar data into `DashboardShell` (which currently doesn't accept any data props — it renders `Sidebar` with no props).

The new code shape:

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

**The 2 hardcoded `0`s in `StatsCards` are gone** — `itemCount={itemStats.itemCount}` and `favoriteItemCount={itemStats.favoriteItemCount}` replace them. The `0` documentation note in the previous `feature/dashboard-items-db` history entry is now obsolete.

### `src/components/dashboard/DashboardShell.tsx`

Currently renders `TopBar`, the main area, and a mobile drawer with `Sidebar` inside. Accept two new props and forward them to the desktop + mobile `Sidebar` instances.

```tsx
interface DashboardShellProps {
  children: React.ReactNode;
  sidebarItemTypes: SidebarItemType[];
  sidebarCollections: SidebarCollection[];
}
```

The two `<Sidebar>` instances (desktop and mobile-drawer) get the same props. The mobile drawer's behavior is unchanged otherwise.

## Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Demo user missing | `getCurrentUserId` throws; Next.js error boundary renders |
| No items in DB | `itemCount={0}`, `favoriteItemCount={0}`; the 2 item stat cards show `0` |
| No collections in DB | Sidebar Collections section shows just the "Favorites" and "All Collections" subheaders, each with empty nav, plus the "View all collections" link |
| Collection with no items | `dominantTypeColor` is `null`; the colored circle is not rendered; the row still links to the collection page |
| `ItemType.icon` string not in `ICON_REGISTRY` | `getIcon` returns `File` (existing defensive fallback) |
| User has many collections (>>8) | Sidebar shows 8 most-recently-updated; "View all collections" link covers overflow |
| User has 0 system types in DB | Sidebar Types section renders an empty nav (the seed guarantees 7 rows; this is a defensive case) |
| Build with no `app/dashboard/page.tsx` errors | All new data flows are typed; no `any`, no `unknown` |

## npm Scripts

No new scripts. No new dependencies. No Prisma migration. The `npm run test:db` smoke-test script remains in place; it prints the demo user, collections, and items — sufficient to manually verify the new queries.

## What This Feature Does NOT Include

- Per-type counts in the sidebar (out of scope per the brainstorming decision)
- The `/collections` and `/items/[type]` route pages (sidebar links will 404 until those are built — acceptable per the project's incremental development style)
- Pagination or virtualization for the sidebar collections list (8-item cap + "View all" link is the design's overflow mechanism)
- Auth integration
- Removing `src/lib/mock-data.ts` entirely — `TopBar` still uses `mockUser`, and removing it is a separate cleanup
- Prisma schema changes

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `Promise.all` grows from 4 to 7 calls | All 7 hit indexed userId (or `isSystem` which has at most 7 rows); total latency stays well under 1s. Acceptable for current scale (18 items, 5 collections, 7 system types). |
| Sidebar becomes a server component, breaking the existing `useState` | `useState` moves to `SidebarSection` (new client component); the visible behavior of the collapse toggles is unchanged. |
| `getSidebarCollections` runs JS aggregation on the server for every request | Aggregation is over a bounded set (8 collections × at most ~50 items each = 400 rows max in the realistic case); cost is negligible. |
| `/collections` route doesn't exist yet | Sidebar "View all" link and the individual collection links will 404; same for the sidebar Types links. Already a known state of the project; out of scope. |
| Dominant color tie-breaker depends on `color` string sort | `localeCompare` ensures deterministic output; no UI flapping between renders. |
| Pluralization convention (`/items/${name}s`) is implicit and lives only in the component | The 7 known system types all pluralize via `+s`. If a 8th system type with irregular plural ships, the route lookup must move to the DB or a constant. Documented but not solved here. |

## Workflow / Verification

1. `git checkout feature/stats-sidebar-db` (already on it)
2. Create `src/lib/db/item-types.ts` with `SidebarItemType` + `getSidebarItemTypes`
3. Add `getSidebarCollections` + `SidebarCollection` to `src/lib/db/collections.ts`
4. Add `getDashboardItemStats` + `DashboardItemStats` to `src/lib/db/items.ts`
5. Create `src/components/dashboard/SidebarSection.tsx`
6. Refactor `src/components/dashboard/Sidebar.tsx` to be a server component with props + `SidebarSection` + colored circle + "View all" link
7. Update `src/components/dashboard/DashboardShell.tsx` to accept + forward the new props
8. Update `src/app/dashboard/page.tsx` Promise.all (4→7) and pass data to `DashboardShell` + `StatsCards`
9. `npm run lint` — zero errors
10. `tsc --noEmit` — zero errors
11. `npm run build` — completes successfully
12. `npm run dev` → visit `http://localhost:3000/dashboard` → confirm:
    - The "Items" stat card shows `18` (all seed items)
    - The "Favorite Items" stat card shows a number > 0 (depends on which seed items are marked `isFavorite: true`)
    - The sidebar Types section lists 7 rows: Snippets, Prompts, Commands, Notes, Files, Images, Links — in alphabetical order — each with the correct icon + color (blue, purple, orange, yellow, gray, pink, green)
    - The sidebar Collections section has a "Favorites" subheader followed by favorited collections (with yellow star at the right) and an "All Collections" subheader followed by the rest
    - Each "All Collections" row (non-favorite) has a small colored circle on the left, tinted with the dominant item-type color for that collection
    - "View all collections" link is visible at the bottom of the All Collections list
    - The Pinned / Recent Items / main Collections grid are unaffected
    - Toggling the Types or Collections section header still collapses/expands the list

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. The "no count badge in sidebar" decision is explicit. The pluralization convention is called out as a known implicit contract.
- [x] **Internal consistency:** `SidebarItemType`, `SidebarCollection`, `DashboardItemStats` are defined once and reused. `DashboardShell` props match the page's Promise.all outputs.
- [x] **Scope check:** Single feature, single plan, 5 files modified, 2 files created, 0 deleted. Fits in one plan.
- [x] **Ambiguity check:** Sidebar length cap (8), dominant-color tie-breaker (`localeCompare`), pluralization contract, icon-fallback behavior, and the 404-on-`/collections`/`/items/[type]` state are all explicit.
