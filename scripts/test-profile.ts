import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getProfileData, getProfileStats } from "../src/lib/db/profile";

async function main() {
  console.log("Looking up demo user...");
  const user = await prisma.user.findUnique({
    where: { email: "demo@devstash.io" },
    select: { id: true, createdAt: true },
  });
  if (!user) {
    throw new Error('Demo user "demo@devstash.io" not found. Run `npm run db:seed`.');
  }
  const userId = user.id;
  console.log(`  userId = ${userId}\n`);

  console.log("Profile data...");
  const profile = await getProfileData(userId);
  console.log(`  email        = ${profile.email}`);
  console.log(`  name         = ${profile.name}`);
  console.log(`  image        = ${profile.image}`);
  console.log(`  hasPassword  = ${profile.hasPassword}`);
  console.log(`  createdAt    = ${profile.createdAt.toISOString()}\n`);

  console.log("Profile stats...");
  const stats = await getProfileStats(userId);
  console.log(`  itemCount       = ${stats.itemCount}`);
  console.log(`  collectionCount = ${stats.collectionCount}\n`);

  console.log("Item type breakdown:");
  for (const row of stats.breakdown) {
    console.log(`  - ${row.name.padEnd(10)} icon=${row.icon.padEnd(12)} color=${row.color} count=${row.count}`);
  }

  if (stats.breakdown.length !== 7) {
    throw new Error(`Expected 7 breakdown rows, got ${stats.breakdown.length}`);
  }
  const sum = stats.breakdown.reduce((a, b) => a + b.count, 0);
  if (sum !== stats.itemCount) {
    throw new Error(`Breakdown sum (${sum}) does not match itemCount (${stats.itemCount})`);
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
