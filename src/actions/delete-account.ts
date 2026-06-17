"use server";

import { z } from "zod/v4";
import { Prisma } from "@/generated/prisma/client";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  confirmText: z.literal("DELETE", {
    message: "Type DELETE to confirm",
  }),
});

export type DeleteAccountState = {
  error?: string;
};

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const raw = {
    confirmText: formData.get("confirmText") as string,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confirmation required" };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    await prisma.user.delete({
      where: { id: session.user.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { error: "Account no longer exists" };
    }
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[DELETE_ACCOUNT]", error);
    return { error: "Something went wrong. Please try again." };
  }

  await signOut({ redirectTo: "/signin?deleted=true" });
  throw new Error("signOut should have redirected");
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
