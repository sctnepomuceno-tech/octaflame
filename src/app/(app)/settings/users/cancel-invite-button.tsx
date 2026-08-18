"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";

import { cancelInviteForUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function CancelInviteButton({
  userId,
  variant = "default",
}: {
  userId: string;
  variant?: "default" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await cancelInviteForUser(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation cancelled.");
      router.refresh();
    });
  }

  return (
    <Button
      onClick={submit}
      disabled={pending}
      variant={variant === "ghost" ? "ghost" : "destructive"}
      size={variant === "ghost" ? "sm" : "default"}
      className={variant === "ghost" ? "text-destructive hover:text-destructive" : undefined}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Ban />}
      Cancel invite
    </Button>
  );
}
