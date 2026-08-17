"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerFormDialog, type MunicipalityOption } from "@/components/customer-form-dialog";
import type { Database } from "@/lib/supabase/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

export function EditCustomerButton({
  customer,
  municipalities,
}: {
  customer: Customer;
  municipalities: MunicipalityOption[];
}) {
  const router = useRouter();

  return (
    <CustomerFormDialog
      municipalities={municipalities}
      editCustomer={{
        id: customer.id,
        customerType: customer.customer_type,
        businessName: customer.business_name ?? "",
        ownerName: customer.owner_name ?? "",
        contactNumber: customer.contact_number ?? "",
        municipalityId: customer.municipality_id,
        barangay: customer.barangay ?? "",
        address: customer.address ?? "",
        landmark: customer.landmark ?? "",
        notes: customer.notes ?? "",
      }}
      onUpdated={() => router.refresh()}
      trigger={
        <Button variant="outline" size="sm">
          <Pencil /> Edit
        </Button>
      }
    />
  );
}
