"use client";

import { useEffect, useState, useActionState, useRef } from "react";
import { X } from "lucide-react";
import { getProfilePageData, type ProfilePageData } from "@/actions/get-profile-page-data";
import { changePassword, type ChangePasswordState } from "@/actions/change-password";
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
  DialogTitle,
} from "@/components/ui/dialog";
import UserAvatar from "@/components/auth/UserAvatar";
import { getIcon } from "@/lib/db/icons";
import { formatDateLong } from "@/lib/utils";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const cpInitial: ChangePasswordState = {};
const daInitial: DeleteAccountState = {};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

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

function BreakdownList({
  rows,
  maxCount,
}: {
  rows: ProfilePageData["stats"]["breakdown"];
  maxCount: number;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const Icon = getIcon(row.icon);
        const pct = (row.count / maxCount) * 100;
        return (
          <li key={row.typeId} className="flex items-center gap-3 text-sm">
            <Icon className="size-4 shrink-0" style={{ color: row.color }} />
            <span className="w-24 shrink-0 capitalize">{row.name}s</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: row.color }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-muted-foreground">
              {row.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const [data, setData] = useState<ProfilePageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [daConfirmText, setDaConfirmText] = useState("");

  const [cpState, cpAction, cpPending] = useActionState(changePassword, cpInitial);
  const [daState, daAction, daPending] = useActionState(deleteAccount, daInitial);
  const cpFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getProfilePageData();
        if (!cancelled) {
          setData(d);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[PROFILE_MODAL]", e);
          setLoadError("Failed to load profile");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (cpState.success) {
      cpFormRef.current?.reset();
    }
  }, [cpState.success]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDaConfirmText("");
    }
    onOpenChange(next);
  };

  const loading = open && !data && !loadError;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-2/3 max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
          <DialogTitle>Profile</DialogTitle>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Close">
                <X className="size-4" />
              </Button>
            }
          />
        </div>

        <div className="space-y-6 p-6">
          {loading && (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          )}

          {loadError && !data && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {data && (
            <>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <UserAvatar
                    src={data.profile.image}
                    name={data.profile.name ?? data.profile.email}
                    size={64}
                  />
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold truncate">
                      {data.profile.name ?? "Unnamed user"}
                    </h2>
                    <p className="text-sm text-muted-foreground truncate">
                      {data.profile.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Member since {formatDateLong(new Date(data.profile.createdAt))}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Items" value={data.stats.itemCount} />
                    <StatCard label="Collections" value={data.stats.collectionCount} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-3">Items by type</h3>
                    <BreakdownList
                      rows={data.stats.breakdown}
                      maxCount={Math.max(
                        ...data.stats.breakdown.map((b) => b.count),
                        1,
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {data.profile.hasPassword && (
                <Card>
                  <CardHeader>
                    <CardTitle>Change password</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cpState.success && (
                      <div className="mb-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                        Password updated successfully.
                      </div>
                    )}
                    {cpState.error && (
                      <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {cpState.error}
                      </div>
                    )}
                    <form ref={cpFormRef} action={cpAction} className="space-y-4">
                      <Field
                        id="currentPassword"
                        label="Current password"
                        type="password"
                        error={cpState.errors?.currentPassword}
                      />
                      <Field
                        id="newPassword"
                        label="New password"
                        type="password"
                        error={cpState.errors?.newPassword}
                      />
                      <Field
                        id="confirmPassword"
                        label="Confirm new password"
                        type="password"
                        error={cpState.errors?.confirmPassword}
                      />
                      <Button type="submit" disabled={cpPending}>
                        {cpPending ? "Updating…" : "Update password"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger zone</CardTitle>
                  <CardDescription>
                    Permanently delete your account and all of your items, collections,
                    and custom types. This cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {daState.error && (
                    <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {daState.error}
                    </div>
                  )}
                  <form action={daAction} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="confirmText" className="text-sm font-medium">
                        Type <span className="font-mono">DELETE</span> to confirm
                      </label>
                      <Input
                        id="confirmText"
                        name="confirmText"
                        value={daConfirmText}
                        onChange={(e) => setDaConfirmText(e.target.value)}
                        placeholder="DELETE"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={daConfirmText !== "DELETE" || daPending}
                    >
                      {daPending ? "Deleting…" : "Delete account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
