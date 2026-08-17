import { z } from "zod";

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional(),
    taskTypeId: z.string().uuid().optional(),
    assignedTo: z.string().uuid("Assign this to someone"),
    customerId: z.string().uuid().optional(),
    municipalityId: z.string().uuid().optional(),
    dspId: z.string().uuid().optional(),
    saleId: z.string().uuid().optional(),
    dueDate: z.string().optional(),
    dueTime: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    tags: z.array(z.string()).default([]),
  })
  .refine((d) => d.customerId || d.municipalityId || d.dspId || d.saleId, {
    message: "Link this task to a customer, municipality, DSP, or sale",
    path: ["customerId"],
  });

export type TaskFormInput = z.infer<typeof taskFormSchema>;
