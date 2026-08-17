import { z } from "zod";

// HH requires only a name + municipality. RTL/WS are the accounts counted
// toward the 300-account KPI, so they must be real and reachable (§6.2).
export const customerFormSchema = z
  .object({
    customerType: z.enum(["HH", "RTL", "WS"]),
    businessName: z.string().trim().optional(),
    ownerName: z.string().trim().optional(),
    contactNumber: z.string().trim().optional(),
    municipalityId: z.string().uuid("Select a municipality"),
    barangay: z.string().trim().optional(),
    address: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.businessName && !data.ownerName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a business name or owner name",
        path: ["businessName"],
      });
    }
    if (data.customerType !== "HH") {
      if (!data.ownerName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Owner name is required for RTL/WS accounts",
          path: ["ownerName"],
        });
      }
      if (!data.contactNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contact number is required for RTL/WS accounts",
          path: ["contactNumber"],
        });
      }
      if (!data.address) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Address is required for RTL/WS accounts",
          path: ["address"],
        });
      }
    }
  });

export type CustomerFormInput = z.infer<typeof customerFormSchema>;
