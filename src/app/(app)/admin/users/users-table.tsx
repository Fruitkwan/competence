"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, type AppRole } from "@/lib/constants/roles";
import { UserActions, type UserRow } from "./user-actions";

const EM_DASH = "\u2014";

export type UserManagementRow = UserRow & {
  display_job_title: string | null;
  display_department: string | null;
  display_country: string | null;
  display_manager: string | null;
};

type Option = { id: string; name: string };

const ROLE_BADGE_COLOR: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  employee: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  executive: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export function UsersTable({
  users,
  departments,
  managers,
  currentUserId,
}: {
  users: UserManagementRow[];
  departments: Option[];
  managers: Option[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [manager, setManager] = useState("all");

  const departmentNames = useMemo(
    () => [...new Set(users.map((user) => user.display_department).filter((value): value is string => Boolean(value)))].sort(),
    [users]
  );
  const managerNames = useMemo(
    () => [...new Set(users.map((user) => user.display_manager).filter((value): value is string => Boolean(value)))].sort(),
    [users]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !needle ||
        [user.full_name, user.email, user.employee_id, user.display_job_title]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      return (
        matchesQuery &&
        (role === "all" || user.role === role) &&
        (department === "all" || user.display_department === department) &&
        (manager === "all" || (manager === "none" ? !user.display_manager : user.display_manager === manager)) &&
        (status === "all" ||
          (status === "active" && user.is_active !== false) ||
          (status === "inactive" && user.is_active === false) ||
          (status === "unlinked" && !user.employee_id))
      );
    });
  }, [users, query, role, department, manager, status]);

  const hasFilters = Boolean(query) || role !== "all" || department !== "all" || status !== "all" || manager !== "all";
  const clearFilters = () => {
    setQuery("");
    setRole("all");
    setDepartment("all");
    setStatus("all");
    setManager("all");
  };

  const stats = [
    ["Total users", users.length],
    ["Active", users.filter((user) => user.is_active !== false).length],
    ["Inactive", users.filter((user) => user.is_active === false).length],
    ["Unlinked", users.filter((user) => !user.employee_id).length],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, employee ID or title…"
            className="pl-8"
          />
        </div>
        <Select value={role} onValueChange={(value) => setRole(String(value ?? "all"))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={(value) => setDepartment(String(value ?? "all"))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departmentNames.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(String(value ?? "all"))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="unlinked">Unlinked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={manager} onValueChange={(value) => setManager(String(value ?? "all"))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Manager" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All managers</SelectItem>
            <SelectItem value="none">No manager</SelectItem>
            {managerNames.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Showing {filtered.length} of {users.length}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Job title</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-left font-medium">Country</th>
                  <th className="px-4 py-3 text-left font-medium">Manager</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="font-medium">No users match these filters</div>
                      <button type="button" className="mt-1 text-sm text-primary hover:underline" onClick={clearFilters}>Clear filters</button>
                    </td>
                  </tr>
                ) : filtered.map((user) => (
                  <tr key={user.id} className="border-b transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {user.full_name ?? EM_DASH}
                      {user.employee_id && <span className="ml-1.5 text-xs text-muted-foreground">#{user.employee_id}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`border-0 ${ROLE_BADGE_COLOR[user.role] ?? ""}`}>
                        {ROLE_LABELS[user.role as AppRole] ?? user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.display_job_title ?? EM_DASH}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.display_department ?? EM_DASH}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.display_country ?? EM_DASH}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.display_manager ?? EM_DASH}</td>
                    <td className="px-4 py-3">
                      {user.is_active !== false ? <span className="text-emerald-600">Active</span> : <span className="text-muted-foreground">Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActions user={user} departments={departments} managers={managers.filter((option) => option.id !== user.id)} isSelf={user.id === currentUserId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
