"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

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
} from "@/components/ui/dialog";

export function CredentialsDialog({
  email,
  password,
  onOpenChange,
}: {
  email: string;
  password: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`);
    setCopied(true);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share these credentials</DialogTitle>
          <DialogDescription>
            No email was sent. Give this password to them directly (Slack,
            in person, whatever&apos;s convenient) — they&apos;ll be forced
            to set their own password the moment they sign in.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <KeyRound />
          <AlertDescription className="flex flex-col gap-2">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <span className="font-mono text-sm">{email}</span>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Temporary password</Label>
              <span className="font-mono text-sm">{password}</span>
            </div>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            Copy
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
