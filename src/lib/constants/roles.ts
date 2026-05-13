/**
 * Role constants and permission helpers for Performance Hub.
 */

export const ROLES = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  ADMIN: "admin",
  EXECUTIVE: "executive",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** Display labels for roles */
export const ROLE_LABELS: Record<AppRole, string> = {
  employee: "Employee",
  manager: "Manager",
  admin: "HR / Admin",
  executive: "C-Level",
};

/** Cycle statuses in order */
export const CYCLE_STATUSES = [
  "draft",
  "objective_setting",
  "assessment",
  "calibration",
  "review",
  "closed",
] as const;

export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  draft: "Draft",
  objective_setting: "Objective Setting",
  assessment: "Assessment",
  calibration: "Calibration",
  review: "HR Review",
  closed: "Closed",
};

/** Objective statuses */
export const OBJECTIVE_STATUSES = [
  "draft",
  "submitted",
  "revision_requested",
  "approved",
  "rejected",
] as const;

export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  revision_requested: "Revision Requested",
  approved: "Approved",
  rejected: "Rejected",
};

/** Cycle types */
export const CYCLE_TYPES = [
  "annual",
  "bi_annual",
  "quarterly",
  "probation",
] as const;

export type CycleType = (typeof CYCLE_TYPES)[number];

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  annual: "Annual",
  bi_annual: "Bi-Annual",
  quarterly: "Quarterly",
  probation: "Probation",
};

/** KPI levels */
export const KPI_LEVELS = ["organization", "department", "team"] as const;
export type KpiLevel = (typeof KPI_LEVELS)[number];

/** Check if a role can perform a given action */
export function canManageCycles(role: string): boolean {
  return role === ROLES.ADMIN;
}

export function canManageKpis(role: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.EXECUTIVE;
}

export function canReviewObjectives(role: string): boolean {
  return role === ROLES.MANAGER || role === ROLES.ADMIN;
}

export function canViewAllData(role: string): boolean {
  return role === ROLES.ADMIN;
}

export function canViewTeamData(role: string): boolean {
  return role === ROLES.MANAGER || role === ROLES.ADMIN;
}

export function canViewAggregatesOnly(role: string): boolean {
  return role === ROLES.EXECUTIVE;
}
