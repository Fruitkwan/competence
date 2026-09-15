/** Self-assessments must be finished within this many minutes of pressing Start. */
export const ASSESSMENT_TIME_LIMIT_MINUTES = 30;
export const PEER_TIME_LIMIT_MINUTES = 15;

/** Allowance for clock skew and network latency before the server treats a session as expired. */
const GRACE_MS = 30_000;

export function deadlineFor(startedAt: string, minutes = ASSESSMENT_TIME_LIMIT_MINUTES): number {
  return new Date(startedAt).getTime() + minutes * 60_000;
}

export function isExpired(startedAt: string | null, now = Date.now()): boolean {
  return startedAt != null && now > deadlineFor(startedAt) + GRACE_MS;
}

export function peerTiming(startedAt: string, now = Date.now()) {
  const deadline = deadlineFor(startedAt, PEER_TIME_LIMIT_MINUTES);
  return { timedOut: now >= deadline, acceptAnswers: now <= deadline + GRACE_MS };
}
