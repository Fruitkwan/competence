"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, Users } from "lucide-react";
import { getDepartmentVisual } from "@/lib/department-icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { deleteDepartment, updateDepartment } from "@/lib/actions/departments";

export type DepartmentRow = {
  id: string;
  name: string;
  headName: string | null;
  memberCount: number;
};

export function DepartmentCard({ department }: { department: DepartmentRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(department.name);
  const visual = getDepartmentVisual(department.name);
  const DeptIcon = visual.icon;

  const openEdit = () => {
    setName(department.name);
    setEditOpen(true);
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Department name is required.");
      return;
    }

    startTransition(async () => {
      const result = await updateDepartment(department.id, name);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Department updated");
      setEditOpen(false);
      router.refresh();
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteDepartment(department.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Department deleted");
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className={cn("rounded-lg p-2", visual.bgClassName)}>
                <DeptIcon className={cn("h-4 w-4", visual.iconClassName)} />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold leading-snug">{department.name}</h4>
                {department.headName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Head: {department.headName}</p>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {department.memberCount}{" "}
                  {department.memberCount === 1 ? "member" : "members"}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={openEdit} title="Edit department">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteOpen(true)}
                title="Delete department"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>Edit department</DialogTitle>
              <DialogDescription>Update the department name.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={`dept-edit-${department.id}`}>Name *</Label>
              <Input
                id={`dept-edit-${department.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove <strong>{department.name}</strong>.
              {department.memberCount > 0 ? (
                <>
                  {" "}
                  This department has {department.memberCount} assigned user(s) — reassign them
                  before deleting.
                </>
              ) : (
                " This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending || department.memberCount > 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
