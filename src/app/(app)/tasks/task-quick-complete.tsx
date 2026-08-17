"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateTaskStatus } from "@/app/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";

export function TaskQuickComplete({ taskId, completed }: { taskId: string; completed: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(checked: boolean) {
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, checked ? "completed" : "pending");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Checkbox
      checked={completed}
      disabled={pending}
      onCheckedChange={(checked) => toggle(checked === true)}
      aria-label={completed ? "Mark as pending" : "Mark as completed"}
    />
  );
}
