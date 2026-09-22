import { docxToTokens, type ParsedItem, type ParsedKey, type ParsedTemplate, type Token } from "./parse-docx";

type Letter = "A" | "B" | "C" | "D";

const OPTION_RE = /^([A-D])\)\s*([\s\S]+)$/;
const PART_RE = /^PART\s+(\d+)\b/i;
const ITEM_RE = /^(\d{1,2})\.\s+(.+)$/;
const KEY_HEADING_RE = /^(\d{1,2})\.\s+(.+?)\s+[—–-]\s+Key:\s*([A-D])\s*$/i;

function headText(tokens: Token[], count = 8): string {
  return tokens
    .slice(0, count)
    .map((t) => ("text" in t ? t.text : ""))
    .join(" ");
}

/** True when the document looks like a role-placement instrument, not a skill/behaviour one. */
export function isPlacementInstrumentTokens(tokens: Token[]): boolean {
  return /placement/i.test(headText(tokens));
}

/** True when the annexe carries per-option point matrices (Q | A | B | C | D | Key). */
export function isPlacementAnnexeTokens(tokens: Token[]): boolean {
  return tokens.some(
    (t) =>
      t.type === "table" &&
      t.rows[0]?.length >= 6 &&
      /^Q$/i.test(t.rows[0][0] ?? "") &&
      /^Key$/i.test(t.rows[0][5] ?? "")
  );
}

/**
 * Parses a role-placement instrument (.docx): paragraph-structured questions in
 * four parts, each with an indicator line, a "Scenario Check:" stem and A–D
 * judgement options. Group names become "Part N — <part name>".
 */
export async function parsePlacementInstrumentDocx(buffer: Buffer): Promise<ParsedTemplate> {
  const tokens = await docxToTokens(buffer);

  const title =
    tokens
      .slice(0, 8)
      .map((t) => ("text" in t ? t.text : ""))
      .find((t) => /placement/i.test(t)) ?? "Role Placement Assessment";
  const department = title.match(/^([A-Za-z][A-Za-z &]*?)\s+Career Path/i)?.[1]?.trim() ?? null;

  const start = tokens.findIndex((t) => t.type === "h1" && /^The Assessment/i.test(t.text));
  if (start === -1) throw new Error('Could not find "The Assessment" section in the placement instrument.');

  const items: ParsedItem[] = [];
  let partNo = 0;
  let partName = "";
  let item: ParsedItem | null = null;
  let phase: "indicator" | "scenario" | "options" | "done" = "done";

  const flush = () => {
    if (item) items.push(item);
    item = null;
  };

  for (let i = start + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "h1") break;
    if (t.type !== "p") continue;

    const partMatch = t.text.match(PART_RE);
    if (partMatch) {
      flush();
      partNo = Number(partMatch[1]);
      partName = "";
      phase = "done";
      continue;
    }

    // Question headings are numbered paragraphs ("11. Developing People"). The
    // current item isn't flushed until the next heading, so expect
    // items.length + (pending ? 1 : 0) + 1.
    const itemMatch = t.text.match(ITEM_RE);
    const expected = items.length + (item ? 1 : 0) + 1;
    if (itemMatch && partNo > 0 && Number(itemMatch[1]) === expected) {
      flush();
      item = {
        sort_order: Number(itemMatch[1]),
        group_name: `Part ${partNo}${partName ? ` — ${partName}` : ""}`,
        name: itemMatch[2].trim(),
        indicator: "",
        anchor_2: null,
        anchor_3: null,
        anchor_4: null,
        scenario: null,
        option_a: null,
        option_b: null,
        option_c: null,
        option_d: null,
      };
      phase = "indicator";
      continue;
    }

    if (!item) {
      // The part subtitle ("Foundation — Confirms Sales Executive") carries the part name.
      if (!partName && t.text.includes("—")) partName = t.text.split("—")[0].trim();
      continue;
    }

    const opt = t.text.match(OPTION_RE);
    if (opt && phase === "options") {
      item[`option_${opt[1].toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"] = opt[2].trim();
      continue;
    }
    if (/^Scenario Check:?$/i.test(t.text)) {
      phase = "scenario";
      continue;
    }
    if (/^Identifies:/i.test(t.text)) {
      phase = "done";
      continue;
    }
    if (phase === "scenario") {
      item.scenario = t.text;
      phase = "options";
      continue;
    }
    if (phase === "indicator") {
      item.indicator = t.text;
      phase = "done";
      continue;
    }
  }
  flush();

  const bad = items
    .filter((it) => !it.indicator || !it.scenario || !it.option_a || !it.option_b || !it.option_c || !it.option_d)
    .map((it) => it.name);
  if (bad.length) throw new Error(`Incomplete placement questions (missing indicator, scenario or options): ${bad.join("; ")}`);
  if (!items.length) throw new Error("No questions were found in the placement instrument.");

  return {
    kind: "placement",
    name: title,
    role_family: null,
    department,
    version: null,
    privacy_notice: null,
    aspiration_questions: [],
    items,
  };
}

/**
 * Parses the placement scoring annexe (.docx): per-part point matrices
 * (Q | A | B | C | D | Key) plus "N. Item — Key: X" rationale paragraphs.
 * Keys are matched to items by question number, not name.
 */
export async function parsePlacementAnnexeDocx(buffer: Buffer): Promise<ParsedKey[]> {
  const tokens = await docxToTokens(buffer);
  const title =
    tokens
      .slice(0, 8)
      .map((t) => ("text" in t ? t.text : ""))
      .find((t) => /scoring annexe|placement/i.test(t)) ?? "";
  const department = title.match(/^([A-Za-z][A-Za-z &]*?)\s+Career Path/i)?.[1]?.trim() ?? null;

  const bySortOrder = new Map<number, ParsedKey>();
  let pending: ParsedKey | null = null;

  for (const t of tokens) {
    if (t.type === "table") {
      pending = null;
      const head = t.rows[0] ?? [];
      const isMatrix = head.length >= 6 && /^Q$/i.test(head[0]) && /^Key$/i.test(head[5]);
      if (!isMatrix) continue;
      for (const row of t.rows.slice(1)) {
        const q = Number(row[0]);
        const key = (row[5] ?? "").trim().toUpperCase();
        if (!Number.isInteger(q) || !/^[A-D]$/.test(key)) continue;
        const existing = bySortOrder.get(q);
        bySortOrder.set(q, {
          kind: "placement",
          role_family: null,
          department,
          item_name: existing?.item_name ?? `Question ${q}`,
          answer_key: key as Letter,
          option_points: { A: Number(row[1]), B: Number(row[2]), C: Number(row[3]), D: Number(row[4]) },
          rationale: existing?.rationale ?? null,
          diagnostic: null,
          sort_order: q,
        });
      }
      continue;
    }

    if (t.type === "p") {
      const m = t.text.match(KEY_HEADING_RE);
      if (m) {
        const q = Number(m[1]);
        const existing = bySortOrder.get(q);
        pending = {
          kind: "placement",
          role_family: null,
          department,
          item_name: m[2].trim(),
          answer_key: m[3].toUpperCase() as Letter,
          option_points: existing?.option_points,
          rationale: null,
          diagnostic: null,
          sort_order: q,
        };
        bySortOrder.set(q, pending);
        continue;
      }
      if (pending && pending.rationale == null) {
        pending.rationale = t.text;
        pending = null;
      }
    }
  }

  const keys = [...bySortOrder.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (!keys.length) throw new Error("No placement answer keys found. Expected 'Q | A | B | C | D | Key' point tables.");
  const noPoints = keys.filter((k) => !k.option_points);
  if (noPoints.length)
    throw new Error(`Questions ${noPoints.map((k) => k.sort_order).join(", ")} have keys but no point values in the matrix tables.`);
  return keys;
}
