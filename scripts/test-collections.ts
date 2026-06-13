import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getCurrentUserId } from "../src/lib/db/user";

async function main() {
  console.log("Looking up demo user...");
  const userId = await getCurrentUserId();
  console.log(`  userId = ${userId}`);
  console.log("OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
