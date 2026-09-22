export type OrgAssessment = {
  id: string;
  name: string;
  wave: string | null;
  score: number | null;
  provisional: boolean;
  raters: string[] | null;
};

export type OrgEmployee = {
  employee_id: string;
  full_name: string;
  job_title: string;
  department: string | null;
  country_code: string | null;
  manager_name: string | null;
  assessments?: OrgAssessment[];
};

export type OrgNode = OrgEmployee & {
  parent_id: string | null;
  placeholder: boolean;
  direct_reports: number;
  total_reports: number;
};

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstAndLast(value: string) {
  const parts = normalizeName(value).split(" ").filter(Boolean);
  return parts.length ? `${parts[0]} ${parts.at(-1)}` : "";
}

export function buildOrganizationChart(employees: OrgEmployee[]) {
  const nodes = new Map<string, OrgNode>();
  const exact = new Map<string, OrgEmployee[]>();
  const loose = new Map<string, OrgEmployee[]>();

  for (const employee of employees) {
    nodes.set(employee.employee_id, { ...employee, parent_id: null, placeholder: false, direct_reports: 0, total_reports: 0 });
    const exactKey = normalizeName(employee.full_name);
    const looseKey = firstAndLast(employee.full_name);
    exact.set(exactKey, [...(exact.get(exactKey) ?? []), employee]);
    loose.set(looseKey, [...(loose.get(looseKey) ?? []), employee]);
  }

  const unresolved = new Map<string, string>();
  for (const employee of employees) {
    if (!employee.manager_name) continue;
    const exactMatches = exact.get(normalizeName(employee.manager_name)) ?? [];
    const looseMatches = loose.get(firstAndLast(employee.manager_name)) ?? [];
    const manager = exactMatches.length === 1 ? exactMatches[0] : looseMatches.length === 1 ? looseMatches[0] : null;
    if (manager && manager.employee_id !== employee.employee_id) {
      nodes.get(employee.employee_id)!.parent_id = manager.employee_id;
      continue;
    }
    if (normalizeName(employee.manager_name) === normalizeName(employee.full_name)) continue;

    const managerKey = normalizeName(employee.manager_name);
    let placeholderId = unresolved.get(managerKey);
    if (!placeholderId) {
      placeholderId = `manager:${managerKey}`;
      unresolved.set(managerKey, placeholderId);
      nodes.set(placeholderId, {
        employee_id: placeholderId,
        full_name: employee.manager_name,
        job_title: "Manager not in employee directory",
        department: null,
        country_code: null,
        manager_name: null,
        parent_id: null,
        placeholder: true,
        direct_reports: 0,
        total_reports: 0,
      });
    }
    nodes.get(employee.employee_id)!.parent_id = placeholderId;
  }

  // Detach the first repeated node in any malformed reporting cycle.
  for (const node of nodes.values()) {
    const path = new Set<string>([node.employee_id]);
    let cursor = node;
    while (cursor.parent_id) {
      if (path.has(cursor.parent_id)) {
        cursor.parent_id = null;
        break;
      }
      path.add(cursor.parent_id);
      const parent = nodes.get(cursor.parent_id);
      if (!parent) break;
      cursor = parent;
    }
  }

  const children = new Map<string | null, string[]>();
  for (const node of nodes.values()) {
    const siblings = children.get(node.parent_id) ?? [];
    siblings.push(node.employee_id);
    children.set(node.parent_id, siblings);
  }
  for (const ids of children.values()) {
    ids.sort((a, b) => nodes.get(a)!.full_name.localeCompare(nodes.get(b)!.full_name));
  }

  function countReports(id: string, visited = new Set<string>()): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const direct = children.get(id) ?? [];
    return direct.reduce((total, childId) => total + 1 + countReports(childId, new Set(visited)), 0);
  }

  for (const node of nodes.values()) {
    node.direct_reports = (children.get(node.employee_id) ?? []).length;
    node.total_reports = countReports(node.employee_id);
  }

  return {
    nodes: [...nodes.values()],
    roots: children.get(null) ?? [],
    unresolvedManagers: unresolved.size,
  };
}
