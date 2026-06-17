"use server";

import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { checkRegisterLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
});

export type RegisterState = {
  success?: boolean;
  error?: string;
  errors?: { name?: string; email?: string; password?: string; confirmPassword?: string };
};

export async function registerUser(
  prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const limit = await checkRegisterLimit();
  if (!limit.success) {
    const mins = Math.ceil(limit.retryAfterSeconds / 60);
    return { error: `Too many attempts. Please try again in ${mins} minutes.` };
  }

  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: RegisterState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof typeof fieldErrors;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { errors: fieldErrors };
  }

  const { name, email: rawEmail, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return { errors: { confirmPassword: "Passwords do not match" } };
  }

  const email = rawEmail.toLowerCase().trim();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { error: "A user with this email already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });
  } catch (error) {
    console.error("[REGISTER]", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/signin?registered=true");
}
