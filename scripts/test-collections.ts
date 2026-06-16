import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  getDashboardCollectionStats,
  getDashboardCollections,
} from "../src/lib/db/collections";

async function main() {
  console.log("Looking up demo user...");
  const user = await prisma.user.findUnique({
    where: { email: "demo@devstash.io" },
    select: { id: true },
  });
  if (!user) {
    throw new Error('Demo user "demo@devstash.io" not found. Run `npm run db:seed`.');
  }
  const userId = user.id;
  console.log(`  userId = ${userId}\n`);

  console.log("Collection stats...");
  const stats = await getDashboardCollectionStats(userId);
  console.log(`  collectionCount       = ${stats.collectionCount}`);
  console.log(`  favoriteCollectionCount = ${stats.favoriteCollectionCount}\n`);

  console.log("Dashboard collections (with dominant type)...");
  const collections = await getDashboardCollections(userId);
  for (const c of collections) {
    const dom = c.dominantType
      ? `${c.dominantType.name} (${c.dominantType.color})`
      : "none";
    const typeList = c.types
      .map((t) => `${t.name}:${t.count}`)
      .join(", ");
    console.log(
      `  - ${c.name}  [items=${c.itemCount}, fav=${c.isFavorite}, dominant=${dom}]  types=[${typeList}]`,
    );
  }

  console.log("\nOK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
