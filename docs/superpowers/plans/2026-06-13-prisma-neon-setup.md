# Prisma 7 + Neon PostgreSQL Setup — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Follow tasks in order. Each task is a self-contained commit candidate.

**Goal:** Wire Prisma 7 + Neon + a singleton client into the Next.js 16 app, create initial schema, run first migration, and seed system item types.

**Architecture:** Schema in `prisma/schema.prisma` (Prisma 7 `prisma-client` generator → `src/generated/prisma`). Driver: `@prisma/adapter-neon` over `@neondatabase/serverless`. Config in `prisma.config.ts` (URL via `env()`). Singleton client in `src/lib/prisma.ts` with Next.js HMR guard. Seed script for 7 system `ItemType` rows.

**Tech Stack:** Prisma 7, `@prisma/adapter-neon`, `@neondatabase/serverless`, `dotenv`, `tsx`. Next.js 16, TypeScript 5.

**Source Spec:** `docs/superpowers/specs/2026-06-13-prisma-neon-setup-design.md`

---

## Task 1: Install Prisma 7 dependencies and enable ESM

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime and dev deps**

```bash
npm install @prisma/client@7 @prisma/adapter-neon @neondatabase/serverless dotenv
npm install -D prisma@7 tsx @types/node
```

- [ ] **Step 2: Add `"type": "module"` to package.json**

Insert after `"private": true,`:

```json
"type": "module",
```

- [ ] **Step 3: Add db:* scripts**

Replace the existing `scripts` block so it contains:

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
  "db:studio": "prisma studio"
}
```

- [ ] **Step 4: Verify install + Next build still works**

```bash
npm run build
```
Expected: build succeeds.

---

## Task 2: .gitignore + .env.example

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Add generated client to .gitignore**

Append to `.gitignore`:

```
# prisma 7 generated client
/src/generated
```

- [ ] **Step 2: Create `.env.example`**

```
# Neon PostgreSQL — paste the pooled connection string for your dev branch
# Get it from: https://console.neon.tech/<project>/branches → Connection details → "Pooled connection"
DATABASE_URL="postgres://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require"
```

- [ ] **Step 3: Confirm with user that `.env` exists with their dev branch URL**

Ask: "Does `.env` exist at the project root with `DATABASE_URL` pointing to your Neon dev branch? (yes / no — and if no, I'll wait while you add it.)"

---

## Task 3: Prisma config file

**Files:**
- Create: `prisma.config.ts`

- [ ] **Step 1: Create `prisma.config.ts`**

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

---

## Task 4: Prisma schema (initial)

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write schema verbatim from project-overview.md, with v7 generator**

Full content:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ============================================
// USER
// ============================================
model User {
  id                   String       @id @default(cuid())
  email                String       @unique
  emailVerified        DateTime?
  name                 String?
  image                String?
  password             String?
  isPro                Boolean      @default(false)
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  items       Item[]
  collections Collection[]
  itemTypes   ItemType[]
  accounts    Account[]
  sessions    Session[]

  @@map("users")
}

// ============================================
// NEXTAUTH MODELS
// ============================================
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ============================================
// ITEM
// ============================================
enum ContentType {
  TEXT
  FILE
  URL
}

model Item {
  id          String      @id @default(cuid())
  title       String
  contentType ContentType
  content     String?     @db.Text
  fileUrl     String?
  fileName    String?
  fileSize    Int?
  url         String?
  description String?     @db.Text
  isFavorite  Boolean     @default(false)
  isPinned    Boolean     @default(false)
  language    String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemTypeId String
  itemType   ItemType @relation(fields: [itemTypeId], references: [id])
  tags       Tag[]    @relation("ItemTags")

  collections ItemCollection[]

  @@index([userId])
  @@index([itemTypeId])
  @@index([createdAt])
  @@map("items")
}

// ============================================
// ITEM TYPE
// ============================================
model ItemType {
  id       String  @id @default(cuid())
  name     String
  icon     String
  color    String
  isSystem Boolean @default(false)

  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  items  Item[]

  defaultForCollections Collection[]

  @@unique([name, userId])
  @@map("item_types")
}

// ============================================
// COLLECTION
// ============================================
model Collection {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  isFavorite  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  defaultTypeId String?
  defaultType   ItemType? @relation(fields: [defaultTypeId], references: [id])

  items ItemCollection[]

  @@index([userId])
  @@map("collections")
}

// ============================================
// ITEM-COLLECTION JOIN TABLE
// ============================================
model ItemCollection {
  itemId       String
  collectionId String
  addedAt      DateTime @default(now())

  item       Item       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  collection Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  @@id([itemId, collectionId])
  @@map("item_collections")
}

// ============================================
// TAG
// ============================================
model Tag {
  id    String @id @default(cuid())
  name  String @unique
  items Item[] @relation("ItemTags")

  @@map("tags")
}
```

- [ ] **Step 2: Validate schema syntax**

```bash
npx prisma validate
```
Expected: "The schema at prisma/schema.prisma is valid."

---

## Task 5: Singleton Prisma Client

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Write singleton with PrismaNeon adapter + Next HMR guard**

```ts
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

---

## Task 6: Seed script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write seed for 7 system item types**

```ts
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const systemItemTypes = [
  { name: "snippet", icon: "Code", color: "#3b82f6", isSystem: true },
  { name: "prompt", icon: "Sparkles", color: "#8b5cf6", isSystem: true },
  { name: "command", icon: "Terminal", color: "#f97316", isSystem: true },
  { name: "note", icon: "StickyNote", color: "#fde047", isSystem: true },
  { name: "file", icon: "File", color: "#6b7280", isSystem: true },
  { name: "image", icon: "Image", color: "#ec4899", isSystem: true },
  { name: "link", icon: "Link", color: "#10b981", isSystem: true },
];

async function main() {
  console.log("Seeding system item types...");
  for (const t of systemItemTypes) {
    await prisma.itemType.upsert({
      where: { name_userId: { name: t.name, userId: null } },
      update: {},
      create: t,
    });
    console.log(`  ✓ ${t.name}`);
  }
  console.log("Seeding complete.");
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

---

## Task 7: First migration

**Preconditions:** `DATABASE_URL` is set in `.env` and points to the **dev** Neon branch.

- [ ] **Step 1: Run init migration**

```bash
npm run db:migrate -- --name init
```
Expected: migration file created at `prisma/migrations/<timestamp>_init/migration.sql`, applied to Neon dev branch, "Your database is now in sync with your schema."

If this prompts to generate client and fails (v7 doesn't auto-generate), continue to Step 2.

- [ ] **Step 2: Generate client**

```bash
npm run db:generate
```
Expected: `src/generated/prisma/` populated.

- [ ] **Step 3: Verify migration status**

```bash
npm run db:status
```
Expected: "Database schema is up to date."

---

## Task 8: Seed the dev DB

- [ ] **Step 1: Run seed**

```bash
npm run db:seed
```
Expected: 7 ✓ lines printed, "Seeding complete."

- [ ] **Step 2: Smoke-test via Prisma Studio (optional, manual)**

```bash
npm run db:studio
```
Open http://localhost:5555, confirm `item_types` table has 7 rows. Close studio (Ctrl-C).

---

## Task 9: Build + lint verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: build succeeds.

If build fails because `src/generated/prisma` isn't imported anywhere yet (tree-shaking might complain about unused), that's fine — the file exists and TypeScript validates it. Investigate any actual errors.

---

## Task 10: Update current-feature.md history & ask about commits

- [ ] **Step 1: Append history entry to `context/current-feature.md`**

Append under the `## History` section:

```
- 2026-06-13: Prisma 7 + Neon PostgreSQL wired in. Schema with User, NextAuth (Account/Session/VerificationToken), Item, ItemType, Collection, ItemCollection, Tag created. Driver adapter @prisma/adapter-neon. prisma.config.ts holds DB URL. Singleton client in src/lib/prisma.ts with HMR guard. Init migration applied to Neon dev branch, system item types seeded.
```

- [ ] **Step 2: Ask user before committing**

Per `context/ai-interaction.md`, do not auto-commit. Ask: "Build + lint pass. Ready to commit. Suggested split: (a) spec + plan docs, (b) deps + ESM + scripts, (c) prisma config + schema + migration, (d) singleton client + seed, (e) current-feature.md history. Or one commit. Which do you prefer?"

---

## Self-Review

- [x] Spec coverage: every spec requirement maps to a task (deps→T1, gitignore/env→T2, config→T3, schema with NextAuth+indexes+cascades→T4, client→T5, seed→T6, migration→T7-8, verify→T9, history→T10).
- [x] Placeholder scan: no TBD/TODO; all code blocks complete.
- [x] Type consistency: `PrismaClient` import path and `PrismaNeon` constructor signature match across `lib/prisma.ts` and `prisma/seed.ts`.
- [x] AGENTS.md compliance: no auto-commit; ask before committing.
