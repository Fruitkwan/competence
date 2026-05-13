"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DepartmentFormSection() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const name = formData.get("name") as string;
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("departments").insert({ name: name.trim() });
      if (error) {
        if (error.code === "23505") toast.error("Department already exists");
        else toast.error(error.message);
      } else {
        toast.success("Department created");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Department</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name *</Label>
            <Input id="dept-name" name="name" placeholder="e.g. Engineering" required />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Add Department"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
