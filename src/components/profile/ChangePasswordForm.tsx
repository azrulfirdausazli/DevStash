"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type ChangePasswordState } from "@/actions/change-password";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ChangePasswordState = {};

function Field({
  id,
  label,
  type,
  error,
}: {
  id: string;
  label: string;
  type: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        {state.success && (
          <div className="mb-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            Password updated successfully.
          </div>
        )}
        {state.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <form ref={formRef} action={formAction} className="space-y-4">
          <Field
            id="currentPassword"
            label="Current password"
            type="password"
            error={state.errors?.currentPassword}
          />
          <Field
            id="newPassword"
            label="New password"
            type="password"
            error={state.errors?.newPassword}
          />
          <Field
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            error={state.errors?.confirmPassword}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
