import type { Band, ItemScore } from "@/lib/assessments/scoring";

export const BAND_COLOR: Record<Band, string> = {
  Strength: "#059669",
  "Meets standard": "#2563eb",
  "Development gap": "#d97706",
  "Material gap": "#dc2626",
};

export const GROUP_COLOR: Record<string, string[]> = {
  Behaviour: ["#4f46e5", "#6366f1", "#818cf8"],
  Desire: ["#db2777", "#f472b6"],
  Attitude: ["#d97706", "#fbbf24"],
};

export const STANDARD = 60;

export function bandOf(score: number | null): Band | null {
  if (score == null) return null;
  if (score >= 75) return "Strength";
  if (score >= 60) return "Meets standard";
  if (score >= 45) return "Development gap";
  return "Material gap";
}

export function indexText(v: number | null) {
  const b = bandOf(v);
  if (b === "Strength") return "Above the standard. Use this person to help train others.";
  if (b === "Meets standard") return "Meets the standard for the role. No targeted action required.";
  if (b === "Development gap") return "Below the standard. Include in the targeted training group.";
  if (b === "Material gap") return "Material gap. Priority for training with a specific development action.";
  return "Not enough inputs yet to compute an index.";
}

export function selfAwarenessText(items: ItemScore[]) {
  const gaps = items.map((i) => i.self_vs_rater_gap).filter((g): g is number => g != null);
  if (!gaps.length) return "Awaiting rater input for comparison.";
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean >= 1) return `Rates self ${mean.toFixed(1)} points above raters on average. Feedback conversation before training.`;
  if (mean <= -1) return `Rates self ${Math.abs(mean).toFixed(1)} points below raters on average. Likely under-confidence.`;
  return "Self-rating is broadly aligned with how others see the work.";
}

export function shortName(name: string) {
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
