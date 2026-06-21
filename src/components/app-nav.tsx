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

/**
 * Nav order follows how people work:
 * Dashboard → Performance cycle → People → Training → Notifications → Admin
 */
const NAV: NavItem[] = [
  // ── Everyone ──────────────────────────────────────────────────────────────
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    iconColor: "#3b82f6",
  },

  // ── Employee self-service ───────────────────────────────────────────────────
  {
    href: "/objectives",
    label: "My Objectives",
    icon: Target,
    iconColor: "#10b981",
    roles: ["employee"],
  },
  {
    href: "/appraisals/performance",
    label: "My Performance",
    icon: FileCheck2,
    iconColor: "#6366f1",
    roles: ["employee"],
  },
  {
    href: "/training/my-courses",
    label: "My Courses",
    icon: BookOpen,
    iconColor: "#f59e0b",
    roles: ["employee"],
  },
  {
    href: "/training/request",
    label: "Training Request",
    icon: ClipboardList,
    iconColor: "#8b5cf6",
    roles: ["employee"],
  },

  // ── Performance cycle (manager / HR / executive) ────────────────────────────
  {
    href: "/appraisals/hr-dashboard",
    label: "HR Dashboard",
    icon: LayoutDashboard,
    iconColor: "#3b82f6",
    divider: true,
    dividerLabel: "Performance",
    roles: ["admin"],
  },
  {
    href: "/cycles",
    label: "Cycles",
    icon: CalendarClock,
    iconColor: "#f97316",
    divider: true,
    dividerLabel: "Performance",
    roles: ["manager", "executive"],
  },
  {
    href: "/cycles",
    label: "Cycles",
    icon: CalendarClock,
    iconColor: "#f97316",
    roles: ["admin"],
  },
  {
    href: "/objectives/review",
    label: "Review Objectives",
    icon: Target,
    iconColor: "#06b6d4",
    roles: ["admin", "manager"],
  },
  {
    href: "/appraisals",
    label: "Skills Appraisals",
    icon: ClipboardCheck,
    iconColor: "#a855f7",
    roles: ["admin", "manager", "executive"],
  },
  {
    href: "/appraisals/performance",
    label: "Performance Appraisals",
    icon: FileCheck2,
    iconColor: "#14b8a6",
    roles: ["admin", "manager", "executive"],
  },
  {
    href: "/rollout",
    label: "Rollout Plan",
    icon: CalendarClock,
    iconColor: "#0ea5e9",
    roles: ["admin", "manager"],
  },

  // ── People ──────────────────────────────────────────────────────────────────
  {
    href: "/employees",
    label: "Employee Directory",
    icon: Users,
    iconColor: "#ec4899",
    divider: true,
    dividerLabel: "People",
    roles: ["manager", "executive"],
  },
  {
    href: "/admin/employees",
    label: "Employee Directory",
    icon: Users,
    iconColor: "#ec4899",
    divider: true,
    dividerLabel: "People",
    roles: ["admin"],
  },
  {
    href: "/roles",
    label: "Role Benchmark",
    icon: Briefcase,
    iconColor: "#f43f5e",
    roles: ["admin", "manager", "executive"],
  },

  // ── Training & development ──────────────────────────────────────────────────
  {
    href: "/courses",
    label: "Course Catalog",
    icon: BookOpen,
    iconColor: "#eab308",
    divider: true,
    dividerLabel: "Training",
    roles: ["admin", "manager", "executive"],
  },
  {
    href: "/training/assign",
    label: "Assign Courses",
    icon: UserPlus,
    iconColor: "#84cc16",
    roles: ["admin", "manager"],
  },
  {
    href: "/training/dashboard",
    label: "Training Dashboard",
    icon: LayoutDashboard,
    iconColor: "#60a5fa",
    roles: ["admin", "manager"],
  },
  {
    href: "/training/survey/results",
    label: "Survey Results",
    icon: ClipboardList,
    iconColor: "#d946ef",
    roles: ["admin", "manager"],
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    iconColor: "#fbbf24",
    divider: true,
    dividerLabel: "Inbox",
  },

  // ── Administration (HR admin only) ──────────────────────────────────────────
  {
    href: "/admin/users",
    label: "User Management",
    icon: UserCog,
    iconColor: "#ef4444",
    divider: true,
    dividerLabel: "Administration",
    roles: ["admin"],
  },
  {
    href: "/admin/employees/import",
    label: "Import Employees",
    icon: Upload,
    iconColor: "#14b8a6",
    roles: ["admin"],
  },
  {
    href: "/admin/departments",
    label: "Departments",
    icon: Building2,
    iconColor: "#818cf8",
    roles: ["admin"],
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: ShieldCheck,
    iconColor: "#64748b",
    roles: ["admin"],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;

  if (href === "/appraisals") {
    return (
      pathname.startsWith("/appraisals/") &&
      !pathname.startsWith("/appraisals/performance") &&
      !pathname.startsWith("/appraisals/hr-dashboard")
    );
  }
  if (href === "/appraisals/performance") {
    return pathname.startsWith("/appraisals/performance");
  }
  if (href === "/admin/employees") {
    return (
      pathname === "/admin/employees" ||
      (pathname.startsWith("/admin/employees/") &&
        !pathname.startsWith("/admin/employees/import"))
    );
  }
  return pathname.startsWith(`${href}/`);
}

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
        if (item.roles && !item.roles.includes(role)) return null;

        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <div key={`${item.href}-${item.roles?.join(",") ?? "all"}`}>
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
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: item.iconColor || "inherit" }}
              />
              <span>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
