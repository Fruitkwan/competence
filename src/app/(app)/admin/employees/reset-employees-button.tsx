"use client";

import { useState, useTransition } from "react";
import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { resetEmployeeData } from "@/lib/actions/employees";

export function ResetEmployeesButton({ employeeCount }: { employeeCount: number }) {
  const [open, setOpen] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);
  const [localEmployeeCount, setLocalEmployeeCount] = useState(employeeCount);
  const [isPending, startTransition] = useTransition();
  const hasEmployees = localEmployeeCount > 0;

  function reset() {
    if (!hasEmployees) return;

    startTransition(async () => {
      const result = await resetEmployeeData();
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!result.counts) {
        toast.success("Employee data reset.");
        setIsResetComplete(true);
        setLocalEmployeeCount(0);
        return;
      }

      toast.success(
        `Employee data reset. Removed ${result.counts.employees} employee record${result.counts.employees === 1 ? "" : "s"}.`
      );
      setIsResetComplete(true);
      setLocalEmployeeCount(0);
    });
  }

  if (!hasEmployees && !open) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        setOpen(nextOpen);
        if (nextOpen) setIsResetComplete(false);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="destructive" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
            Reset data
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isResetComplete
              ? "Employee data reset"
              : hasEmployees
                ? "Reset employee data?"
                : "No employee data to reset"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isResetComplete
              ? "The employee directory is now clear. Upload the employees Excel file to rebuild the directory."
              : hasEmployees
                ? `This will permanently clear ${localEmployeeCount} employee record${localEmployeeCount === 1 ? "" : "s"}, employee-linked appraisals, training assignments, import history, and profile employee links. Upload the employees Excel file after the reset to rebuild the directory.`
                : "There are already 0 employee records in the directory, so there is nothing to clear."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isResetComplete || !hasEmployees ? (
            <AlertDialogCancel>OK</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={reset} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Reset and clear
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
