/**
 * Scoring model from DG_Assessment_Scoring_Workbook.xlsx (Model sheet).
 * Missing inputs are excluded and the remaining weights re-scaled, so a
 * missing input lowers confidence rather than the score.
 */

export type AssessmentKind = "skill" | "behaviour";
export type RaterType = "self" | "line_manager" | "cross_dept" | "peer";
export type Band = "Strength" | "Meets standard" | "Development gap" | "Material gap";

export type ScoringModel = {
  weights: { self: number; line_manager: number; other: number; scenario: number };
  thresholds: { strength: number; meets: number; development: number };
  grid_cutoff: number;
  min_raters: number;
  divergence: number;
};

export const DEFAULT_SCORING: Record<AssessmentKind, ScoringModel> = {
  skill: {
    weights: { other: 0.4, line_manager: 0.2, scenario: 0.3, self: 0.1 },
    thresholds: { strength: 75, meets: 60, development: 45 },
    grid_cutoff: 60,
    min_raters: 3,
    divergence: 2,
  },
  behaviour: {
    weights: { other: 0.45, line_manager: 0.2, scenario: 0.25, self: 0.1 },
    thresholds: { strength: 75, meets: 60, development: 45 },
    grid_cutoff: 60,
    min_raters: 3,
    divergence: 2,
  },
};

export function resolveScoring(kind: AssessmentKind, stored: unknown): ScoringModel {
  const base = DEFAULT_SCORING[kind];
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<ScoringModel>;
  return {
    weights: { ...base.weights, ...(s.weights ?? {}) },
    thresholds: { ...base.thresholds, ...(s.thresholds ?? {}) },
    grid_cutoff: s.grid_cutoff ?? base.grid_cutoff,
    min_raters: s.min_raters ?? base.min_raters,
    divergence: s.divergence ?? base.divergence,
  };
}

export type ItemInput = {
  item_id: string;
  name: string;
  group_name: string | null;
  self: number | null;
  line_manager: number | null;
  /** Individual cross-dept (skill) or peer (behaviour) ratings, N/O excluded. */
  others: number[];
  /** true / false when the scenario was answered, null when not. */
  scenario_correct: boolean | null;
  /** Raters (excluding self) who marked this item "Not observed". */
  not_observed_count: number;
  /** Raters (excluding self) who submitted any answer for this item. */
  rater_count: number;
};

export type ItemScore = {
  item_id: string;
  name: string;
  group_name: string | null;
  score: number | null;
  band: Band | null;
  self: number | null;
  line_manager: number | null;
  others_avg: number | null;
  others_count: number;
  scenario_correct: boolean | null;
  self_vs_rater_gap: number | null;
  flag: string | null;
};

export type PersonScore = {
  kind: AssessmentKind;
  items: ItemScore[];
  /** Average of item scores (Skill index / Behaviour overall index). */
  index: number | null;
  /** Behaviour only: per-group averages. */
  groups: Record<string, number | null>;
  /** Behaviour only: mean of Desire and Attitude. */
  will_index: number | null;
  scenarios_correct: number;
  scenarios_answered: number;
  below_standard: number;
  material_gaps: number;
  /** Average number of rater responses per item (excluding self). */
  avg_raters: number;
  provisional: boolean;
  warnings: Warning[];
};

export type Warning = {
  code:
    | "self_awareness_gap"
    | "under_confident"
    | "manager_rater_divergence"
    | "reputation_ahead"
    | "invisible_work"
    | "stated_support"
    | "provisional";
  title: string;
  detail: string;
  items: string[];
};

const pct = (rating: number) => (rating - 1) / 4;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: number, dp = 0) => Math.round(x * 10 ** dp) / 10 ** dp;

export function bandFor(score: number, m: ScoringModel): Band {
  if (score >= m.thresholds.strength) return "Strength";
  if (score >= m.thresholds.meets) return "Meets standard";
  if (score >= m.thresholds.development) return "Development gap";
  return "Material gap";
}

export function scoreItem(input: ItemInput, m: ScoringModel): ItemScore {
  const othersAvg = avg(input.others);
  const parts: Array<[number, number | null]> = [
    [m.weights.other, othersAvg == null ? null : pct(othersAvg)],
    [m.weights.line_manager, input.line_manager == null ? null : pct(input.line_manager)],
    [m.weights.scenario, input.scenario_correct == null ? null : input.scenario_correct ? 1 : 0],
    [m.weights.self, input.self == null ? null : pct(input.self)],
  ];
  const present = parts.filter((p): p is [number, number] => p[1] != null);
  const weightSum = present.reduce((a, [w]) => a + w, 0);
  const score = weightSum > 0 ? round((present.reduce((a, [w, v]) => a + w * v, 0) / weightSum) * 100) : null;

  const raterValues = [input.line_manager, othersAvg].filter((v): v is number => v != null);
  const raterAvg = avg(raterValues);
  const gap = input.self != null && raterAvg != null ? round(input.self - raterAvg, 1) : null;

  let flag: string | null = null;
  if (gap != null && gap >= m.divergence) flag = "Self-awareness gap - conversation before training";
  else if (gap != null && gap <= -m.divergence) flag = "Under-confident - exposure, not training";
  else if (input.scenario_correct === false && (othersAvg ?? 0) >= 4) flag = "Reputation ahead of judgement";

  return {
    item_id: input.item_id,
    name: input.name,
    group_name: input.group_name,
    score,
    band: score == null ? null : bandFor(score, m),
    self: input.self,
    line_manager: input.line_manager,
    others_avg: othersAvg == null ? null : round(othersAvg, 1),
    others_count: input.others.length,
    scenario_correct: input.scenario_correct,
    self_vs_rater_gap: gap,
    flag,
  };
}

export function scorePerson(kind: AssessmentKind, inputs: ItemInput[], m: ScoringModel): PersonScore {
  const items = inputs.map((i) => scoreItem(i, m));
  const scored = items.filter((i): i is ItemScore & { score: number } => i.score != null);
  const index = scored.length ? round(avg(scored.map((i) => i.score)) ?? 0) : null;

  const groups: Record<string, number | null> = {};
  if (kind === "behaviour") {
    for (const g of ["Behaviour", "Desire", "Attitude"]) {
      const gs = scored.filter((i) => i.group_name === g).map((i) => i.score);
      groups[g] = gs.length ? round(avg(gs) ?? 0) : null;
    }
  }
  const will =
    kind === "behaviour" && groups.Desire != null && groups.Attitude != null
      ? round((groups.Desire + groups.Attitude) / 2)
      : null;

  const avgRaters = inputs.length ? round((avg(inputs.map((i) => i.rater_count)) ?? 0), 1) : 0;
  const provisional = avgRaters < m.min_raters;

  const warnings: Warning[] = [];
  const push = (code: Warning["code"], title: string, detail: string, names: string[]) =>
    names.length && warnings.push({ code, title, detail, items: names });

  push(
    "self_awareness_gap",
    "Self-awareness gap",
    `Rates self ${m.divergence}+ points above raters. Hold a structured feedback conversation before any technical training.`,
    items.filter((i) => i.flag?.startsWith("Self-awareness")).map((i) => i.name)
  );
  push(
    "under_confident",
    "Under-confidence",
    `Raters score ${m.divergence}+ points above self-rating. Respond with exposure and stretch work, not remedial training.`,
    items.filter((i) => i.flag?.startsWith("Under-confident")).map((i) => i.name)
  );
  push(
    "manager_rater_divergence",
    "Manager vs rater divergence",
    `Line manager and ${kind === "skill" ? "cross-departmental" : "peer"} ratings differ by ${m.divergence}+ points. Refer to the calibration panel.`,
    items
      .filter((i) => i.line_manager != null && i.others_avg != null && Math.abs(i.line_manager - i.others_avg) >= m.divergence)
      .map((i) => i.name)
  );
  push(
    "reputation_ahead",
    "Reputation ahead of judgement",
    "High rater score combined with a failed scenario check. Worth a closer look.",
    items.filter((i) => i.flag === "Reputation ahead of judgement").map((i) => i.name)
  );
  push(
    "invisible_work",
    "Work invisible to raters",
    'More than half of raters answered "Not observed". Report as an organisational finding, not an individual one.',
    inputs.filter((i) => i.rater_count > 0 && i.not_observed_count > i.rater_count / 2).map((i) => i.name)
  );
  if (kind === "behaviour") {
    push(
      "stated_support",
      "Stated support without behavioural change",
      "High Response to Change rating combined with the socially comfortable scenario answer. Follow up closely during the transition.",
      items
        .filter((i) => /Response to Change/i.test(i.name) && i.scenario_correct === false && (i.self ?? 0) >= 4)
        .map((i) => i.name)
    );
  }
  if (provisional) {
    warnings.push({
      code: "provisional",
      title: "Provisional result",
      detail: `Fewer than ${m.min_raters} usable rater responses per item on average (${avgRaters}). Treat scores as indicative until more raters submit.`,
      items: [],
    });
  }

  return {
    kind,
    items,
    index,
    groups,
    will_index: will,
    scenarios_correct: items.filter((i) => i.scenario_correct === true).length,
    scenarios_answered: items.filter((i) => i.scenario_correct != null).length,
    below_standard: scored.filter((i) => i.score < m.thresholds.meets).length,
    material_gaps: scored.filter((i) => i.score < m.thresholds.development).length,
    avg_raters: avgRaters,
    provisional,
    warnings,
  };
}

export type SkillWillGroup = "High skill, high will" | "Low skill, high will" | "High skill, low will" | "Low skill, low will";

export const SKILL_WILL_ACTIONS: Record<SkillWillGroup, string> = {
  "High skill, high will": "Transformation role and peer training. Retain actively.",
  "Low skill, high will": "Targeted training. Best return on the training budget.",
  "High skill, low will": "Not a training problem. Senior conversation about the future and clear expectations.",
  "Low skill, low will": "Honest conversation about role fit, redeployment or exit, handled properly.",
};

export function placeOnGrid(skillIndex: number | null, willIndex: number | null, cutoff: number): SkillWillGroup | null {
  if (skillIndex == null || willIndex == null) return null;
  const hiSkill = skillIndex >= cutoff;
  const hiWill = willIndex >= cutoff;
  if (hiSkill && hiWill) return "High skill, high will";
  if (!hiSkill && hiWill) return "Low skill, high will";
  if (hiSkill && !hiWill) return "High skill, low will";
  return "Low skill, low will";
}
