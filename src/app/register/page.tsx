"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerUser, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerUser, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Enter your details to register
          </p>
        </div>

        {state.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input
              id="name"
              name="name"
              required
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            />
            {state.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            />
            {state.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            />
            {state.errors?.password && (
              <p className="text-xs text-destructive">{state.errors.password}</p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            />
            {state.errors?.confirmPassword && (
              <p className="text-xs text-destructive">{state.errors.confirmPassword}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow disabled:opacity-50"
          >
            {pending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
