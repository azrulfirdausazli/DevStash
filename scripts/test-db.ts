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

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
} as const;

const ITEM_TYPE_COLORS: Record<string, string> = {
  snippet: "#3b82f6",
  prompt: "#8b5cf6",
  command: "#f97316",
  note: "#fde047",
  file: "#6b7280",
  image: "#ec4899",
  link: "#10b981",
};

function hex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function truncate(s: string, n: number): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  return collapsed.length > n ? collapsed.slice(0, n - 1) + "…" : collapsed;
}

async function main() {
  console.log(
    `${COLORS.bold}DevStash DB smoke test${COLORS.reset} — via @prisma/adapter-neon (pooled URL)\n`,
  );

  // --- Connection ----------------------------------------------------------
  const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
  console.log(`${COLORS.dim}PostgreSQL:${COLORS.reset} ${version}\n`);

  // --- Row counts ----------------------------------------------------------
  const counts = {
    users: await prisma.user.count(),
    itemTypes: await prisma.itemType.count(),
    systemItemTypes: await prisma.itemType.count({ where: { isSystem: true } }),
    items: await prisma.item.count(),
    collections: await prisma.collection.count(),
    tags: await prisma.tag.count(),
  };
  console.log(`${COLORS.bold}Row counts${COLORS.reset}`);
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(18)} ${v}`);
  }
  console.log();

  // --- System item types ---------------------------------------------------
  const systemTypes = await prisma.itemType.findMany({
    where: { isSystem: true },
    select: { name: true, icon: true, color: true },
    orderBy: { name: "asc" },
  });
  console.log(`${COLORS.bold}System item types${COLORS.reset}`);
  for (const t of systemTypes) {
    console.log(`  ${hex(t.color)}●${COLORS.reset}  ${t.name.padEnd(10)} icon=${t.icon}`);
  }
  console.log();

  // --- Demo user -----------------------------------------------------------
  const demoUser = await prisma.user.findUnique({
    where: { email: "demo@devstash.io" },
    select: {
      id: true,
      email: true,
      name: true,
      isPro: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { items: true, collections: true } },
    },
  });

  if (!demoUser) {
    console.log(`${COLORS.yellow}No demo user (demo@devstash.io) found. Run npm run db:seed.${COLORS.reset}\n`);
  } else {
    console.log(`${COLORS.bold}Demo user${COLORS.reset}`);
    console.log(`  email           ${demoUser.email}`);
    console.log(`  name            ${demoUser.name}`);
    console.log(`  isPro           ${demoUser.isPro}`);
    console.log(`  emailVerified   ${demoUser.emailVerified?.toISOString() ?? "—"}`);
    console.log(`  createdAt       ${demoUser.createdAt.toISOString()}`);
    console.log(`  owns            ${demoUser._count.items} items, ${demoUser._count.collections} collections`);
    console.log();
  }

  // --- Collections + items -------------------------------------------------
  const collections = await prisma.collection.findMany({
    orderBy: { name: "asc" },
    include: {
      defaultType: { select: { name: true, color: true } },
      items: {
        include: {
          item: {
            select: {
              title: true,
              contentType: true,
              content: true,
              url: true,
              language: true,
              isFavorite: true,
              isPinned: true,
              itemType: { select: { name: true, color: true } },
              _count: { select: { collections: true } },
            },
          },
        },
        orderBy: { addedAt: "asc" },
      },
    },
  });

  console.log(`${COLORS.bold}Collections${COLORS.reset}  (${collections.length} total)`);
  for (const c of collections) {
    const defaultLabel = c.defaultType
      ? `${hex(c.defaultType.color)}●${COLORS.reset} ${c.defaultType.name}`
      : `${COLORS.dim}—${COLORS.reset}`;
    console.log(
      `\n  ${COLORS.cyan}${c.name}${COLORS.reset}  ${COLORS.dim}(default: ${defaultLabel})${COLORS.reset}`,
    );
    if (c.description) {
      console.log(`  ${COLORS.dim}${c.description}${COLORS.reset}`);
    }
    if (c.items.length === 0) {
      console.log(`  ${COLORS.dim}(no items)${COLORS.reset}`);
      continue;
    }
    for (const link of c.items) {
      const it = link.item;
      const tColor = ITEM_TYPE_COLORS[it.itemType.name] ?? "#888888";
      const pin = it.isPinned ? ` ${COLORS.yellow}📌${COLORS.reset}` : "";
      const fav = it.isFavorite ? ` ${COLORS.magenta}★${COLORS.reset}` : "";
      const cross = it._count.collections > 1 ? ` ${COLORS.dim}(in ${it._count.collections} collections)${COLORS.reset}` : "";
      console.log(
        `    ${hex(tColor)}●${COLORS.reset}  ${it.title}${pin}${fav}${cross}`,
      );
      // Show a short preview of the content / url
      if (it.contentType === "URL" && it.url) {
        console.log(`        ${COLORS.dim}${it.url}${COLORS.reset}`);
      } else if (it.content) {
        console.log(`        ${COLORS.dim}${truncate(it.content, 90)}${COLORS.reset}`);
      }
    }
  }
  console.log();

  // --- Cross-collection items ---------------------------------------------
  const crossItems = await prisma.item.findMany({
    where: { collections: { some: {} } },
    include: {
      _count: { select: { collections: true } },
      collections: { include: { collection: { select: { name: true } } } },
    },
  });
  const multi = crossItems.filter((i) => i._count.collections > 1);

  console.log(`${COLORS.bold}Cross-collection items${COLORS.reset}  (items in 2+ collections)`);
  if (multi.length === 0) {
    console.log(`  ${COLORS.dim}none${COLORS.reset}`);
  } else {
    for (const it of multi) {
      const names = it.collections.map((c) => c.collection.name).join(", ");
      console.log(`  ${COLORS.green}${it.title}${COLORS.reset} → ${names}`);
    }
  }
  console.log();

  console.log(`${COLORS.green}OK${COLORS.reset}`);
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
