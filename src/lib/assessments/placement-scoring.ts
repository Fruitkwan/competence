type Letter = "A" | "B" | "C" | "D";

/** The instrument's four parts, in paper order. */
const PARTS = [
  { part: 1, name: "Foundation", outOf: 20 },
  { part: 2, name: "Account Leadership", outOf: 20 },
  { part: 3, name: "Team Leadership", outOf: 20 },
  { part: 4, name: "Conduct", outOf: 12 },
] as const;

export type PlacementAnswer = {
  itemId: string;
  sortOrder: number;
  name: string;
  group: string | null;
  chosen: Letter | null;
  points: number | null;
  /** Points each option would have scored, e.g. {A:4,B:0,C:2,D:1}. */
  optionPoints: Record<string, number> | null;
};

export type PlacementPartScore = {
  part: number;
  name: string;
  outOf: number;
  points: number;
  answered: number;
  answers: PlacementAnswer[];
  /** Items answered with a 0-point option. */
  zeroItems: string[];
};

export type RecordScores = {
  commercial: number | null;
  account: number | null;
  leadership: number | null;
};

export type PlacementOutcome = {
  /** Threshold-summary step that decided the outcome (0 = not decidable yet). */
  step: number;
  label: string;
  reason: string;
  /** True when the commercial record is missing, so no confirmation can be made. */
  pendingRecord: boolean;
};

export type PlacementItemInput = {
  id: string;
  sort_order: number;
  name: string;
  group_name: string | null;
};

function partOf(item: Pick<PlacementItemInput, "group_name" | "sort_order">): number {
  const m = item.group_name?.match(/^Part\s+(\d+)/i);
  if (m) return Number(m[1]);
  // Fall back to the fixed question ranges if group labels ever change.
  if (item.sort_order <= 5) return 1;
  if (item.sort_order <= 10) return 2;
  if (item.sort_order <= 15) return 3;
  return 4;
}

/** Scores the candidate's paper: chosen option → its point value from the key. */
export function scorePlacementPaper(
  items: PlacementItemInput[],
  optionPointsByItem: Map<string, Record<string, number>>,
  selfResponses: { item_id: string; scenario_answer: Letter | null }[],
): PlacementPartScore[] {
  const answerByItem = new Map(selfResponses.map((r) => [r.item_id, r.scenario_answer]));
  return PARTS.map((p) => {
    const answers: PlacementAnswer[] = items
      .filter((i) => partOf(i) === p.part)
      .map((item) => {
        const chosen = answerByItem.get(item.id) ?? null;
        const optionPoints = optionPointsByItem.get(item.id) ?? null;
        const points = chosen && optionPoints ? (optionPoints[chosen] ?? 0) : null;
        return {
          itemId: item.id,
          sortOrder: item.sort_order,
          name: item.name,
          group: item.group_name,
          chosen,
          points,
          optionPoints,
        };
      });
    return {
      part: p.part,
      name: p.name,
      outOf: p.outOf,
      points: answers.reduce((sum, a) => sum + (a.points ?? 0), 0),
      answered: answers.filter((a) => a.chosen != null).length,
      answers,
      zeroItems: answers.filter((a) => a.points === 0).map((a) => a.name),
    };
  });
}

function answerAt(parts: PlacementPartScore[], sortOrder: number) {
  for (const p of parts) {
    const a = p.answers.find((x) => x.sortOrder === sortOrder);
    if (a) return a;
  }
  return null;
}

/**
 * Applies the published threshold ladder strictly in order; the first matching
 * step decides. Record scores of null mean "not verified" — the condition they
 * feed is treated as unmet, and a missing commercial record makes any
 * confirmation provisional.
 */
export function decidePlacement(parts: PlacementPartScore[], record: RecordScores): PlacementOutcome {
  const [p1, p2, p3] = parts.map((p) => p.points);
  const q11 = answerAt(parts, 11)?.points ?? null;
  const q14 = answerAt(parts, 14)?.points ?? null;
  const pendingRecord = record.commercial == null;

  // Step 2 — conduct cap: any 0-point Part 4 answer, whatever else was scored.
  const conductZero = parts[3].zeroItems;
  if (conductZero.length) {
    return {
      step: 2,
      label: "Sales Executive — capped on conduct",
      reason: `A 0-point answer in Part 4 (Conduct) on ${conductZero.join("; ")} caps the outcome at Sales Executive whatever else was scored.`,
      pendingRecord,
    };
  }

  // Step 3 — foundation gate: below 12, or any 0-point answer in Part 1.
  if (p1 < 12 || parts[0].zeroItems.length) {
    const zero = parts[0].zeroItems.length
      ? ` A 0-point answer on ${parts[0].zeroItems.join("; ")} blocks placement at any level.`
      : "";
    return {
      step: 3,
      label: "Sales Executive — development plan",
      reason: `Part 1 scored ${p1} of 20 against a threshold of 12.${zero}`,
      pendingRecord,
    };
  }

  const managerConditions =
    p2 >= 12 &&
    q11 === 4 &&
    q14 === 4 &&
    (record.leadership ?? -1) >= 50 &&
    (record.commercial ?? -1) >= 50;

  let managerNote: string | undefined;

  if (p3 >= 15 && managerConditions) {
    return {
      step: 4,
      label: "Sales Manager",
      reason: `Part 3 scored ${p3} of 20 against a threshold of 15, questions 11 and 14 both scored 4, Part 2 scored ${p2} against a floor of 12, leadership record ${record.leadership}, commercial record ${record.commercial}. Six-month Acting confirmation applies.`,
      pendingRecord,
    };
  }
  if ((p3 === 13 || p3 === 14) && managerConditions) {
    return {
      step: 5,
      label: "Sales Manager (Acting — six months)",
      reason: `Part 3 scored ${p3} of 20, within 2 points of the 15 threshold, with every other Sales Manager condition met. Re-measurement at six months, once.`,
      pendingRecord,
    };
  }
  if (p3 >= 13 && !managerConditions) {
    const why: string[] = [];
    if (q11 !== 4) why.push("question 11 was not scored at 4");
    if (q14 !== 4) why.push("question 14 was not scored at 4");
    if (p2 < 12) why.push(`Part 2 scored ${p2} against a floor of 12`);
    if ((record.leadership ?? -1) < 50) why.push("leadership record below 50 or unavailable");
    if ((record.commercial ?? -1) < 50) why.push("commercial record below 50 or unavailable");
    // Falls through to step 6 below; remember why step 4/5 was not met.
    managerNote = `Sales Manager conditions not met: ${why.join("; ")}.`;
  }

  if (p2 >= 14 && (record.account ?? -1) >= 50 && (record.commercial ?? -1) >= 50) {
    return {
      step: 6,
      label: "Senior Sales Executive / Strategic Account Manager",
      reason: `Part 2 scored ${p2} of 20 against a threshold of 14, account record ${record.account}, commercial record ${record.commercial}.`,
      pendingRecord,
    };
  }
  if (
    (p2 === 12 || p2 === 13) &&
    (record.account ?? -1) >= 50 &&
    (record.commercial ?? -1) >= 50
  ) {
    return {
      step: 7,
      label: "Strategic Account Manager (Designate — six months)",
      reason: `Part 2 scored ${p2} of 20, within 2 points of the 14 threshold, with the record conditions met. Re-measurement at six months, once.`,
      pendingRecord,
    };
  }

  if (pendingRecord) {
    return {
      step: 0,
      label: "Pending — performance record required",
      reason:
        "The commercial record has not been verified and entered, so no confirmation can be made. Enter the record scores to decide between steps 4–9." +
        (managerNote ? ` ${managerNote}` : ""),
      pendingRecord: true,
    };
  }

  if (record.commercial! < 50) {
    return {
      step: 8,
      label: "Sales Executive — confirmed with a performance plan",
      reason: `Foundation cleared (Part 1 scored ${p1} of 20) and no higher threshold met; the commercial record of ${record.commercial} is below 50 — a delivery gap, handled as a performance conversation rather than a development plan.`,
      pendingRecord: false,
    };
  }
  return {
    step: 9,
    label: "Sales Executive — confirmed at standard",
    reason: `Foundation cleared (Part 1 scored ${p1} of 20) and the commercial record of ${record.commercial} is at 50 or above; no higher threshold met.`,
    pendingRecord: false,
  };
}

export function parseRecordScores(raw: unknown): RecordScores {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    commercial: num(r.commercial),
    account: num(r.account),
    leadership: num(r.leadership),
  };
}
