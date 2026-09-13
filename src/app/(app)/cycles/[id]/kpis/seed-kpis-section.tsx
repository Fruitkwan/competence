"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { seedCycleKpisFromRoleTemplates } from "@/lib/actions/kpis";

type RoleOption = {
  title: string;
  department: string;
  template_count: number;
};

export function SeedKpisSection({
  cycleId,
  roles,
}: {
  cycleId: string;
  roles: RoleOption[];
}) {
  const router = useRouter();
  const [roleTitle, setRoleTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSeed() {
    if (!roleTitle) {
      toast.error("Select a role first.");
      return;
    }

    const formData = new FormData();
    formData.set("role_title", roleTitle);

    startTransition(async () => {
      const result = await seedCycleKpisFromRoleTemplates(cycleId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Seeded ${result.inserted} KPI templates.`);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seed From Role Templates</CardTitle>
        <CardDescription>
          Pull KPI templates imported from the role competency workbook into this cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={roleTitle} onValueChange={(value) => setRoleTitle(value ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select role template" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.title} value={role.title}>
                  {role.title} ({role.template_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" disabled={isPending || roles.length === 0} onClick={handleSeed} className="w-full">
          {isPending ? "Seeding..." : "Seed KPIs"}
        </Button>
      </CardContent>
    </Card>
  );
}
