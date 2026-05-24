"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Users,
  ClipboardCheck,
  Briefcase,
  BookOpen,
  CalendarClock,
  ShieldCheck,
  ClipboardList,
  LayoutDashboard,
  FileCheck2,
  UserPlus,
  Target,
  Building2,
  UserCog,
  Bell,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor?: string;
  /** Which roles can see this item. Omit = visible to all. */
  roles?: string[];
  divider?: boolean;
  dividerLabel?: string;
};

const NAV: NavItem[] = [
  // Everyone sees dashboard
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, iconColor: "#3b82f6" }, // blue-500

  // Employee sees own objectives + performance + courses + training feedback
  { href: "/objectives", label: "My Objectives", icon: Target, iconColor: "#10b981", roles: ["employee"] }, // emerald-500
  { href: "/appraisals/performance", label: "My Performance", icon: FileCheck2, iconColor: "#6366f1", roles: ["employee"] }, // indigo-500
  { href: "/training/my-courses", label: "My Courses", icon: BookOpen, iconColor: "#f59e0b", roles: ["employee"] }, // amber-500
  { href: "/training/survey", label: "Training Feedback", icon: ClipboardList, iconColor: "#8b5cf6", roles: ["employee"] }, // violet-500

  // Manager + Admin + Executive — Cycle & Objective management
  { href: "/cycles", label: "Cycles", icon: CalendarClock, iconColor: "#f97316", divider: true, dividerLabel: "Performance", roles: ["admin", "manager", "executive"] }, // orange-500
  { href: "/objectives/review", label: "Review Objectives", icon: Target, iconColor: "#06b6d4", roles: ["admin", "manager"] }, // cyan-500
  { href: "/employees", label: "Employees", icon: Users, iconColor: "#ec4899", roles: ["admin", "manager", "executive"] }, // pink-500
  { href: "/appraisals", label: "Appraisals", icon: ClipboardCheck, iconColor: "#a855f7", roles: ["admin", "manager", "executive"] }, // purple-500
  { href: "/appraisals/performance", label: "Performance Appraisal", icon: FileCheck2, iconColor: "#14b8a6", roles: ["admin", "manager", "executive"] }, // teal-500
  { href: "/appraisals/hr-dashboard", label: "HR Dashboard", icon: LayoutDashboard, iconColor: "#3b82f6", roles: ["admin"] }, // blue-500
  { href: "/admin/employees", label: "Employee Management", icon: Users, iconColor: "#f43f5e", roles: ["admin"] }, // rose-500
  { href: "/roles", label: "Role Benchmark", icon: Briefcase, iconColor: "#f43f5e", roles: ["admin", "manager", "executive"] }, // rose-500
  { href: "/courses", label: "Courses", icon: BookOpen, iconColor: "#eab308", roles: ["admin", "manager", "executive"] }, // yellow-500
  { href: "/rollout", label: "Rollout Plan", icon: CalendarClock, iconColor: "#0ea5e9", roles: ["admin", "manager"] }, // sky-500

  // Training section — manager + admin
  { href: "/training/assign", label: "Assign Courses", icon: UserPlus, iconColor: "#84cc16", divider: true, dividerLabel: "Training", roles: ["admin", "manager"] }, // lime-500
  { href: "/training/survey", label: "Training Survey", icon: ClipboardList, iconColor: "#d946ef", roles: ["admin", "manager"] }, // fuchsia-500
  { href: "/training/dashboard", label: "Training Dashboard", icon: LayoutDashboard, iconColor: "#60a5fa", roles: ["admin", "manager"] }, // blue-400


  // Notifications — everyone
  { href: "/notifications", label: "Notifications", icon: Bell, iconColor: "#fbbf24", divider: true, dividerLabel: "Notifications" }, // amber-400

  // Admin only
  { href: "/admin/users", label: "User Management", icon: UserCog, iconColor: "#ef4444", divider: true, dividerLabel: "Administration", roles: ["admin"] }, // red-500
  { href: "/admin/employees/import", label: "Import Employees", icon: Upload, iconColor: "#14b8a6", roles: ["admin"] }, // teal-500
  { href: "/admin/departments", label: "Departments", icon: Building2, iconColor: "#818cf8", roles: ["admin"] }, // indigo-400
  { href: "/admin/audit", label: "Audit Log", icon: ShieldCheck, iconColor: "#64748b", roles: ["admin"] }, // slate-500
];

export function AppNav({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="flex items-center gap-2 px-2 py-3">
        <Image src="/logo.jpg" alt="Dhofar Global" width={28} height={28} />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Dhofar Global</div>
          <div className="text-[11px] text-muted-foreground">Performance Hub</div>
        </div>
      </div>
      {NAV.map((item) => {
        // Role-gating: if roles array is defined, user must match one
        if (item.roles && !item.roles.includes(role)) return null;

        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/appraisals" &&
            pathname.startsWith(item.href));
        return (
          <div key={item.href + (item.roles?.join() ?? "")}>
            {item.divider && (
              <div className="mb-1 mt-3 border-t px-3 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {item.dividerLabel ?? ""}
              </div>
            )}
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" style={{ color: item.iconColor || 'inherit' }} />
              <span>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
