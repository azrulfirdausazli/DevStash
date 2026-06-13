# Current Feature

Dashboard Collections — Wire to Real Database Data

## Status

<!-- Not Started|In Progress|Completed -->

In Progress

## Goals

<!-- Goals & requirements -->

Replace the dummy collection data shown in the dashboard's main area with real data from the Neon database via Prisma. Keep the current 6-card RecentCollections design (per `context/screenshots/dashboard-ui-main.png`); only the data source changes.

Requirements (from `context/features/dashboard-collections-spec.md`):

- Create `src/lib/db/collections.ts` with data fetching functions
- Fetch collections directly in the server component
- Collection card border color derived from the most-used content type in that collection
- Show small icons of all types present in that collection
- Keep the current design
- Update the collection stats display

Out of scope: items underneath each collection (handled later).

## Notes

<!-- Any extra notes -->

Spec: `context/features/dashboard-collections-spec.md`. Design reference: `context/screenshots/dashboard-ui-main.png`. Data source: Neon Postgres via Prisma 7 (`src/lib/prisma.ts`); mock data to be removed from `src/lib/mock-data.ts` usage in this area.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-06-13: Initial Next.js setup with React 19, TypeScript, Tailwind CSS v4, and shadcn/ui. Cleaned up default boilerplate (removed default SVGs, updated globals.css, layout.tsx, and page.tsx).
- 2026-06-13: Dashboard UI Phase 1 completed. Initialized shadcn/ui with Button and Input components. Created /dashboard route with dark-mode layout, TopBar component (DevStash logo, search input with ⌘K hint, New Collection + New Item buttons), sidebar placeholder, and main area placeholder.
- 2026-06-13: Dashboard UI Phase 2 completed. Implemented collapsible sidebar (DashboardShell + Sidebar components) with item type links (/items/snippets etc.), independently collapsible Types and Collections sections with animated chevrons, favorite and all-collections lists, user avatar area at the bottom, drawer toggle icon, and mobile drawer overlay.
- 2026-06-13: Dashboard UI Phase 3 completed. Built main content area: 4 stats cards (items, collections, favorite items, favorite collections), RecentCollections grid with View All link, PinnedItems list, and RecentItems list (10 most recent). All components are server components using mock-data.ts.
- 2026-06-13: **Prisma + Neon PostgreSQL Setup** completed on `feature/prisma-neon-setup`. **Goals:** set up Prisma 7 ORM with serverless Neon Postgres, create initial schema from `context/project-overview.md` including NextAuth models (Account/Session/VerificationToken), add indexes + cascade deletes, always use migrations (never `db push`). **Process — relied on the `superpowers` opencode plugin skills:** `brainstorming` (scoping + design), `using-git-worktrees` (branch isolation check), `writing-plans` (`docs/superpowers/plans/2026-06-13-prisma-neon-setup.md`), `executing-plans` (task-by-task execution). Spec + plan committed to `docs/superpowers/`. **Implementation:** installed `prisma@7`, `@prisma/client@7`, `@prisma/adapter-neon`, `@neondatabase/serverless`, `dotenv`, `tsx`. Set `"type": "module"` + added `db:generate`/`db:migrate`/`db:deploy`/`db:status`/`db:seed`/`db:studio` scripts. Created `prisma.config.ts` (uses `env('DIRECT_URL')`), `prisma/schema.prisma` (User, NextAuth models, Item, ItemType, Collection, ItemCollection, Tag + ContentType enum, indexes, cascades) with the new Prisma 7 `prisma-client` generator → `src/generated/prisma`, singleton `src/lib/prisma.ts` (PrismaNeon adapter + Next.js HMR guard), seed `prisma/seed.ts` for 7 system ItemTypes (findFirst+create because `(name, userId)` compound key has nullable `userId`). Added `.env.example`, gitignored `/src/generated`. **Neon two-URL pattern discovered during impl:** `DATABASE_URL` (pooled, runtime via adapter-neon WebSocket) + `DIRECT_URL` (unpooled, Prisma CLI migrations), both with `connect_timeout=15` for cold starts. Applied init migration `prisma/migrations/20260613140120_init/migration.sql` to Neon dev branch, generated client, seeded all 7 system item types. Added `scripts/test-db.ts` for smoke testing. `npm run lint` + `npm run build` + `tsc --noEmit` all green.
- 2026-06-13: **Seed Sample Data** completed on `feature/seed-sample-data`. **Goals:** replace bare-bones seed (7 system ItemTypes only) with a demo user + 5 collections + 18 items, all idempotent, per `context/features/seed-spec.md`. **Process — relied on the `superpowers` opencode plugin skills:** `brainstorming` (scope was already defined by spec; used it to confirm idempotency patterns and the no-skill-changes-since-need review), `using-git-worktrees` (branch isolation check, created `feature/seed-sample-data` directly per established workflow), `executing-plans` (executed task-by-task via TodoWrite). No new spec/plan doc written — feature was a straightforward transcription of the spec into a script. **Implementation:** added `bcryptjs` + `@types/bcryptjs`. Rewrote `prisma/seed.ts`: keeps the 7 system ItemTypes (`findFirst`+`create` because `(name, userId)` compound key has nullable `userId`), upserts demo user `demo@devstash.io` / `Demo User` with bcryptjs(12) hash of `12345678` / `isPro=false` / `emailVerified=now`, then for each of 5 collections (React Patterns, AI Workflows, DevOps, Terminal Commands, Design Resources) uses `findFirst(userId,name)`+`create` and links items via `itemCollection.upsert` on the composite `(itemId, collectionId)` key. Each collection gets a `defaultTypeId` matching its primary content type. Updated `scripts/test-db.ts` to fetch and pretty-print the demo data (counts, demo user, per-collection item lists with content previews, cross-collection membership). Verified by running `npm run db:seed` twice — counts stable at `users:1, itemTypes:7, items:18, collections:5`. Per-collection counts: React Patterns=3, AI Workflows=3, DevOps=4, Terminal Commands=4, Design Resources=4. `npm run lint` + `npm run build` + `tsc --noEmit` all green.
- 2026-06-14: **Dashboard Collections DB Wire-up** completed on `feature/dashboard-collections-db`. **Goals:** replace `mockCollections` usage in the dashboard's Collections section + the 2 collection-related stats with real Prisma data from Neon, per `context/features/dashboard-collections-spec.md`. Items-under-each-collection and the 2 item-related stats explicitly out of scope. **Process — relied on the `superpowers` opencode plugin skills:** `brainstorming` (collected 2 clarifying questions on user-id strategy and stats scope, presented design, got approval), `writing-plans` (produced `docs/superpowers/plans/2026-06-14-dashboard-collections.md`), `subagent-driven-development` (7-task implementation with spec+quality review per task), `verification-before-completion` (rejected a Task-4 dispatch with wrong Prisma relation traversal; implementer caught and corrected it). Spec + plan committed to `docs/superpowers/`. **Implementation:** new `src/lib/db/` namespace with `user.ts` (`getCurrentUserId()` — hardcoded demo user via `findUnique` on email), `icons.ts` (lucide icon registry keyed by `ItemType.icon` name with `File` fallback), `collections.ts` (3 types + `getDashboardCollectionStats` for the 2 counts + `getDashboardCollections` with 3-level include `items → item → itemType` and JS aggregation of `types[]` and `dominantType` for the border color). Rewrote `src/app/dashboard/page.tsx` as async server component, runs `getCurrentUserId()` + both collection queries in `Promise.all`. Rewrote `src/components/dashboard/RecentCollections.tsx` to accept `collections: DashboardCollection[]` prop, added `border-l-4` + conditional `style={{ borderLeftColor: collection.dominantType.color }}` for the dynamic accent, iterates `collection.types` and resolves icons via `getIcon(t.icon)`. Capped render at 6 cards. Added `npm run test:collections` script that exercises the data layer end-to-end. **Seed discrepancy noted:** the seed has 0 collections with `isFavorite: true` (verified via `prisma/seed.ts:76-91` — the `getOrCreateCollection` helper never sets `isFavorite`), so `favoriteCollectionCount = 0`; the plan was corrected mid-execution to reflect the actual seed. **Verification:** `npx tsc --noEmit` + `npm run lint` + `npm run build` all green; `npm run test:collections` prints `collectionCount=5, favoriteCollectionCount=0` and per-collection breakdowns matching the seed (DevOps has 3 types: link:2, command:1, snippet:1 with `link` as dominant). `curl http://localhost:3000/dashboard` returns 200 with all 5 collection names in the HTML.
