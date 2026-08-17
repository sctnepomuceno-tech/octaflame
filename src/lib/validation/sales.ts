import { z } from "zod";

export const saleLineSchema = z
  .object({
    productId: z.string().uuid(),
    qtyCrates: z.number().int().min(0).default(0),
    qtyCanisters: z.number().int().min(0).default(0),
    qtySets: z.number().int().min(0).default(0),
    notes: z.string().trim().optional(),
  })
  .refine((l) => l.qtyCrates > 0 || l.qtyCanisters > 0 || l.qtySets > 0, {
    message: "Enter a quantity for every line",
  });

export const saleFormSchema = z.object({
  clientRef: z.string().uuid(),
  customerId: z.string().uuid("Select a customer"),
  saleDate: z.string().min(1, "Sale date is required"),
  deploymentDate: z.string().trim().optional(),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]),
  amountPaid: z.number().min(0).default(0),
  emptiesCollected: z.number().int().min(0).default(0),
  cratesReturnedByCustomer: z.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
  lines: z.array(saleLineSchema).min(1, "Add at least one line item"),
});

export type SaleFormInput = z.infer<typeof saleFormSchema>;
export type SaleLineInput = z.infer<typeof saleLineSchema>;
