# Dashboard Items — Wire to Real Database Data — Design

**Status:** Approved
**Date:** 2026-06-14
**Source Spec:** `context/features/dashboard-items-spec.md`

## Goal

Replace the dummy `mockItems` data displayed in the dashboard's main area — both the **Pinned** and **Recent Items** sections — with real data fetched from the Neon database via Prisma. The visual design stays identical to `context/screenshots/dashboard-ui-main.png`; only the data source changes.

The Pinned section must be hidden entirely when no items are pinned.

Out of scope: the 2 item-related stat cards (`Items`, `Favorite Items`) — the source-spec line "Update collection stats display" is a copy-paste from the collections spec; per the brainstorming decision, those stats stay as the `0` placeholders wired in `feature/dashboard-collections-db` and will be wired in a later feature. Also out of scope: the `/items/[type]` routes, item creation/edit flows, and any auth integration.

## Constraints

- Existing Next.js 16 / React 19 / Tailwind v4 / shadcn project must keep building (`npm run build`)
- `npm run lint` and `tsc --noEmit` must remain green
- Single hardcoded demo user (`demo@devstash.io`) — auth is not wired yet
- Do not introduce any change that requires a Prisma migration (no schema changes)
- `src/lib/mock-data.ts` stays in place — still used by `Sidebar` (`mockItemTypes`, `mockItemTypeCounts`) and `TopBar` (`mockUser`)
- Reuse the existing Prisma 7 client singleton at `src/lib/prisma.ts` (no new client, no new adapter)
- Reuse the existing `src/lib/db/icons.ts` `getIcon` helper (no new icon registry)
- Reuse the existing `${color}22` tint pattern for the item-card icon container

## Architecture

```
src/
  app/dashboard/page.tsx                [MODIFY — add 2 db calls to existing Promise.all]
  components/dashboard/
    PinnedItems.tsx                     [MODIFY — accept items prop, no mock import]
    RecentItems.tsx                     [MODIFY — same]
  lib/
    db/
      items.ts                          [NEW — DashboardItem type + 2 functions]
      user.ts                           [REUSED — getCurrentUserId()]
      icons.ts                          [REUSED — getIcon()]
      collections.ts                    [UNCHANGED]
    mock-data.ts                        [UNTOUCHED — still used by Sidebar/TopBar]
```

A new `src/lib/db/items.ts` file follows the per-resource pattern (collections.ts is the template). Both new functions are single-purpose, return a typed shape, and accept `userId` as their only argument (matches the `getDashboardCollections` convention).

## Data Layer

### `src/lib/db/items.ts`

Two types and two functions. No in-memory aggregation — Prisma's `findMany` returns the rows in the exact shape the UI needs.

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
): Promise<DashboardItem[]>;

export async function getDashboardRecentItems(
  userId: string,
): Promise<DashboardItem[]>;
```

#### `getDashboardPinnedItems`

```ts
return prisma.item.findMany({
  where: { userId, isPinned: true },
  orderBy: { createdAt: "desc" },
  include: {
    itemType: { select: { name: true, icon: true, color: true } },
    tags: { select: { name: true } },
  },
});
```

`createdAt desc` matches the "newest first" convention used by Recent Items. The schema has no `isPinnedOrder` field; createdAt is the natural choice and matches the current mock behavior (item_1, item_2 are pinned in createdAt order).

#### `getDashboardRecentItems`

```ts
return prisma.item.findMany({
  where: { userId },
  orderBy: { createdAt: "desc" },
  take: 10,
  include: {
    itemType: { select: { name: true, icon: true, color: true } },
    tags: { select: { name: true } },
  },
});
```

`take: 10` moves the existing client-side `slice(0, 10)` into the DB query. `orderBy: { createdAt: "desc" }` replaces the existing in-component `.sort(...)`. Both transformations move from JS to the database, leaving the component purely presentational.

#### Why include `tags` even though the seed has none

The current `mockItems` data and components read `item.tags` directly. Including the relation in the Prisma query keeps the type shape uniform with the existing components and is a cheap many-to-many include (the seed has 0 tag rows, so the join is empty). Future seeds that include tags will be picked up automatically with no component changes. The 1 `select` and the `tags: { select: { name: true } }` is the minimum to keep the join narrow.

## Component Changes

### `src/app/dashboard/page.tsx`

Add 2 calls to the existing `Promise.all`. No structural changes — the page already awaits `userId` and runs the collections fetch pair in parallel; we just add the items pair to the same call.

```tsx
import { getDashboardPinnedItems, getDashboardRecentItems } from "@/lib/db/items";
// ...
const [collections, collStats, pinnedItems, recentItems] = await Promise.all([
  getDashboardCollections(userId),
  getDashboardCollectionStats(userId),
  getDashboardPinnedItems(userId),
  getDashboardRecentItems(userId),
]);
// ...
<PinnedItems items={pinnedItems} />
<RecentItems items={recentItems} />
```

`itemCount={0}` and `favoriteItemCount={0}` placeholders stay unchanged. The "Items" and "Favorite Items" stat cards continue to show `0` (documented in the `feature/dashboard-collections-db` history entry).

### `src/components/dashboard/PinnedItems.tsx`

Changes from the current implementation:

1. Drop `import { mockItems } from "@/lib/mock-data"` and the hardcoded `TYPE_MAP` (and the 7 `lucide-react` icon imports that back it).
2. Add imports for `DashboardItem` type and `getIcon` from `@/lib/db/icons`.
3. Change the default export signature to `({ items }: { items: DashboardItem[] })`.
4. Drop the `const pinnedItems = mockItems.filter(...)` line; use the prop directly.
5. The empty-state guard becomes `if (items.length === 0) return null;` (behavior preserved).
6. Replace `const type = TYPE_MAP[item.itemTypeId] ?? ...` with `const { itemType } = item;` and `const Icon = getIcon(itemType.icon);`.
7. Replace `item.tags.map((tag) => ...)` with `item.tags.map((t) => ...)` (the prop type is now `{ name: string }[]`, not `string[]`).

The rest of the markup is unchanged — same icon container tint, same `Pin`/`Star` decorations, same tag chips, same date column, same hover behavior.

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

### `src/components/dashboard/RecentItems.tsx`

Same pattern as `PinnedItems`:

1. Drop `import { mockItems } from "@/lib/mock-data"` and the hardcoded `TYPE_MAP` (and the 7 `lucide-react` icon imports).
2. Add imports for `DashboardItem` type and `getIcon` from `@/lib/db/icons`.
3. Change the default export signature to `({ items }: { items: DashboardItem[] })`.
4. Drop the `const recentItems = [...mockItems].sort(...).slice(0, 10)` block — the server returns pre-sorted, pre-limited rows.
5. Replace `TYPE_MAP[item.itemTypeId]` lookup with `item.itemType` + `getIcon(item.itemType.icon)`.
6. Replace `item.tags.map((tag) => ...)` with `item.tags.map((t) => ...)` (and keep the `slice(0, 2)` cap, only render on `hidden sm:flex`).

The rest of the markup is unchanged — same compact card, same icon container, same tag/date layout.

## Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Demo user missing | `getCurrentUserId` throws; Next.js error boundary renders |
| No pinned items | `PinnedItems` returns `null`; the entire Pinned section is hidden (existing behavior preserved) |
| No items at all | `RecentItems` renders an empty section; no "empty state" component added in this feature |
| `ItemType.icon` string missing from `ICON_REGISTRY` | `getIcon` returns `File` (existing defensive fallback) |
| Item with no description | Component already guards with `item.description && ...` |
| Item with no tags | Component already guards with `item.tags.length > 0 && ...`; the seed has 0 tags so this is the common case for now |
| Item stats placeholder (`0`) | Visible in the UI; will be wired in a later feature, documented in the page comments |

## npm Scripts

No new scripts. No new dependencies. No Prisma migration. The `test:collections` smoke-test script remains in place; this feature is verified via the same lint + tsc + build + manual browser check that `dashboard-collections-db` used.

## What This Feature Does NOT Include

- Wiring `itemCount` and `favoriteItemCount` to the DB (per the brainstorming decision — handled in a later feature)
- The `/items/[type]` routes or click-through navigation from a card
- Pagination, virtualization, search, or filter
- Auth integration (single hardcoded demo user is the explicit interim choice)
- Prisma schema changes
- Removing `src/lib/mock-data.ts` entirely (still used by `Sidebar` and `TopBar`)
- A new smoke-test script (`scripts/test-items.ts`) — the dashboard-collections feature used one, but the items query is a single `findMany` with no in-memory aggregation, so the manual browser check + `npm run test:db` (which prints the full seed) is sufficient

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `getCurrentUserId` runs on every request (no caching) | Single `findUnique` by indexed unique email; cost is negligible. Real auth replaces this whole call site. |
| Adding 2 more parallel queries to the dashboard page | Total 4 parallel queries, all indexed (userId, isPinned, createdAt, itemTypeId). Acceptable for current scale (18 items). |
| `tags: { select: { name: true } }` join could grow with item-tag growth | Empty for current seed; revisit if/when tags are seeded in volume. |
| `createdAt desc` for Pinned assumes newest-pinned is most relevant | No `pinOrder` field in schema; document the choice; revisit if user feedback surfaces a need. |
| `PinnedItems` returns `null` with no fallback — is "no UI at all" the right empty state? | Matches the existing behavior (already returns `null`); spec calls it out explicitly. |

## Workflow / Verification

1. `git checkout feature/dashboard-items-db` (already on it)
2. Create `src/lib/db/items.ts` with the 2 types and 2 functions
3. Update `src/app/dashboard/page.tsx` to call the 2 new functions
4. Update `src/components/dashboard/PinnedItems.tsx` to be prop-driven
5. Update `src/components/dashboard/RecentItems.tsx` to be prop-driven
6. `npm run lint` — zero errors
7. `tsc --noEmit` — zero errors
8. `npm run build` — completes successfully
9. `npm run dev` → visit `http://localhost:3000/dashboard` → confirm:
   - The Pinned section is **not rendered** (current seed has 0 pinned items — confirms the empty-state guard works)
   - Recent Items shows 10 cards (the 10 most recent of the 18 seed items), in `createdAt desc` order
   - Each Recent Items card's icon container is tinted in the correct item-type color (e.g., the `docker system prune` command shows orange, the Vercel docs link shows green, the `useDebounce hook` snippet shows blue, etc.)
   - Tags sections are empty for all items (seed has no tags — expected; no visual change from mock)
   - The "Items" and "Favorite Items" stat cards continue to show `0` (placeholder; expected and documented)
   - The Collections section + 2 collection-related stat cards are unaffected (already wired in `feature/dashboard-collections-db`)

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO. The "Items" and "Favorite Items" stat card `0` placeholders are explicit and documented (and intentionally out of scope per the brainstorming decision).
- [x] **Internal consistency:** File paths, function signatures, type names align across all sections. `DashboardItem` and `DashboardItemType` are defined once and used everywhere.
- [x] **Scope check:** Single feature, single plan. No decomposition needed.
- [x] **Ambiguity check:** Sort orders, limits, empty-state behavior, icon source, tag include decision, and stats scope are all explicit.
