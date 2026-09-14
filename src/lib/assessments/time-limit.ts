/** Self-assessments must be finished within this many minutes of pressing Start. */
export const ASSESSMENT_TIME_LIMIT_MINUTES = 30;

/** Allowance for clock skew and network latency before the server treats a session as expired. */
const GRACE_MS = 30_000;

export function deadlineFor(startedAt: string): number {
  return new Date(startedAt).getTime() + ASSESSMENT_TIME_LIMIT_MINUTES * 60_000;
}

export function isExpired(startedAt: string | null, now = Date.now()): boolean {
  return startedAt != null && now > deadlineFor(startedAt) + GRACE_MS;
}
