"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createObjective, updateObjective } from "@/lib/actions/objectives";
import { toast } from "sonner";

type KpiOption = { id: string; title: string; level: string };

type ObjectiveData = {
  id?: string;
  title: string;
  description: string | null;
  success_criteria: string | null;
  weight: number;
  kpi_id: string | null;
};

export function ObjectiveForm({
  cycleId,
  objective,
  kpis,
  onDone,
}: {
  cycleId: string;
  objective?: ObjectiveData;
  kpis: KpiOption[];
  onDone?: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    formData.set("cycle_id", cycleId);

    const result = objective?.id
      ? await updateObjective(objective.id, formData)
      : await createObjective(formData);

    setPending(false);

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(objective?.id ? "Objective updated" : "Objective created");
      onDone?.();
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Objective Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Improve customer satisfaction score by 15%"
              defaultValue={objective?.title ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the objective in detail…"
              defaultValue={objective?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="success_criteria">Success Criteria</Label>
            <Textarea
              id="success_criteria"
              name="success_criteria"
              placeholder="How will success be measured?"
              defaultValue={objective?.success_criteria ?? ""}
              rows={2}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (%)</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                min={0}
                max={100}
                step={5}
                defaultValue={objective?.weight ?? 20}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi_id">Link to KPI (optional)</Label>
              <Select name="kpi_id" defaultValue={objective?.kpi_id ?? "_none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a KPI…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No KPI linked</SelectItem>
                  {kpis.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      [{k.level.slice(0, 3).toUpperCase()}] {k.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {onDone && (
              <Button type="button" variant="ghost" onClick={onDone}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : objective?.id ? "Update" : "Add Objective"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
