"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { reassignMunicipality } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
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

interface DspOption {
  id: string;
  name: string;
}

export function ReassignMunicipalityDialog({
  municipalityId,
  municipalityName,
  currentDspId,
  dsps,
}: {
  municipalityId: string;
  municipalityName: string;
  currentDspId: string | null;
  dsps: DspOption[];
}) {
  const [open, setOpen] = useState(false);
  const [dspId, setDspId] = useState(currentDspId ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!dspId || dspId === currentDspId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await reassignMunicipality(municipalityId, dspId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${municipalityName} reassigned.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign {municipalityName}</DialogTitle>
          <DialogDescription>
            This applies going forward only — it does not rewrite history.
            Sales already recorded keep the DSP they were made under (§5.7).
          </DialogDescription>
        </DialogHeader>
        <Select value={dspId} onValueChange={setDspId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a DSP" />
          </SelectTrigger>
          <SelectContent>
            {dsps.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Confirm reassignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
