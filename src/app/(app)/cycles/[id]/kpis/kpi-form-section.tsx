"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { KPI_LEVELS, type KpiLevel } from "@/lib/constants/roles";

export function KpiFormSection({
  cycleId,
  departments,
}: {
  cycleId: string;
  departments: { id: string; name: string }[];
}) {
  const [level, setLevel] = useState<KpiLevel>("organization");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const weight = parseFloat(formData.get("weight") as string) || 0;
      const targetValue = formData.get("target_value") as string;
      const deptId = formData.get("department_id") as string;

      if (!title) {
        toast.error("Title is required");
        return;
      }

      const { error } = await supabase.from("org_kpis").insert({
        cycle_id: cycleId,
        title,
        description: description || null,
        level,
        department_id: level === "department" && deptId ? deptId : null,
        weight,
        target_value: targetValue || null,
        created_by: user?.id ?? null,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("KPI added");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add KPI</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="kpi-title">Title *</Label>
            <Input id="kpi-title" name="title" placeholder="e.g. Revenue Growth" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kpi-desc">Description</Label>
            <Textarea id="kpi-desc" name="description" rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as KpiLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KPI_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {level === "department" && (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select name="department_id">
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="kpi-weight">Weight (%)</Label>
              <Input id="kpi-weight" name="weight" type="number" min={0} max={100} defaultValue={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-target">Target</Label>
              <Input id="kpi-target" name="target_value" placeholder="e.g. 15%" />
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Adding…" : "Add KPI"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
