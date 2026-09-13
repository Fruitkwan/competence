"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteEmployee } from "@/lib/actions/employees";
import { toast } from "sonner";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) {
      startTransition(async () => {
        const result = await deleteEmployee(id);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Employee deleted successfully");
        }
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={handleDelete}
      disabled={isPending}
      title="Delete Employee"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
