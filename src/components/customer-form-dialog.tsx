"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { createCustomer, updateCustomer, findSimilarCustomers, type SimilarCustomer } from "@/app/actions/customers";
import { customerFormSchema, type CustomerFormInput } from "@/lib/validation/customers";
import { offlineDb } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";

export interface MunicipalityOption {
  id: string;
  name: string;
}

const CUSTOMER_TYPES: { value: CustomerFormInput["customerType"]; label: string; hint: string }[] = [
  { value: "HH", label: "Household", hint: "Individual household buyer" },
  { value: "RTL", label: "Retail", hint: "Sari-sari store, counts toward the account KPI" },
  { value: "WS", label: "Wholesale", hint: "Bulk buyer, counts toward the account KPI" },
];

const defaultValues: CustomerFormInput = {
  customerType: "HH",
  businessName: "",
  ownerName: "",
  contactNumber: "",
  municipalityId: "",
  barangay: "",
  address: "",
  landmark: "",
  notes: "",
};

interface CustomerFormDialogProps {
  municipalities: MunicipalityOption[];
  defaultMunicipalityId?: string;
  trigger?: React.ReactNode;
  onCreated?: (customer: { id: string; label: string } & CustomerFormInput) => void;
  /** Supplying this switches the dialog to edit mode for an existing customer. */
  editCustomer?: { id: string } & CustomerFormInput;
  onUpdated?: () => void;
  /** When true, a new customer queues to the offline store instead of failing if there's no signal (§9.3). */
  allowOffline?: boolean;
}

export function CustomerFormDialog({
  municipalities,
  defaultMunicipalityId,
  trigger,
  onCreated,
  editCustomer,
  onUpdated,
  allowOffline,
}: CustomerFormDialogProps) {
  const isEditing = !!editCustomer;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<SimilarCustomer[]>([]);
  const [acknowledgedDuplicates, setAcknowledgedDuplicates] = useState(isEditing);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: editCustomer ?? { ...defaultValues, municipalityId: defaultMunicipalityId ?? "" },
  });

  const customerType = watch("customerType");
  const businessName = watch("businessName");
  const ownerName = watch("ownerName");
  const municipalityId = watch("municipalityId");

  async function checkDuplicates() {
    if (isEditing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const name = businessName || ownerName || "";
    if (!name.trim() || !municipalityId) return;
    const matches = await findSimilarCustomers(name, municipalityId).catch(() => []);
    setDuplicates(matches);
    setAcknowledgedDuplicates(false);
  }

  const onSubmit = (data: CustomerFormInput) => {
    setServerError(null);
    const label = data.businessName || data.ownerName || "Customer";

    startTransition(async () => {
      if (!isEditing && allowOffline && typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineCustomer(data, label);
        return;
      }

      try {
        const result = isEditing
          ? await updateCustomer(editCustomer.id, data)
          : await createCustomer(data);

        if (result.error) {
          setServerError(result.error);
          return;
        }
        toast.success(isEditing ? `${label} updated.` : `${label} added.`);
        if (!isEditing && "data" in result && result.data) {
          onCreated?.({ ...data, id: result.data.id, label });
        }
        if (isEditing) {
          onUpdated?.();
        } else {
          reset({ ...defaultValues, municipalityId: defaultMunicipalityId ?? "" });
        }
        setDuplicates([]);
        setOpen(false);
      } catch (err) {
        // A network failure while "online" (flaky signal) falls back the
        // same way an already-offline submit does (§9.3).
        if (!isEditing && allowOffline) {
          await queueOfflineCustomer(data, label);
          return;
        }
        setServerError(err instanceof Error ? err.message : "Failed to save customer.");
      }
    });
  };

  async function queueOfflineCustomer(data: CustomerFormInput, label: string) {
    const id = crypto.randomUUID();
    await offlineDb.addPendingCustomer({
      id,
      businessName: data.businessName,
      ownerName: data.ownerName,
      contactNumber: data.contactNumber,
      customerType: data.customerType,
      municipalityId: data.municipalityId,
      barangay: data.barangay,
      address: data.address,
      landmark: data.landmark,
      notes: data.notes,
      status: "pending",
      queuedAt: new Date().toISOString(),
    });
    toast.success(`${label} saved offline — will sync when back online.`);
    onCreated?.({ ...data, id, label });
    reset({ ...defaultValues, municipalityId: defaultMunicipalityId ?? "" });
    setDuplicates([]);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset(editCustomer ?? { ...defaultValues, municipalityId: defaultMunicipalityId ?? "" });
          setServerError(null);
          setDuplicates([]);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <UserPlus /> New customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            RTL and WS accounts need a reachable owner, phone, and address —
            these are the accounts counted toward the 300-account KPI.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label>Customer type</Label>
            <Controller
              control={control}
              name="customerType"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {CUSTOMER_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => field.onChange(type.value)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-md border p-3 text-left text-sm transition-colors",
                        field.value === type.value
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      )}
                    >
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input id="businessName" {...register("businessName")} onBlur={checkDuplicates} />
              {errors.businessName ? (
                <p className="text-sm text-destructive">{errors.businessName.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ownerName">
                Owner name {customerType !== "HH" ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input id="ownerName" {...register("ownerName")} onBlur={checkDuplicates} />
              {errors.ownerName ? (
                <p className="text-sm text-destructive">{errors.ownerName.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactNumber">
                Contact number {customerType !== "HH" ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input id="contactNumber" {...register("contactNumber")} />
              {errors.contactNumber ? (
                <p className="text-sm text-destructive">{errors.contactNumber.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Municipality</Label>
              <Controller
                control={control}
                name="municipalityId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      checkDuplicates();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select municipality" />
                    </SelectTrigger>
                    <SelectContent>
                      {municipalities.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.municipalityId ? (
                <p className="text-sm text-destructive">{errors.municipalityId.message}</p>
              ) : null}
            </div>
          </div>

          {duplicates.length > 0 && !acknowledgedDuplicates ? (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>Possible duplicate in this municipality</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {duplicates.map((d) => (
                    <li key={d.id}>{d.business_name || d.owner_name}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setAcknowledgedDuplicates(true)}
                >
                  Not a duplicate, continue
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="barangay">Barangay</Label>
              <Input id="barangay" {...register("barangay")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input id="landmark" {...register("landmark")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">
              Address {customerType !== "HH" ? <span className="text-destructive">*</span> : null}
            </Label>
            <Textarea id="address" rows={2} {...register("address")} />
            {errors.address ? (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || (duplicates.length > 0 && !acknowledgedDuplicates)}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {isEditing ? "Save changes" : "Save customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
