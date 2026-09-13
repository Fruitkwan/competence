export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type TemplateLike = { kind: string; job_titles: string[] };

/** Finds the published skill template whose job-title mapping covers this title. */
export function matchSkillTemplate<T extends TemplateLike>(jobTitle: string | null | undefined, templates: T[]): T | null {
  const title = normalizeName(jobTitle ?? "");
  if (!title) return null;
  return templates.find((t) => t.kind === "skill" && t.job_titles.some((jt) => normalizeName(jt) === title)) ?? null;
}
