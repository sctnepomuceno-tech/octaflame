import { z } from "zod";

export const inviteUserSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    phone: z.string().trim().optional(),
    role: z.enum(["management", "dsp", "warehouse", "office", "viewer"]),
    dspId: z.string().uuid().optional().nullable(),
    permissions: z.array(z.string()),
  })
  .refine((data) => data.role !== "dsp" || !!data.dspId, {
    message: "DSP role requires a territory assignment",
    path: ["dspId"],
  });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z
  .object({
    role: z.enum(["management", "dsp", "warehouse", "office", "viewer"]),
    dspId: z.string().uuid().optional().nullable(),
    permissions: z.array(z.string()),
    confirmEmail: z.string().trim().optional(),
  })
  .refine((data) => data.role !== "dsp" || !!data.dspId, {
    message: "DSP role requires a territory assignment",
    path: ["dspId"],
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const deactivateUserSchema = z.object({
  reassignTasksTo: z.enum(["replacement", "self", "none"]),
  replacementUserId: z.string().uuid().optional().nullable(),
});

export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
