/**
 * Types for the full Dhofar Global Performance Appraisal form.
 * JSONB column shapes + table row type.
 */

/* ---- Rating Scale ---- */
export type RatingValue = 1 | 2 | 3 | 4 | 5 | null;

export const RATING_LABELS: Record<number, string> = {
  5: "Outstanding",
  4: "Exceeds Expectations",
  3: "Meets Expectations",
  2: "Needs Improvement",
  1: "Unsatisfactory",
};

export const RATING_DESCRIPTIONS: Record<number, string> = {
  5: "Consistently exceeds all expectations; role model for others; delivers exceptional results.",
  4: "Frequently exceeds requirements; takes initiative; strong contributor to team goals.",
  3: "Consistently meets all job requirements; reliable and competent performer.",
  2: "Partially meets requirements; clear areas needing development and support.",
  1: "Does not meet minimum job requirements; immediate improvement plan required.",
};

/* ---- Section A: Goals & Objectives ---- */
export interface GoalRow {
  objective: string;
  kpi: string;
  target: string;
  actual: string;
  rating_n1: RatingValue;
  rating_n2: RatingValue;
  achievement_pct: string;
}

export function emptyGoal(): GoalRow {
  return { objective: "", kpi: "", target: "", actual: "", rating_n1: null, rating_n2: null, achievement_pct: "" };
}

/* ---- Sections B/C/D: Competency ratings ---- */
export interface CompetencyEntry {
  rating_n1: RatingValue;
  rating_n2: RatingValue;
  comments_n1: string;
  comments_n2: string;
  evidence: string;
}

export function emptyCompetency(): CompetencyEntry {
  return { rating_n1: null, rating_n2: null, comments_n1: "", comments_n2: "", evidence: "" };
}

/* ---- Section B: Core Competencies ---- */
export const CORE_COMPETENCIES = [
  "Communication & Interpersonal Skills",
  "Quality & Accuracy of Work",
  "Planning, Organization & Time Management",
  "Customer Focus (Internal / External)",
  "Problem-Solving & Decision Making",
  "Teamwork & Collaboration",
  "Adaptability & Resilience",
  "Initiative & Ownership",
] as const;

/* ---- Section C: Leadership Competencies ---- */
export const LEADERSHIP_COMPETENCIES = [
  "People Development & Coaching",
  "Strategic Thinking & Vision",
  "Delegation & Empowerment",
  "Performance Management of Team",
  "Stakeholder Management & Influence",
  "Change Management & Innovation",
] as const;

/* ---- Section D: Values & Culture ---- */
export const VALUES_COMPETENCIES = [
  "Integrity & Ethics",
  "Respect & Inclusion",
  "Commitment to Excellence",
  "Accountability & Responsibility",
] as const;

/* ---- Section E: Open Feedback ---- */
export interface FeedbackN1 {
  top_achievements: string;
  challenges: string;
  support_needed: string;
  career_aspirations: string;
  self_rating_rationale: string;
}

export interface FeedbackN2 {
  top_achievements: string;
  challenges: string;
  support_provided: string;
  career_recommendation: string;
  overall_assessment: string;
}

export function emptyFeedbackN1(): FeedbackN1 {
  return { top_achievements: "", challenges: "", support_needed: "", career_aspirations: "", self_rating_rationale: "" };
}

export function emptyFeedbackN2(): FeedbackN2 {
  return { top_achievements: "", challenges: "", support_provided: "", career_recommendation: "", overall_assessment: "" };
}

/* ---- Section F: Individual Development Plan ---- */
export interface DevPlanRow {
  area: string;
  action: string;
  resources: string;
  timeline: string;
  owner: string;
}

export function emptyDevPlan(): DevPlanRow {
  return { area: "", action: "", resources: "", timeline: "", owner: "" };
}

/* ---- Section G: Next Period Goals ---- */
export interface NextGoalRow {
  objective: string;
  key_result: string;
  target_date: string;
  priority: "High" | "Medium" | "Low" | "";
  agreed: boolean;
}

export function emptyNextGoal(): NextGoalRow {
  return { objective: "", key_result: "", target_date: "", priority: "", agreed: false };
}

/* ---- Appraisal Types ---- */
export type AppraisalType = "Annual" | "Mid-Year" | "Probation" | "Exit";
export type AppraisalStatus = "Draft" | "N1 Complete" | "N2 Complete" | "Final" | "Archived";

export const APPRAISAL_TYPES: AppraisalType[] = ["Annual", "Mid-Year", "Probation", "Exit"];
export const APPRAISAL_STATUSES: AppraisalStatus[] = ["Draft", "N1 Complete", "N2 Complete", "Final", "Archived"];

export const RECOMMENDED_ACTIONS = [
  "Outstanding Bonus",
  "Merit Increase",
  "Promotion Review",
  "Development Plan",
  "PIP",
] as const;

/* ---- Full form state ---- */
export interface PerformanceAppraisalForm {
  id?: string;
  cycle_id?: string | null;

  // Employee info
  employee_id: string;
  manager_id: string;
  department: string;
  business_unit: string;
  location: string;
  appraisal_period: string;
  appraisal_type: AppraisalType | "";
  document_ref: string;

  // Section A
  goals: GoalRow[];

  // Section B
  core_competencies: Record<string, CompetencyEntry>;

  // Section C
  leadership: Record<string, CompetencyEntry>;
  leadership_applicable: boolean;

  // Section D
  values_culture: Record<string, CompetencyEntry>;

  // Section E
  feedback_n1: FeedbackN1;
  feedback_n2: FeedbackN2;

  // Section F
  development_plan: DevPlanRow[];

  // Section G
  next_period_goals: NextGoalRow[];

  // Section H — scores
  score_a_n1: number | null;
  score_a_n2: number | null;
  score_b_n1: number | null;
  score_b_n2: number | null;
  score_c_n1: number | null;
  score_c_n2: number | null;
  score_d_n1: number | null;
  score_d_n2: number | null;
  final_rating: RatingValue;
  calibrated_rating: RatingValue;
  calibration_rationale: string;
  overall_label: string;
  recommended_action: string;

  // Section I
  employee_comments: string;

  // Section J
  employee_signed_at: string | null;
  manager_signed_at: string | null;
  hr_signed_at: string | null;
  hr_representative: string;

  // Meta
  status: AppraisalStatus;
}

/** Build a blank form for "create" mode */
export function emptyPerformanceAppraisal(): PerformanceAppraisalForm {
  const coreComp: Record<string, CompetencyEntry> = {};
  for (const c of CORE_COMPETENCIES) coreComp[c] = emptyCompetency();

  const leadership: Record<string, CompetencyEntry> = {};
  for (const c of LEADERSHIP_COMPETENCIES) leadership[c] = emptyCompetency();

  const values: Record<string, CompetencyEntry> = {};
  for (const c of VALUES_COMPETENCIES) values[c] = emptyCompetency();

  return {
    employee_id: "",
    manager_id: "",
    department: "",
    business_unit: "",
    location: "",
    appraisal_period: "",
    appraisal_type: "",
    document_ref: "",

    goals: [emptyGoal(), emptyGoal(), emptyGoal()],
    core_competencies: coreComp,
    leadership,
    leadership_applicable: true,
    values_culture: values,

    feedback_n1: emptyFeedbackN1(),
    feedback_n2: emptyFeedbackN2(),

    development_plan: [emptyDevPlan(), emptyDevPlan(), emptyDevPlan()],
    next_period_goals: [emptyNextGoal(), emptyNextGoal(), emptyNextGoal()],

    score_a_n1: null, score_a_n2: null,
    score_b_n1: null, score_b_n2: null,
    score_c_n1: null, score_c_n2: null,
    score_d_n1: null, score_d_n2: null,
    final_rating: null,
    calibrated_rating: null,
    calibration_rationale: "",
    overall_label: "",
    recommended_action: "",

    employee_comments: "",
    employee_signed_at: null,
    manager_signed_at: null,
    hr_signed_at: null,
    hr_representative: "",

    status: "Draft",
  };
}
