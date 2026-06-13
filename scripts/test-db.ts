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

async function main() {
  console.log("Testing Neon connection via @prisma/adapter-neon...\n");

  const [{ version }] = await prisma.$queryRaw<
    { version: string }[]
  >`SELECT version()`;
  console.log("PostgreSQL:", version, "\n");

  const counts = {
    users: await prisma.user.count(),
    itemTypes: await prisma.itemType.count(),
    systemItemTypes: await prisma.itemType.count({ where: { isSystem: true } }),
    items: await prisma.item.count(),
    collections: await prisma.collection.count(),
    tags: await prisma.tag.count(),
  };
  console.log("Row counts:", counts, "\n");

  const systemTypes = await prisma.itemType.findMany({
    where: { isSystem: true },
    select: { name: true, icon: true, color: true },
    orderBy: { name: "asc" },
  });
  console.log("System item types:");
  for (const t of systemTypes) {
    console.log(`  ${t.color}  ${t.name.padEnd(10)} icon=${t.icon}`);
  }

  console.log("\nOK");
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
