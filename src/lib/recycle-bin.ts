export const RECYCLABLE_TABLES = [
  "employees",
  "assessment_assignments",
  "assessment_templates",
  "cycle_objectives",
  "employee_courses",
  "departments",
  "role_kpi_templates",
  "role_competencies",
] as const;

export type RecyclableTable = (typeof RECYCLABLE_TABLES)[number];

export function isRecyclableTable(value: string): value is RecyclableTable {
  return (RECYCLABLE_TABLES as readonly string[]).includes(value);
}
