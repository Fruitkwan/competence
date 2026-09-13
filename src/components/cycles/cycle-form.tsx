"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCycle, updateCycle } from "@/lib/actions/cycles";
import { CYCLE_TYPES, CYCLE_TYPE_LABELS, type CycleType } from "@/lib/constants/roles";

type CycleData = {
  id?: string;
  name: string;
  type: CycleType;
  start_date: string;
  end_date: string;
  objective_deadline: string | null;
  self_assessment_deadline: string | null;
  manager_assessment_deadline: string | null;
  calibration_deadline: string | null;
};

type State = { error?: string; id?: string; success?: boolean } | null;

async function formAction(prev: State, formData: FormData): Promise<State> {
  const id = formData.get("_cycle_id") as string;
  if (id) {
    return await updateCycle(id, formData);
  }
  return await createCycle(formData);
}

export function CycleForm({
  cycle,
  onSuccess,
}: {
  cycle?: CycleData;
  onSuccess?: () => void;
}) {
  const [state, action, isPending] = useActionState(formAction, null);

  if (state?.id || state?.success) {
    onSuccess?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cycle?.id ? "Edit Cycle" : "Create Appraisal Cycle"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {cycle?.id && <input type="hidden" name="_cycle_id" value={cycle.id} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Cycle Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. H1 2026"
                defaultValue={cycle?.name ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={cycle?.type ?? "bi_annual"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CYCLE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={cycle?.start_date ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date *</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={cycle?.end_date ?? ""}
                required
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
              Phase Deadlines
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="objective_deadline">Objective Submission</Label>
                <Input
                  id="objective_deadline"
                  name="objective_deadline"
                  type="date"
                  defaultValue={cycle?.objective_deadline ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="self_assessment_deadline">Self-Assessment</Label>
                <Input
                  id="self_assessment_deadline"
                  name="self_assessment_deadline"
                  type="date"
                  defaultValue={cycle?.self_assessment_deadline ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager_assessment_deadline">Manager Assessment</Label>
                <Input
                  id="manager_assessment_deadline"
                  name="manager_assessment_deadline"
                  type="date"
                  defaultValue={cycle?.manager_assessment_deadline ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calibration_deadline">Calibration</Label>
                <Input
                  id="calibration_deadline"
                  name="calibration_deadline"
                  type="date"
                  defaultValue={cycle?.calibration_deadline ?? ""}
                />
              </div>
            </div>
          </div>

          {state?.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {state.error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : cycle?.id ? "Update Cycle" : "Create Cycle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
