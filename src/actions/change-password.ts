"use server";

import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm new password is required"),
});

export type ChangePasswordState = {
  success?: boolean;
  error?: string;
  errors?: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
};

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: NonNullable<ChangePasswordState["errors"]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof typeof fieldErrors;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { errors: fieldErrors };
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { errors: { confirmPassword: "Passwords do not match" } };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user || !user.password) {
      return { error: "Cannot change password for this account" };
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return { errors: { currentPassword: "Current password is incorrect" } };
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    });

    return { success: true };
  } catch (error) {
    console.error("[CHANGE_PASSWORD]", error);
    return { error: "Something went wrong. Please try again." };
  }
}
