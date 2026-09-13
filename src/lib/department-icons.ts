import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  Building2,
  Code2,
  Factory,
  Globe2,
  Headphones,
  HeartHandshake,
  Megaphone,
  Package,
  Scale,
  ShoppingBag,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export type DepartmentVisual = {
  icon: LucideIcon;
  iconClassName: string;
  bgClassName: string;
};

const RULES: Array<{ keywords: string[]; visual: DepartmentVisual }> = [
  {
    keywords: ["finance", "accounting", "treasury", "audit"],
    visual: {
      icon: Banknote,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      bgClassName: "bg-emerald-50 dark:bg-emerald-950/40",
    },
  },
  {
    keywords: ["human resource", "hr", "people", "talent"],
    visual: {
      icon: HeartHandshake,
      iconClassName: "text-rose-600 dark:text-rose-400",
      bgClassName: "bg-rose-50 dark:bg-rose-950/40",
    },
  },
  {
    keywords: ["engineer", "technology", "tech", "it", "software", "digital"],
    visual: {
      icon: Code2,
      iconClassName: "text-indigo-600 dark:text-indigo-400",
      bgClassName: "bg-indigo-50 dark:bg-indigo-950/40",
    },
  },
  {
    keywords: ["market", "brand", "communication"],
    visual: {
      icon: Megaphone,
      iconClassName: "text-fuchsia-600 dark:text-fuchsia-400",
      bgClassName: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    },
  },
  {
    keywords: ["sales", "commercial", "business development", "retail"],
    visual: {
      icon: ShoppingBag,
      iconClassName: "text-amber-600 dark:text-amber-400",
      bgClassName: "bg-amber-50 dark:bg-amber-950/40",
    },
  },
  {
    keywords: ["operation", "supply", "logistics", "warehouse", "procurement"],
    visual: {
      icon: Factory,
      iconClassName: "text-sky-600 dark:text-sky-400",
      bgClassName: "bg-sky-50 dark:bg-sky-950/40",
    },
  },
  {
    keywords: ["legal", "compliance", "regulatory"],
    visual: {
      icon: Scale,
      iconClassName: "text-slate-600 dark:text-slate-400",
      bgClassName: "bg-slate-100 dark:bg-slate-900/40",
    },
  },
  {
    keywords: ["customer", "support", "service", "call center"],
    visual: {
      icon: Headphones,
      iconClassName: "text-cyan-600 dark:text-cyan-400",
      bgClassName: "bg-cyan-50 dark:bg-cyan-950/40",
    },
  },
  {
    keywords: ["delivery", "fleet", "transport", "distribution"],
    visual: {
      icon: Truck,
      iconClassName: "text-orange-600 dark:text-orange-400",
      bgClassName: "bg-orange-50 dark:bg-orange-950/40",
    },
  },
  {
    keywords: ["product", "innovation", "r&d", "research"],
    visual: {
      icon: Wrench,
      iconClassName: "text-violet-600 dark:text-violet-400",
      bgClassName: "bg-violet-50 dark:bg-violet-950/40",
    },
  },
  {
    keywords: ["international", "global", "export", "country"],
    visual: {
      icon: Globe2,
      iconClassName: "text-teal-600 dark:text-teal-400",
      bgClassName: "bg-teal-50 dark:bg-teal-950/40",
    },
  },
  {
    keywords: ["admin", "general", "corporate", "executive", "management"],
    visual: {
      icon: Briefcase,
      iconClassName: "text-blue-600 dark:text-blue-400",
      bgClassName: "bg-blue-50 dark:bg-blue-950/40",
    },
  },
];

const FALLBACK_VISUALS: DepartmentVisual[] = [
  {
    icon: Building2,
    iconClassName: "text-indigo-600 dark:text-indigo-400",
    bgClassName: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  {
    icon: Users,
    iconClassName: "text-rose-600 dark:text-rose-400",
    bgClassName: "bg-rose-50 dark:bg-rose-950/40",
  },
  {
    icon: Package,
    iconClassName: "text-amber-600 dark:text-amber-400",
    bgClassName: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    icon: Globe2,
    iconClassName: "text-teal-600 dark:text-teal-400",
    bgClassName: "bg-teal-50 dark:bg-teal-950/40",
  },
  {
    icon: Briefcase,
    iconClassName: "text-blue-600 dark:text-blue-400",
    bgClassName: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    icon: Factory,
    iconClassName: "text-sky-600 dark:text-sky-400",
    bgClassName: "bg-sky-50 dark:bg-sky-950/40",
  },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDepartmentVisual(name: string): DepartmentVisual {
  const normalized = name.toLowerCase().trim();

  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.visual;
    }
  }

  return FALLBACK_VISUALS[hashName(normalized) % FALLBACK_VISUALS.length];
}
