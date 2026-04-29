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
  GraduationCap,
  ClipboardList,
  LayoutDashboard,
  FileText,
  FileCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  divider?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/appraisals", label: "Appraisals", icon: ClipboardCheck },
  { href: "/appraisals/performance", label: "Performance Appraisal", icon: FileCheck2 },
  { href: "/roles", label: "Role Benchmark", icon: Briefcase },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/rollout", label: "Rollout Plan", icon: CalendarClock },
  { href: "/training/survey", label: "Training Survey", icon: ClipboardList, divider: true },
  { href: "/training/dashboard", label: "Training Dashboard", icon: LayoutDashboard },
  { href: "/training/setup-guide", label: "Forms Setup Guide", icon: FileText },
  { href: "/admin/audit", label: "Audit Log", icon: ShieldCheck, adminOnly: true },
];

export function AppNav({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="flex items-center gap-2 px-2 py-3">
        <GraduationCap className="h-6 w-6 text-primary" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Dhofar Global</div>
          <div className="text-[11px] text-muted-foreground">Training Matrix</div>
        </div>
      </div>
      {NAV.map((item) => {
        if (item.adminOnly && role !== "admin") return null;
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/appraisals" &&
            pathname.startsWith(item.href));
        return (
          <div key={item.href}>
            {item.divider && (
              <div className="mb-1 mt-3 border-t px-3 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Training
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
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
