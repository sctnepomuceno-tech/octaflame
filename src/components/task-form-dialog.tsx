"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createTask, type AssignableUser } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

export function TaskFormDialog({
  taskTypes,
  assignableUsers,
  defaultCustomerId,
  defaultAssigneeId,
  trigger,
}: {
  taskTypes: Option[];
  assignableUsers: AssignableUser[];
  defaultCustomerId?: string;
  defaultAssigneeId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [assignedTo, setAssignedTo] = useState(defaultAssigneeId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!title.trim() || !assignedTo) {
      toast.error("Title and assignee are required.");
      return;
    }
    startTransition(async () => {
      const result = await createTask({
        title,
        description,
        taskTypeId: taskTypeId || undefined,
        assignedTo,
        customerId: defaultCustomerId,
        dueDate,
        priority,
        tags: [],
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task created.");
      setOpen(false);
      setTitle("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus /> Follow-up
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={taskTypeId} onValueChange={setTaskTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
