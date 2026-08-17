import { z } from "zod";

export const productFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .regex(/^[A-Z0-9_]+$/, "Use uppercase letters, numbers, and underscores only"),
  name: z.string().trim().min(1, "Name is required"),
  unitPrice: z.coerce.number().min(0, "Price can't be negative"),
  unitType: z.enum(["canister", "crate", "set"]),
  canistersIncluded: z.coerce.number().int().min(0),
  includesStove: z.boolean().default(false),
  stoveCount: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
