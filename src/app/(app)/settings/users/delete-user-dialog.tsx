"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { deleteUser, listUnassignedDspUsers, type UnassignedDspUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReassignChoice = "replacement" | "self" | "none";

export function DeleteUserDialog({
  userId,
  userName,
  isActive,
  isDsp,
  variant = "default",
}: {
  userId: string;
  userName: string;
  isActive: boolean;
  isDsp: boolean;
  variant?: "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<UnassignedDspUser[]>([]);
  const [reassignTasksTo, setReassignTasksTo] = useState<ReassignChoice>("self");
  const [replacementUserId, setReplacementUserId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && isActive && isDsp) {
      listUnassignedDspUsers().then(setCandidates);
    }
  }, [open, isActive, isDsp]);

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await deleteUser(
        userId,
        isActive
          ? {
              reassignTasksTo,
              replacementUserId: reassignTasksTo === "replacement" ? replacementUserId || null : null,
            }
          : undefined
      );
      if (result.error && !result.deactivatedInstead) {
        setServerError(result.error);
        return;
      }
      if (result.deactivatedInstead) {
        toast.warning(result.error ?? `${userName}'s access was revoked instead of deleted.`);
      } else {
        toast.success(`${userName} deleted.`);
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "ghost" ? (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Delete user">
            <X />
          </Button>
        ) : (
          <Button variant="destructive">
            <X /> Delete
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {userName}?</DialogTitle>
          <DialogDescription>
            This can&apos;t be undone. If they have any sales, tasks, or
            other activity on record, the account can&apos;t be fully
            removed — their access will be revoked instead and the records
            stay intact.
          </DialogDescription>
        </DialogHeader>

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        {isActive ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label>Reassign their open tasks to</Label>
              <Select value={reassignTasksTo} onValueChange={(v) => setReassignTasksTo(v as ReassignChoice)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Me</SelectItem>
                  {isDsp && candidates.length > 0 ? (
                    <SelectItem value="replacement">The incoming DSP user</SelectItem>
                  ) : null}
                  <SelectItem value="none">Leave as-is (not recommended)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reassignTasksTo === "replacement" ? (
              <div className="grid gap-2">
                <Label>Incoming DSP user{isDsp ? " (also takes the territory)" : ""}</Label>
                <Select value={replacementUserId} onValueChange={setReplacementUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isDsp && candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No unassigned DSP-role users are available right now — the
                territory will be left unassigned until someone is added or
                reassigned to it in Settings.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
