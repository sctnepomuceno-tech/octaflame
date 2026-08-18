"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus } from "lucide-react";
import { toast } from "sonner";

import { reinviteUser } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function ReinviteButton({
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
      const result = await reinviteUser(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation sent.");
      router.refresh();
    });
  }

  return (
    <Button onClick={submit} disabled={pending} variant={variant} size={variant === "ghost" ? "sm" : "default"}>
      {pending ? <Loader2 className="animate-spin" /> : <MailPlus />}
      Reinvite
    </Button>
  );
}
