# Dashboard Collections — Wire to Real Database Data — Design

**Status:** Approved
**Date:** 2026-06-14
**Source Spec:** `context/features/dashboard-collections-spec.md`

## Goal

Replace the dummy `mockCollections` data displayed in the dashboard's main "Collections" section (and the 2 collection-related stats) with real data fetched from the Neon database via Prisma. The visual design stays identical to `context/screenshots/dashboard-ui-main.png`; only the data source changes.

Out of scope: items rendered underneath each collection card (explicitly deferred in the source spec), the 2 item-related stats, the `/collections` route, and any auth integration.

## Constraints

- Existing Next.js 16 / React 19 / Tailwind v4 / shadcn project must keep building (`npm run build`)
- `npm run lint` and `tsc --noEmit` must remain green
- Single hardcoded demo user (`demo@devstash.io`) — auth is not wired yet
- Do not introduce any change that requires a Prisma migration (no schema changes)
- `src/lib/mock-data.ts` stays in place — only the dashboard collections area is rewired (other components still import from it)
- Reuse the existing Prisma 7 client singleton at `src/lib/prisma.ts` (no new client, no new adapter)
- Reuse the existing hex-color-via-inline-style pattern from `StatsCards.tsx` for the dynamic border color (no dynamic Tailwind class generation)

## Architecture

```
src/
  app/dashboard/page.tsx                [MODIFY — server component, fetches data]
  components/dashboard/
    RecentCollections.tsx               [MODIFY — accept collections prop, no mock import]
    StatsCards.tsx                      [UNCHANGED — already prop-driven]
  lib/
    db/
      collections.ts                    [NEW — Prisma data access + aggregation]
      user.ts                           [NEW — getCurrentUserId() helper]
      icons.ts                          [NEW — string→LucideIcon registry]
    mock-data.ts                        [UNTOUCHED — still used by PinnedItems, RecentItems, Sidebar, TopBar]
```

A new `src/lib/db/` namespace follows the per-resource pattern (later features will add `items.ts`, `stats.ts`, etc.) and keeps `src/lib/prisma.ts` as the pure client singleton.

## Data Layer

### `src/lib/db/user.ts`

Single export, single-purpose. Called once per page render and its result is passed to every other db helper in the request.

```ts
import { prisma } from "@/lib/prisma";

export async function getCurrentUserId(): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email: "demo@devstash.io" },
    select: { id: true },
  });
  if (!user) {
    throw new Error("Demo user not found — run `npm run db:seed`");
  }
  return user.id;
}
```

Throws a clear, actionable error if the seed hasn't been run yet. The error will surface through the Next.js error boundary, which is the right behavior for a dev/demo environment.

### `src/lib/db/icons.ts`

Maps the `icon` string stored in `ItemType` to a Lucide component. Lucide components are imported at module level, not dynamically — keeps the bundle clean and tree-shakable.

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

The fallback to `File` is defensive — if a new system type is added or the registry drifts from the seed, the UI still renders instead of crashing.

### `src/lib/db/collections.ts`

Three exports: a type, a stats function, and the collections list function.

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
  types: TypeSummary[];               // distinct types in this collection, with counts
  dominantType: TypeSummary | null;   // highest count — used for the left border color
};

export type DashboardCollectionStats = {
  collectionCount: number;
  favoriteCollectionCount: number;
};

export async function getDashboardCollections(
  userId: string,
): Promise<DashboardCollection[]>;

export async function getDashboardCollectionStats(
  userId: string,
): Promise<DashboardCollectionStats>;
```

#### `getDashboardCollections` — query

One Prisma query with an include for items + their itemType. With 5 seeded collections this is trivial; avoids two round-trips and keeps the aggregation logic co-located.

```ts
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
```

#### `getDashboardCollections` — aggregation

For each collection:

1. Group `items` by `itemType.name` → `Map<string, TypeSummary>` where `count` is incremented per item.
2. `itemCount` = `items.length`.
3. `types` = `Array.from(map.values())` sorted by `count desc, name asc` (stable, predictable for the UI).
4. `dominantType` = the first entry of `types` (highest count, alphabetical tiebreak).

#### `getDashboardCollectionStats` — query

Two `count()` queries run in parallel via `Promise.all`:

```ts
const [collectionCount, favoriteCollectionCount] = await Promise.all([
  prisma.collection.count({ where: { userId } }),
  prisma.collection.count({ where: { userId, isFavorite: true } }),
]);
```

## Component Changes

### `src/app/dashboard/page.tsx`

Becomes a server component (it already is — Next.js 16 default for the App Router page). Replaces the mock-data imports with db helpers and runs the two fetches in parallel.

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
        itemCount={0}                          // [TEMP] — wired in a later feature
        collectionCount={collStats.collectionCount}
        favoriteItemCount={0}                  // [TEMP] — wired in a later feature
        favoriteCollectionCount={collStats.favoriteCollectionCount}
      />
      <RecentCollections collections={collections} />
      <PinnedItems />
      <RecentItems />
    </div>
  );
}
```

`itemCount` and `favoriteItemCount` are passed as `0` placeholders for now; the item stats feature will replace them.

### `src/components/dashboard/RecentCollections.tsx`

Changes from the current implementation:

1. Remove `import { mockCollections } from "@/lib/mock-data"` and the hardcoded `PREVIEW_ICONS` constant.
2. Add an import for `DashboardCollection` type and `getIcon` from `@/lib/db/icons`.
3. Change the default export signature to `({ collections }: { collections: DashboardCollection[] })`.
4. Drop the local `sort` — the server returns pre-sorted by `updatedAt desc`.
5. **Limit**: cap at `collections.slice(0, 6)` to preserve the current 6-card visual. Seed has 5 today; the cap protects against future seeds with many collections.
6. **Border**: change `border border-border` to `border border-border border-l-4` and add `style={{ borderLeftColor: collection.dominantType?.color }}` (falls back to inherited border when `dominantType` is `null`).
7. **Icons row**: replace the hardcoded `PREVIEW_ICONS.map` with `collection.types.map(t => <Icon name={t.icon} color={t.color} />)`. Resolve the icon via `getIcon(t.icon)`. Only render the row when `types.length > 0` (empty-collection edge case).

```tsx
import Link from "next/link";
import { Star, MoreHorizontal } from "lucide-react";
import type { DashboardCollection } from "@/lib/db/collections";
import { getIcon } from "@/lib/db/icons";

export default function RecentCollections({ collections }: { collections: DashboardCollection[] }) {
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
            style={collection.dominantType ? { borderLeftColor: collection.dominantType.color } : undefined}
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

### `src/components/dashboard/StatsCards.tsx`

**Unchanged.** Already takes all four counts as props. The page just feeds the two collection-related counts from the DB.

## Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Demo user missing | `getCurrentUserId` throws; Next.js error boundary renders |
| No collections in DB | Grid renders empty; no "empty state" component in this feature |
| Collection with zero items | `dominantType` is `null` → no left-border color override, no icons row |
| `ItemType.icon` string missing from `ICON_REGISTRY` | `getIcon` returns `File` (defensive) |
| Item stats placeholder (`0`) | Visible in the UI; will be fixed in a later feature, documented in the page comments |

## npm Scripts

No new scripts. No new dependencies. No Prisma migration.

## What This Feature Does NOT Include

- Wiring `itemCount` and `favoriteItemCount` to the DB (handled in a later items-stats feature)
- Items rendered underneath each collection card (explicitly deferred in source spec)
- The `/collections` route or click-through navigation
- Pagination, virtualization, search, or filter
- Auth integration (single hardcoded demo user is the explicit interim choice)
- Prisma schema changes
- Removing `src/lib/mock-data.ts` entirely (still used by `PinnedItems`, `RecentItems`, `Sidebar`, `TopBar`)

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `getCurrentUserId` runs on every request (no caching) | Single `findUnique` by indexed unique email; cost is negligible. Real auth replaces this whole call site. |
| `include: { items: { include: { itemType: true } } }` could grow expensive with many items per collection | Acceptable for current scale (5 collections, 18 items total). Revisit with `_count` aggregate or a grouped query if collections grow past ~50 items each. |
| `dominantType` ties are arbitrary | Tiebreak is alphabetical by type name — stable, predictable, no visible flicker. |
| Border color rendering differences across browsers | Reuses the same `style={{ color: hex }}` pattern that `StatsCards` already uses successfully. |
| Seed data only has 5 collections; design shows 6 cards | `slice(0, 6)` cap preserves the current visual. UI will look right at 5 and at 6+. |

## Workflow / Verification

1. `git checkout feature/dashboard-collections-db` (already on it)
2. Implement the three new files in `src/lib/db/`
3. Update `src/app/dashboard/page.tsx`
4. Update `src/components/dashboard/RecentCollections.tsx`
5. `npm run lint` — zero errors
6. `tsc --noEmit` — zero errors
7. `npm run build` — completes successfully
8. `npm run dev` → visit `http://localhost:3000/dashboard` → confirm:
   - 5 collection cards render (matches seed)
   - Each card has a left border in the dominant type's color
   - Each card's icons row matches the types actually present in that collection
   - "Collections" stat card shows `5`
   - "Favorite Collections" stat card shows `3` (React Patterns, Context Files, Git Commands per seed)
   - "Items" and "Favorite Items" stat cards show `0` (placeholder; explicitly accepted)

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. Item-stat placeholders are explicit and documented.
- [x] **Internal consistency:** File paths, function signatures, type names align across all sections.
- [x] **Scope check:** Single feature, single plan. No decomposition needed.
- [x] **Ambiguity check:** Border color source, icon source, sort order, cap, and stats scope all explicit.
