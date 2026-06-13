import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  PrismaClient,
  type Collection,
  type Item,
  type ItemType,
} from "../src/generated/prisma/client";
import { ContentType } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

// ---------------------------------------------------------------------------
// System item types (7) — kept system-owned (userId: null, isSystem: true)
// ---------------------------------------------------------------------------
const SYSTEM_ITEM_TYPES = [
  { name: "snippet", icon: "Code", color: "#3b82f6" },
  { name: "prompt", icon: "Sparkles", color: "#8b5cf6" },
  { name: "command", icon: "Terminal", color: "#f97316" },
  { name: "note", icon: "StickyNote", color: "#fde047" },
  { name: "file", icon: "File", color: "#6b7280" },
  { name: "image", icon: "Image", color: "#ec4899" },
  { name: "link", icon: "Link", color: "#10b981" },
];

async function seedSystemItemTypes(): Promise<Map<string, ItemType>> {
  const types = new Map<string, ItemType>();
  for (const t of SYSTEM_ITEM_TYPES) {
    let existing = await prisma.itemType.findFirst({
      where: { name: t.name, userId: null, isSystem: true },
    });
    if (!existing) {
      existing = await prisma.itemType.create({
        data: { ...t, isSystem: true },
      });
      console.log(`  + itemType ${t.name}`);
    }
    types.set(t.name, existing);
  }
  return types;
}

// ---------------------------------------------------------------------------
// Demo user
// ---------------------------------------------------------------------------
const DEMO_EMAIL = "demo@devstash.io";

async function seedDemoUser() {
  const passwordHash = await hash("12345678", 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      password: passwordHash,
      isPro: false,
      emailVerified: new Date(),
    },
  });
  console.log(`  = user ${user.email}`);
  return user;
}

// ---------------------------------------------------------------------------
// Collections + items
// ---------------------------------------------------------------------------
async function getOrCreateCollection(
  userId: string,
  name: string,
  description: string,
  defaultTypeId?: string,
): Promise<Collection> {
  const existing = await prisma.collection.findFirst({
    where: { userId, name },
  });
  if (existing) return existing;
  const created = await prisma.collection.create({
    data: { userId, name, description, defaultTypeId },
  });
  console.log(`  + collection "${name}"`);
  return created;
}

type ItemSeed = {
  title: string;
  itemTypeName: string;
  contentType: ContentType;
  content?: string;
  url?: string;
  description?: string;
  language?: string;
};

async function getOrCreateItem(
  userId: string,
  itemTypes: Map<string, ItemType>,
  seed: ItemSeed,
): Promise<Item> {
  const existing = await prisma.item.findFirst({
    where: { userId, title: seed.title },
  });
  if (existing) return existing;
  const itemType = itemTypes.get(seed.itemTypeName);
  if (!itemType) throw new Error(`Unknown item type: ${seed.itemTypeName}`);
  const created = await prisma.item.create({
    data: {
      userId,
      title: seed.title,
      itemTypeId: itemType.id,
      contentType: seed.contentType,
      content: seed.content,
      url: seed.url,
      description: seed.description,
      language: seed.language,
    },
  });
  console.log(`  + item   "${seed.title}"`);
  return created;
}

async function linkItemToCollection(itemId: string, collectionId: string) {
  await prisma.itemCollection.upsert({
    where: { itemId_collectionId: { itemId, collectionId } },
    update: {},
    create: { itemId, collectionId },
  });
}

// ---------------------------------------------------------------------------
// Item content (kept inline so the seed is self-contained)
// ---------------------------------------------------------------------------
const REACT_PATTERNS_ITEMS: ItemSeed[] = [
  {
    title: "useDebounce hook",
    itemTypeName: "snippet",
    contentType: ContentType.TEXT,
    language: "typescript",
    description: "Debounce a changing value across renders.",
    content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}`,
  },
  {
    title: "Context provider with typed hook",
    itemTypeName: "snippet",
    contentType: ContentType.TEXT,
    language: "typescript",
    description:
      "Compound-component pattern: provider + strongly-typed consumer hook.",
    content: `import { createContext, useContext, type ReactNode } from "react";

type ThemeValue = { theme: "light" | "dark"; toggle: () => void };
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ value, children }: { value: ThemeValue; children: ReactNode }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}`,
  },
  {
    title: "cn() utility (clsx + tailwind-merge)",
    itemTypeName: "snippet",
    contentType: ContentType.TEXT,
    language: "typescript",
    description: "Combine conditional classes and merge Tailwind conflicts.",
    content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}`,
  },
];

const AI_WORKFLOWS_ITEMS: ItemSeed[] = [
  {
    title: "Pull-request code review prompt",
    itemTypeName: "prompt",
    contentType: ContentType.TEXT,
    description: "Targeted review focusing on correctness, security, perf.",
    content: `You are a senior staff engineer reviewing a pull request.

For the diff below, produce:
1. A 2-3 sentence summary of what the change does.
2. Correctness issues (logic bugs, race conditions, edge cases).
3. Security issues (authn/authz, input validation, secrets, injection).
4. Performance issues (N+1, unnecessary re-renders, blocking I/O).
5. Maintainability suggestions (naming, structure, tests).

Be concise. Cite specific file:line references. Skip stylistic nits.

Diff:
{{DIFF}}`,
  },
  {
    title: "Generate JSDoc from function signature",
    itemTypeName: "prompt",
    contentType: ContentType.TEXT,
    description: "Produce TypeScript-aware JSDoc for an exported function.",
    content: `Generate JSDoc for the TypeScript function below.

Requirements:
- One-sentence summary, then a blank line, then details.
- Document every parameter with @param including the parameter name and a description.
- Document the return value with @returns.
- Note any thrown errors with @throws.
- If the function is async, mention what the promise resolves to.
- Do NOT restate types that TypeScript already infers.

Function:
{{CODE}}`,
  },
  {
    title: "Refactor for testability",
    itemTypeName: "prompt",
    contentType: ContentType.TEXT,
    description: "Identify seams and propose a refactor without changing behavior.",
    content: `Refactor the code below to make it easier to unit test.

Constraints:
- Do not change observable behavior.
- Introduce dependency injection where appropriate (clock, fetcher, logger).
- Keep the public API stable; if you must break it, list the breakages first.
- Output the refactored code, then a short bullet list of the testing seams you introduced.

Code:
{{CODE}}`,
  },
];

const DEVOPS_ITEMS: ItemSeed[] = [
  {
    title: "Multi-stage Dockerfile for Next.js standalone",
    itemTypeName: "snippet",
    contentType: ContentType.TEXT,
    language: "dockerfile",
    description: "Slim production image using Next.js standalone output.",
    content: `# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]`,
  },
  {
    title: "Deploy to Vercel from CLI",
    itemTypeName: "command",
    contentType: ContentType.TEXT,
    language: "bash",
    description: "Push a production deploy without going through the dashboard.",
    content: `npx vercel deploy --prod --yes`,
  },
  {
    title: "Vercel deployment docs",
    itemTypeName: "link",
    contentType: ContentType.URL,
    url: "https://vercel.com/docs/deployments",
    description: "Official Vercel deployments guide.",
  },
  {
    title: "Docker official documentation",
    itemTypeName: "link",
    contentType: ContentType.URL,
    url: "https://docs.docker.com/",
    description: "Docker engine, CLI, Compose, and image reference.",
  },
];

const TERMINAL_COMMANDS_ITEMS: ItemSeed[] = [
  {
    title: "Undo last commit, keep changes staged",
    itemTypeName: "command",
    contentType: ContentType.TEXT,
    language: "bash",
    description:
      "Revert the most recent commit but keep the file modifications in the index.",
    content: `git reset --soft HEAD~1`,
  },
  {
    title: "Prune all unused Docker objects",
    itemTypeName: "command",
    contentType: ContentType.TEXT,
    language: "bash",
    description:
      "Remove dangling images, stopped containers, unused networks and volumes.",
    content: `docker system prune -af --volumes`,
  },
  {
    title: "Kill the process listening on a port",
    itemTypeName: "command",
    contentType: ContentType.TEXT,
    language: "bash",
    description:
      "Find and force-kill the process holding a TCP port (default 3000).",
    content: `lsof -ti:3000 | xargs kill -9`,
  },
  {
    title: "Upgrade all npm dependencies to latest",
    itemTypeName: "command",
    contentType: ContentType.TEXT,
    language: "bash",
    description:
      "Bump every dependency in package.json to its newest version, then install.",
    content: `npx npm-check-updates -u && npm install`,
  },
];

const DESIGN_RESOURCES_ITEMS: ItemSeed[] = [
  {
    title: "Tailwind CSS documentation",
    itemTypeName: "link",
    contentType: ContentType.URL,
    url: "https://tailwindcss.com/docs",
    description: "Utility-first CSS framework reference.",
  },
  {
    title: "shadcn/ui components",
    itemTypeName: "link",
    contentType: ContentType.URL,
    url: "https://ui.shadcn.com/",
    description: "Copy-paste React components built on Radix + Tailwind.",
  },
  {
    title: "Radix UI Primitives",
    itemTypeName: "link",
    contentType: ContentType.URL,
    url: "https://www.radix-ui.com/primitives",
    description: "Unstyled, accessible component primitives for React.",
  },
  {
    title: "Lucide icon library",
    itemTypeName: "link",
    contentType: ContentType.URL,
    url: "https://lucide.dev/icons/",
    description: "Open-source icon set used across the DevStash UI.",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Seeding system item types...");
  const itemTypes = await seedSystemItemTypes();

  console.log("Seeding demo user...");
  const user = await seedDemoUser();

  console.log("Seeding collections + items...");
  const collectionSeeds: Array<{
    name: string;
    description: string;
    defaultType: string;
    items: ItemSeed[];
  }> = [
    {
      name: "React Patterns",
      description: "Reusable React patterns and hooks",
      defaultType: "snippet",
      items: REACT_PATTERNS_ITEMS,
    },
    {
      name: "AI Workflows",
      description: "AI prompts and workflow automations",
      defaultType: "prompt",
      items: AI_WORKFLOWS_ITEMS,
    },
    {
      name: "DevOps",
      description: "Infrastructure and deployment resources",
      defaultType: "snippet",
      items: DEVOPS_ITEMS,
    },
    {
      name: "Terminal Commands",
      description: "Useful shell commands for everyday development",
      defaultType: "command",
      items: TERMINAL_COMMANDS_ITEMS,
    },
    {
      name: "Design Resources",
      description: "UI/UX resources and references",
      defaultType: "link",
      items: DESIGN_RESOURCES_ITEMS,
    },
  ];

  for (const c of collectionSeeds) {
    const defaultTypeId = itemTypes.get(c.defaultType)?.id;
    const collection = await getOrCreateCollection(
      user.id,
      c.name,
      c.description,
      defaultTypeId,
    );
    for (const itemSeed of c.items) {
      const item = await getOrCreateItem(user.id, itemTypes, itemSeed);
      await linkItemToCollection(item.id, collection.id);
    }
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
