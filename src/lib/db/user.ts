import { cache } from "react";
import { auth } from "@/auth";

export const getCurrentUserId = cache(async (): Promise<string> => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(
      "Unauthenticated request reached a server component. " +
        "The /dashboard/* proxy should have redirected to /api/auth/signin before this.",
    );
  }
  return session.user.id;
});
