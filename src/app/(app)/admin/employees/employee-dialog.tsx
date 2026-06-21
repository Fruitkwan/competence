"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { upsertEmployee, EmployeeInput } from "@/lib/actions/employees";

export function EmployeeDialog({
  initialData,
  trigger,
}: {
  initialData?: EmployeeInput;
  trigger?: React.ReactNode;
}) {
  const isEdit = !!initialData;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<EmployeeInput>(
    initialData || {
      employee_id: "",
      full_name: "",
      job_title: "",
      department: "",
      email: "",
      country_code: "",
      manager_name: "",
      active: true,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.full_name || !formData.job_title) {
      toast.error("Employee ID, Name, and Job Title are required.");
      return;
    }

    startTransition(async () => {
      const result = await upsertEmployee(formData, isEdit);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Employee updated" : "Employee added");
        setOpen(false);
        if (!isEdit) {
          // Reset form for new addition
          setFormData({
            employee_id: "",
            full_name: "",
            job_title: "",
            department: "",
            email: "",
            country_code: "",
            manager_name: "",
            active: true,
          });
        }
      }
    });
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update employee details here."
                : "Create a new employee record. ID must be unique."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employee_id">Employee ID *</Label>
              <Input
                id="employee_id"
                disabled={isEdit}
                value={formData.employee_id}
                onChange={(e) =>
                  setFormData({ ...formData, employee_id: e.target.value })
                }
                placeholder="e.g. DG123"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job_title">Job Title *</Label>
              <Input
                id="job_title"
                value={formData.job_title}
                onChange={(e) =>
                  setFormData({ ...formData, job_title: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department || ""}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="country_code">Country Code</Label>
                <Input
                  id="country_code"
                  value={formData.country_code || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, country_code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. AE"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manager_name">Manager Name</Label>
                <Input
                  id="manager_name"
                  value={formData.manager_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, manager_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(c) =>
                  setFormData({ ...formData, active: c === true })
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active Employee
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
    </>
  );
}
