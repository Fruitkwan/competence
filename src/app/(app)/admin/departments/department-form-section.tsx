"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createDepartment } from "@/lib/actions/departments";

export function DepartmentFormSection() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");

    startTransition(async () => {
      const result = await createDepartment(name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Department created");
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Department</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name *</Label>
            <Input id="dept-name" name="name" placeholder="e.g. Engineering" required />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
