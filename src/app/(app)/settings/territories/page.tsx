import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReassignMunicipalityDialog } from "./reassign-municipality-dialog";

export const metadata: Metadata = { title: "Territories" };

export default async function TerritoriesPage() {
  await requirePermission("settings.manage");

  const supabase = await createClient();
  const [{ data: municipalities }, { data: dsps }] = await Promise.all([
    supabase.from("municipalities").select("id, name, dsp_id").eq("active", true).order("name"),
    supabase.from("dsps").select("id, name").eq("active", true).order("name"),
  ]);

  const dspNameById = new Map((dsps ?? []).map((d) => [d.id, d.name]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Territories</h1>
        <p className="text-sm text-muted-foreground">
          Which DSP owns each municipality. Reassigning applies going forward
          only — historical sales keep the DSP they were made under (§5.7).
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="pt-6">
          <CardTitle className="text-base">17 municipalities</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Municipality</TableHead>
              <TableHead>DSP</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(municipalities ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>
                  {m.dsp_id ? (
                    <Badge variant="secondary">{dspNameById.get(m.dsp_id) ?? "—"}</Badge>
                  ) : (
                    <Badge variant="outline">Unassigned</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ReassignMunicipalityDialog
                    municipalityId={m.id}
                    municipalityName={m.name}
                    currentDspId={m.dsp_id}
                    dsps={dsps ?? []}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
