"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createTruckReport } from "@/app/actions/truck-reports";
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

export function NewTruckReportDialog({ dsps }: { dsps: Option[] }) {
  const [open, setOpen] = useState(false);
  const [dspId, setDspId] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [cratesOut, setCratesOut] = useState(0);
  const [cratesReturned, setCratesReturned] = useState(0);
  const [emptyCratesCollected, setEmptyCratesCollected] = useState(0);
  const [fuelCost, setFuelCost] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await createTruckReport({
        reportDate: new Date().toISOString().slice(0, 10),
        truckPlate,
        driverName,
        dspId: dspId || undefined,
        destinationMunicipalityIds: [],
        cratesOut,
        cratesReturned,
        emptyCratesCollected,
        stovesOut: 0,
        stovesReturned: 0,
        fuelCost,
        remarks,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Truck report saved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New truck report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New truck report</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>DSP</Label>
              <Select value={dspId} onValueChange={setDspId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select DSP" />
                </SelectTrigger>
                <SelectContent>
                  {dsps.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Truck plate</Label>
              <Input value={truckPlate} onChange={(e) => setTruckPlate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Driver</Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Fuel cost</Label>
              <Input type="number" min={0} value={fuelCost} onChange={(e) => setFuelCost(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>Crates out</Label>
              <Input type="number" min={0} value={cratesOut} onChange={(e) => setCratesOut(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>Crates returned</Label>
              <Input type="number" min={0} value={cratesReturned} onChange={(e) => setCratesReturned(Number(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2 col-span-2">
              <Label>Empty crates collected</Label>
              <Input
                type="number"
                min={0}
                value={emptyCratesCollected}
                onChange={(e) => setEmptyCratesCollected(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Remarks</Label>
            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
