"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { deleteDeactivatedUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
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

export function DeleteUserDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await deleteDeactivatedUser(userId);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      toast.success(`${userName} deleted. Their email is free to invite again.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Delete user">
          <X />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {userName}?</DialogTitle>
          <DialogDescription>
            This permanently removes their account so the email address can
            be invited again from scratch. This can&apos;t be undone. If they
            have any sales, tasks, or other activity on record, deletion will
            be refused — deactivate them instead in that case.
          </DialogDescription>
        </DialogHeader>

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
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
