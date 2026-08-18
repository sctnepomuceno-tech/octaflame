"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { toast } from "sonner";

import { setViewAsRole } from "@/app/actions/view-as";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export function PreviewBanner({ previewRole }: { previewRole: Role }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function exit() {
    startTransition(async () => {
      const result = await setViewAsRole(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-warning/15 px-4 py-2 text-sm text-warning-foreground print:hidden">
      <Eye className="size-4 shrink-0" />
      <span>
        Previewing as <span className="font-medium">{ROLE_LABELS[previewRole]}</span> — nothing you do here is restricted, this is only what they&apos;d see.
      </span>
      <Button variant="ghost" size="sm" onClick={exit} disabled={pending} className="h-7 gap-1 text-warning-foreground hover:text-warning-foreground">
        <X className="size-3.5" />
        Exit preview
      </Button>
    </div>
  );
}
