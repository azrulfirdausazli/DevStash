import { cache } from "react";
import { prisma } from "@/lib/prisma";

const DEMO_USER_EMAIL = "demo@devstash.io";

export const getCurrentUserId = cache(async (): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Demo user "${DEMO_USER_EMAIL}" not found. Run \`npm run db:seed\` to create it.`,
    );
  }
  return user.id;
});
