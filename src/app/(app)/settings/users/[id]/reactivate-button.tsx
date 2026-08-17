"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { reactivateUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function ReactivateButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await reactivateUser(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User reactivated.");
      router.refresh();
    });
  }

  return (
    <Button onClick={submit} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <UserCheck />}
      Reactivate
    </Button>
  );
}
