"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setProductActive } from "@/app/actions/products";
import { Button } from "@/components/ui/button";

export function ProductActiveToggle({ productId, active }: { productId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      const result = await setProductActive(productId, !active);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? "Product deactivated." : "Product reactivated.");
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending}>
      {active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
