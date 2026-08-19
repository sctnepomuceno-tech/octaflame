"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { issueTempPassword } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { CredentialsDialog } from "./credentials-dialog";

export function SetPasswordButton({
  userId,
  email,
  variant = "default",
}: {
  userId: string;
  email: string;
  variant?: "default" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await issueTempPassword(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        onClick={submit}
        disabled={pending}
        variant={variant}
        size={variant === "ghost" ? "sm" : "default"}
      >
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Set password
      </Button>
      {tempPassword ? (
        <CredentialsDialog
          email={email}
          password={tempPassword}
          onOpenChange={(next) => {
            if (!next) setTempPassword(null);
          }}
        />
      ) : null}
    </>
  );
}
