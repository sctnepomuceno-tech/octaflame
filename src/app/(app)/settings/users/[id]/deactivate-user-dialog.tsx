"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

import { deactivateUser, listUnassignedDspUsers, type UnassignedDspUser } from "@/app/actions/users";
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

export function DeactivateUserDialog({
  userId,
  userName,
  isDsp,
}: {
  userId: string;
  userName: string;
  isDsp: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<UnassignedDspUser[]>([]);
  const [reassignTasksTo, setReassignTasksTo] = useState<ReassignChoice>("self");
  const [replacementUserId, setReplacementUserId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && isDsp) {
      listUnassignedDspUsers().then(setCandidates);
    }
  }, [open, isDsp]);

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await deactivateUser(userId, {
        reassignTasksTo,
        replacementUserId: reassignTasksTo === "replacement" ? replacementUserId || null : null,
      });
      if (result.error) {
        setServerError(result.error);
        return;
      }
      toast.success(`${userName} deactivated.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <UserX /> Deactivate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {userName}?</DialogTitle>
          <DialogDescription>
            This revokes login immediately. Their historical sales, tasks, and
            activity stay attributed to them — nothing is deleted (§5.9).
            {isDsp
              ? " Because this is a DSP account, their customers stay attached to the DSP record and pass to whoever takes the territory next."
              : null}
          </DialogDescription>
        </DialogHeader>

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

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
              territory will be left unassigned until someone is invited or
              reassigned to it in Settings.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
