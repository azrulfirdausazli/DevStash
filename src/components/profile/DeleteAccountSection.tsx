"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/actions/delete-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: DeleteAccountState = {};

export default function DeleteAccountSection() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText === "DELETE";

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Permanently delete your account and all of your items, collections, and
          custom types. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>
            Delete account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This will permanently delete your account and all associated data.
                Type DELETE below to confirm.
              </DialogDescription>
            </DialogHeader>
            <form action={formAction} className="space-y-4">
              <Input
                name="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                aria-label="Type DELETE to confirm"
              />
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!canDelete || pending}
                >
                  {pending ? "Deleting..." : "Delete account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
