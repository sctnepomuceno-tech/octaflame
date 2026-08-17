"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateTask, type AssignableUser } from "@/app/actions/tasks";
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

export interface EditableTask {
  id: string;
  title: string;
  description: string | null;
  task_type_id: string | null;
  assigned_to: string;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

export function TaskEditDialog({
  task,
  taskTypes,
  assignableUsers,
  trigger,
}: {
  task: EditableTask;
  taskTypes: Option[];
  assignableUsers: AssignableUser[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [taskTypeId, setTaskTypeId] = useState(task.task_type_id ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      const result = await updateTask(task.id, {
        title,
        description,
        taskTypeId: taskTypeId || undefined,
        assignedTo,
        dueDate,
        priority,
        status,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
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
            <div className="col-span-2 grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
