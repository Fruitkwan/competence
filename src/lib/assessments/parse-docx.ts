import mammoth from "mammoth";

export type ParsedItem = {
  sort_order: number;
  group_name: string | null;
  name: string;
  indicator: string;
  anchor_2: string | null;
  anchor_3: string | null;
  anchor_4: string | null;
  scenario: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
};

export type ParsedTemplate = {
  kind: "skill" | "behaviour" | "placement";
  name: string;
  role_family: string | null;
  department: string | null;
  version: string | null;
  privacy_notice: string | null;
  aspiration_questions: string[];
  items: ParsedItem[];
};

export type ParsedKey = {
  kind: "skill" | "behaviour" | "placement";
  role_family: string | null;
  item_name: string;
  answer_key: "A" | "B" | "C" | "D";
  rationale: string | null;
  diagnostic: string | null;
  /** Placement keys match by question number instead of name. */
  sort_order?: number;
  /** Placement option point values, e.g. {A:4,B:0,C:2,D:1}. */
  option_points?: Record<"A" | "B" | "C" | "D", number>;
  /** Placement templates are matched by department when set. */
  department?: string | null;
};

export type Token =
  | { type: "h1" | "h2" | "h3" | "p" | "li"; text: string }
  | { type: "table"; rows: string[][] };

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function textOf(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const re = /<(h1|h2|h3|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === "table") {
      const rows: string[][] = [];
      const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let r: RegExpExecArray | null;
      while ((r = rowRe.exec(m[2]))) {
        const cells: string[] = [];
        const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let c: RegExpExecArray | null;
        while ((c = cellRe.exec(r[1]))) cells.push(textOf(c[1]));
        rows.push(cells);
      }
      tokens.push({ type: "table", rows });
    } else if (tag === "p" && /<table\b/i.test(m[2])) {
      continue;
    } else {
      const text = textOf(m[2]);
      if (text) tokens.push({ type: tag as "h1" | "h2" | "h3" | "p" | "li", text });
    }
  }
  return tokens;
}

export async function docxToTokens(buffer: Buffer): Promise<Token[]> {
  const { value } = await mammoth.convertToHtml({ buffer });
  return tokenize(value);
}

const OPTION_RE = /^([A-D])\)\s*([\s\S]+)$/;
const ITEM_HEADING_RE = /^(?:\d+\.\s*)?(.+?)$/;
const KEY_HEADING_RE = /^(?:\d+\.\s*)?(.+?)\s+-\s+Answer:\s*([A-D])\s*$/i;

/**
 * Parses a DG Skill or Behaviour Assessment instrument (.docx) into one
 * template per role family (skill) or a single template (behaviour).
 */
export async function parseInstrumentDocx(buffer: Buffer): Promise<ParsedTemplate[]> {
  const tokens = await docxToTokens(buffer);
  const kind = detectKind(tokens);
  if (!kind) throw new Error("Could not detect the instrument type. Expected a DG Skill or Behaviour Assessment.");

  const version = tokens.map((t) => ("text" in t ? t.text : "")).find((t) => /Version\s+\d/i.test(t))?.match(/Version\s+([\d.]+)/i)?.[1] ?? null;
  const privacy = extractPrivacyNotice(tokens);

  const start = tokens.findIndex((t) => t.type === "h1" && /The Instrument/i.test(t.text));
  if (start === -1) throw new Error('Could not find the "The Instrument" section.');

  const templates: ParsedTemplate[] = [];
  let current: ParsedTemplate | null = null;
  let department: string | null = null;
  let group: string | null = null;
  let item: ParsedItem | null = null;
  let phase: "indicator" | "anchors" | "prompts" | "scenario" | "options" | "done" = "done";

  const flushItem = () => {
    if (item && current) current.items.push(item);
    item = null;
  };

  if (kind === "behaviour") {
    current = {
      kind,
      name: "Behaviour, Desire and Attitude Assessment",
      role_family: null,
      department: null,
      version,
      privacy_notice: privacy,
      aspiration_questions: [],
      items: [],
    };
    templates.push(current);
  }

  for (let i = start + 1; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "h1") {
      flushItem();
      if (kind === "behaviour" && /Aspiration/i.test(t.text) && current) {
        current.aspiration_questions = collectAspiration(tokens, i);
      }
      break;
    }

    if (t.type === "p" && /^[A-Z][A-Z &/]+$/.test(t.text) && t.text.length < 40) {
      department = titleCase(t.text);
      continue;
    }

    if (t.type === "h2") {
      flushItem();
      if (kind === "skill") {
        current = {
          kind,
          name: `Skill Assessment: ${t.text}`,
          role_family: t.text,
          department,
          version,
          privacy_notice: privacy,
          aspiration_questions: [],
          items: [],
        };
        templates.push(current);
      } else {
        group = t.text;
      }
      continue;
    }

    if (t.type === "h3" && current) {
      flushItem();
      const name = t.text.match(ITEM_HEADING_RE)?.[1]?.trim() ?? t.text;
      item = {
        sort_order: current.items.length + 1,
        group_name: kind === "behaviour" ? group : null,
        name,
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

    if (!item) continue;

    if (t.type === "table") {
      const first = t.rows[0]?.[0] ?? "";
      if (/^Level\s*2/i.test(first)) {
        for (const row of t.rows) {
          const lvl = row[0]?.match(/Level\s*(\d)/i)?.[1];
          const text = row[1]?.replace(/^(Developing|Meets expectations|Exceeds expectations)\.\s*/i, "") ?? "";
          if (lvl === "2") item.anchor_2 = text;
          if (lvl === "3") item.anchor_3 = text;
          if (lvl === "4") item.anchor_4 = text;
        }
        phase = "anchors";
      } else if (/^Input$/i.test(first)) {
        phase = "prompts";
      }
      continue;
    }

    if (t.type !== "p") continue;

    if (/^Scenario check$/i.test(t.text)) {
      phase = "scenario";
      continue;
    }
    if (/^Evidence \(optional/i.test(t.text)) {
      phase = "done";
      continue;
    }

    if (phase === "indicator") {
      item.indicator = t.text;
      phase = "anchors";
      continue;
    }
    if (phase === "scenario") {
      item.scenario = t.text;
      phase = "options";
      continue;
    }
    if (phase === "options") {
      const opt = t.text.match(OPTION_RE);
      if (opt) {
        const key = `option_${opt[1].toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d";
        item[key] = opt[2].trim();
      }
    }
  }
  flushItem();

  const bad = templates.flatMap((tpl) =>
    tpl.items
      .filter((it) => !it.indicator || !it.scenario || !it.option_a || !it.option_b || !it.option_c || !it.option_d)
      .map((it) => `${tpl.role_family ?? tpl.name} / ${it.name}`)
  );
  if (bad.length) throw new Error(`Incomplete items (missing indicator, scenario or options): ${bad.join("; ")}`);
  if (!templates.length || templates.every((t) => t.items.length === 0)) throw new Error("No competencies were found in the document.");

  return templates;
}

/**
 * Parses the DG Scoring Annexe (.docx) into answer keys keyed by
 * (kind, role family, item name).
 */
export async function parseAnnexeDocx(buffer: Buffer): Promise<ParsedKey[]> {
  const tokens = await docxToTokens(buffer);
  const keys: ParsedKey[] = [];
  let kind: "skill" | "behaviour" | null = null;
  let roleFamily: string | null = null;
  let pending: ParsedKey | null = null;

  for (const t of tokens) {
    if (t.type === "h1") {
      if (/Skill Assessment/i.test(t.text)) kind = "skill";
      else if (/Behaviour Assessment/i.test(t.text)) kind = "behaviour";
      else kind = null;
      roleFamily = null;
      continue;
    }
    if (!kind) continue;

    if (t.type === "h2") {
      roleFamily = kind === "skill" ? t.text : null;
      continue;
    }
    if (t.type === "h3") {
      const m = t.text.match(KEY_HEADING_RE);
      if (!m) continue;
      pending = {
        kind,
        role_family: roleFamily,
        item_name: m[1].trim(),
        answer_key: m[2].toUpperCase() as "A" | "B" | "C" | "D",
        rationale: null,
        diagnostic: null,
      };
      keys.push(pending);
      continue;
    }
    if (t.type === "table" && pending) {
      for (const row of t.rows) {
        if (/^Why$/i.test(row[0] ?? "")) pending.rationale = row[1] ?? null;
        if (/^Diagnostic$/i.test(row[0] ?? "")) pending.diagnostic = row[1] ?? null;
      }
      pending = null;
    }
  }

  if (!keys.length) throw new Error("No answer keys were found. Expected headings like '1. Competency - Answer: C'.");
  return keys;
}

function detectKind(tokens: Token[]): "skill" | "behaviour" | null {
  const title = tokens.slice(0, 4).map((t) => ("text" in t ? t.text : "")).join(" ");
  if (/Behaviour|Behavior/i.test(title)) return "behaviour";
  if (/Skill Assessment/i.test(title)) return "skill";
  return null;
}

function extractPrivacyNotice(tokens: Token[]): string | null {
  const i = tokens.findIndex((t) => t.type === "h1" && /Privacy Notice/i.test(t.text));
  if (i === -1) return null;
  const parts: string[] = [];
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.type === "h1") break;
    if (t.type === "p") parts.push(t.text);
  }
  return parts.join("\n\n") || null;
}

function collectAspiration(tokens: Token[], from: number): string[] {
  const out: string[] = [];
  for (let j = from + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.type === "h1") break;
    if (t.type === "li") out.push(t.text);
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 || w === "it" ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .replace(/\bHuman Resources\b/i, "Human Resources");
}
