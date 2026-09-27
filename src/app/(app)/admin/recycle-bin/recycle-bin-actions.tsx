"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { permanentlyDeleteItem, restoreDeletedItem } from "@/lib/actions/recycle-bin";
import type { RecyclableTable } from "@/lib/recycle-bin";

export function RecycleBinActions({ table, recordId, label }: { table: RecyclableTable; recordId: string; label: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const restore = () => {
    startTransition(async () => {
      const result = await restoreDeletedItem(table, recordId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} restored.`);
      router.refresh();
    });
  };

  const permanentlyDelete = () => {
    startTransition(async () => {
      const result = await permanentlyDeleteItem(table, recordId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} permanently deleted.`);
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={restore} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setConfirmOpen(true)} disabled={isPending} aria-label={`Permanently delete ${label}`}>
          <Trash2 className="text-destructive" />
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the record from the Recycle Bin and cannot be undone. Linked records may prevent permanent deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={permanentlyDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
