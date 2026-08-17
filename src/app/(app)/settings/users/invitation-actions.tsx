"use client";

import { useTransition } from "react";
import { Loader2, RotateCw, Ban } from "lucide-react";
import { toast } from "sonner";

import { resendInvitation, revokeInvitation } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [resending, startResend] = useTransition();
  const [revoking, startRevoke] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={resending || revoking}
        onClick={() =>
          startResend(async () => {
            const result = await resendInvitation(invitationId);
            if (result.error) toast.error(result.error);
            else toast.success("Invitation resent.");
          })
        }
      >
        {resending ? <Loader2 className="animate-spin" /> : <RotateCw />}
        Resend
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={resending || revoking}
        onClick={() =>
          startRevoke(async () => {
            const result = await revokeInvitation(invitationId);
            if (result.error) toast.error(result.error);
            else toast.success("Invitation revoked.");
          })
        }
      >
        {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
        Revoke
      </Button>
    </div>
  );
}
