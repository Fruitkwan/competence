const DEVELOP_CODE_LABELS: Record<string, string> = {
  K: "Knowledge",
  S: "Skill",
  B: "Behaviour",
  D: "Desire",
  A: "Attitude",
};

export function formatCourseDevelops(value: string | null | undefined) {
  if (!value) return "";

  const compact = value.replace(/[\s,;/|+-]+/g, "").toUpperCase();
  if (!compact) return "";

  const labels: string[] = [];
  for (const code of compact) {
    const label = DEVELOP_CODE_LABELS[code];
    if (label && !labels.includes(label)) labels.push(label);
  }

  return labels.length > 0 ? labels.join(", ") : value;
}
