/**
 * Notification type constants and display config.
 */

export const NOTIFICATION_TYPES = {
  // Cycle events
  CYCLE_CREATED: "cycle_created",
  CYCLE_STATUS_CHANGED: "cycle_status_changed",
  CYCLE_CLOSED: "cycle_closed",

  // Objective events
  OBJECTIVE_SUBMITTED: "objective_submitted",
  OBJECTIVE_APPROVED: "objective_approved",
  OBJECTIVE_REJECTED: "objective_rejected",
  OBJECTIVE_REVISION_REQUESTED: "objective_revision_requested",

  // Assessment events
  SELF_ASSESSMENT_DUE: "self_assessment_due",
  SELF_ASSESSMENT_COMPLETED: "self_assessment_completed",
  MANAGER_ASSESSMENT_COMPLETED: "manager_assessment_completed",

  // Calibration
  CALIBRATION_SCHEDULED: "calibration_scheduled",
  APPRAISAL_SIGNED: "appraisal_signed",

  // Training
  COURSE_ASSIGNED: "course_assigned",
  COURSE_COMPLETED: "course_completed",

  // Skill gaps
  SKILL_GAPS_DETECTED: "skill_gaps_detected",

  // PIP
  PIP_CREATED: "pip_created",
  PIP_MILESTONE_DUE: "pip_milestone_due",
  PIP_ESCALATED: "pip_escalated",

  // Concerns
  CONCERN_RAISED: "concern_raised",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_ICONS: Record<string, string> = {
  cycle_created: "📅",
  cycle_launched: "🚀",
  cycle_status_changed: "🔄",
  cycle_closed: "✅",
  objective_submitted: "📝",
  objective_approved: "✅",
  objective_rejected: "❌",
  objective_revision_requested: "🔁",
  objective_reminder: "⏰",
  self_assessment_due: "⏰",
  self_assessment_completed: "📋",
  manager_assessment_completed: "📊",
  calibration_scheduled: "🤝",
  appraisal_signed: "✍️",
  appraisal_completed: "🏆",
  course_assigned: "📚",
  course_completed: "🎓",
  skill_gaps_detected: "🔍",
  pip_created: "⚠️",
  pip_milestone_due: "📌",
  pip_escalated: "🚨",
  concern_raised: "🔔",
  idp_suggestion: "💡",
  system: "⚙️",
};
