"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setUserActive, updateUser } from "@/lib/actions/users";
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/constants/roles";

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  job_title: string | null;
  department_id: string | null;
  country_code: string | null;
  manager_id: string | null;
  employee_id: string | null;
  is_active: boolean;
};

type Option = { id: string; name: string };

const NONE = "__none__";

export function UserActions({
  user,
  departments,
  managers,
  isSelf,
}: {
  user: UserRow;
  departments: Option[];
  managers: Option[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    role: user.role as AppRole,
    job_title: user.job_title ?? "",
    department_id: user.department_id ?? NONE,
    country_code: user.country_code ?? "",
    manager_id: user.manager_id ?? NONE,
    employee_id: user.employee_id ?? "",
  });

  const run = (fn: () => Promise<{ error: string | null }>, ok: string, onSuccess?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(ok);
        onSuccess?.();
        router.refresh();
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Actions for ${user.full_name ?? user.email}`} />}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" /> Edit
          </DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem
              onClick={() => run(() => setUserActive(user.id, !user.is_active), user.is_active ? "User deactivated." : "User activated.")}
            >
              {user.is_active ? (
                <><UserX className="mr-2 size-4" /> Deactivate</>
              ) : (
                <><UserCheck className="mr-2 size-4" /> Activate</>
              )}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  updateUser(user.id, {
                    full_name: form.full_name,
                    role: form.role,
                    job_title: form.job_title || null,
                    department_id: form.department_id === NONE ? null : form.department_id,
                    country_code: form.country_code || null,
                    manager_id: form.manager_id === NONE ? null : form.manager_id,
                    employee_id: form.employee_id || null,
                  }),
                "User updated.",
                () => setEditOpen(false)
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="u-name">Full name</Label>
                <Input id="u-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-role">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger id="u-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ROLES).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="u-title">Job title</Label>
                  <Input id="u-title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="u-country">Country</Label>
                  <Input id="u-country" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} placeholder="AE" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-dept">Department</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: String(v ?? NONE) })}>
                  <SelectTrigger id="u-dept" className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-manager">Manager</Label>
                <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: String(v ?? NONE) })}>
                  <SelectTrigger id="u-manager" className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-emp">Employee ID</Label>
                <Input id="u-emp" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Links this login to an employee record" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
