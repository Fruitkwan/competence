"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateItemAnswerKey, updateTemplateJobTitles } from "@/lib/actions/assessments";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Template = Database["public"]["Tables"]["assessment_templates"]["Row"];
type Item = Database["public"]["Tables"]["assessment_items"]["Row"];
type Key = Database["public"]["Tables"]["assessment_item_keys"]["Row"];
type Letter = "A" | "B" | "C" | "D";

export function TemplateDetail({
  template,
  items,
  keys,
  knownJobTitles,
}: {
  template: Template;
  items: Item[];
  keys: Key[];
  knownJobTitles: string[];
}) {
  const keyByItem = new Map(keys.map((k) => [k.item_id, k]));
  const groups = [...new Set(items.map((i) => i.group_name))];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {groups.map((g) => (
          <div key={g ?? "all"} className="space-y-4">
            {g && <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{g}</h2>}
            {items
              .filter((i) => i.group_name === g)
              .map((item) => (
                <ItemCard key={item.id} item={item} itemKey={keyByItem.get(item.id) ?? null} />
              ))}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {template.kind === "skill" && (
          <JobTitlesCard templateId={template.id} initial={template.job_titles} known={knownJobTitles} />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoring model</CardTitle>
            <CardDescription>Published before collection begins. Not to be changed after results are seen.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ScoringSummary scoring={template.scoring} kind={template.kind} />
          </CardContent>
        </Card>
        {template.aspiration_questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aspiration and intent</CardTitle>
              <CardDescription>Self only. Not rated, not scored.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-4 text-sm">
                {(template.aspiration_questions as string[]).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
        {template.privacy_notice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Privacy notice</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-line text-xs text-muted-foreground">{template.privacy_notice}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ScoringSummary({ scoring, kind }: { scoring: Record<string, unknown>; kind: Template["kind"] }) {
  const s = scoring as { weights?: Record<string, number>; thresholds?: Record<string, number>; grid_cutoff?: number; min_raters?: number };
  const w = s.weights ?? {};
  const t = s.thresholds ?? {};
  const rows: [string, string][] = [
    [kind === "skill" ? "Cross-departmental rater" : "Peer average", pct(w.other)],
    ["Line manager", pct(w.line_manager)],
    ["Scenario check", pct(w.scenario)],
    ["Self-rating", pct(w.self)],
    ["Strength", `≥ ${t.strength ?? 75}`],
    ["Meets standard", `≥ ${t.meets ?? 60}`],
    ["Development gap", `≥ ${t.development ?? 45}`],
    ["Skill / will cut-off", String(s.grid_cutoff ?? 60)],
    ["Minimum raters", String(s.min_raters ?? 3)],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function pct(v: number | undefined) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function ItemCard({ item, itemKey }: { item: Item; itemKey: Key | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<Letter | null>(itemKey?.answer_key ?? null);

  async function setAnswer(letter: Letter) {
    setSaving(true);
    const result = await updateItemAnswerKey(item.id, letter);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      setKey(letter);
      router.refresh();
    }
  }

  const options: [Letter, string | null][] = [
    ["A", item.option_a],
    ["B", item.option_b],
    ["C", item.option_c],
    ["D", item.option_d],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {item.sort_order}. {item.name}
        </CardTitle>
        <CardDescription>{item.indicator}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 rounded-md bg-muted/40 p-3">
          {[
            ["2", "Developing", item.anchor_2],
            ["3", "Meets expectations", item.anchor_3],
            ["4", "Exceeds expectations", item.anchor_4],
          ].map(([lvl, label, text]) => (
            <div key={lvl} className="grid grid-cols-[2.5rem_1fr] gap-2">
              <span className="font-mono text-xs text-muted-foreground">L{lvl}</span>
              <span>
                <span className="font-medium">{label}.</span> {text}
              </span>
            </div>
          ))}
        </div>

        {item.scenario && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scenario check</div>
            <p>{item.scenario}</p>
            <div className="grid gap-1.5">
              {options.map(([letter, text]) => (
                <button
                  key={letter}
                  type="button"
                  disabled={saving}
                  onClick={() => setAnswer(letter)}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent",
                    key === letter && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                  )}
                >
                  <span className={cn("mt-0.5 font-mono text-xs", key === letter ? "text-emerald-600" : "text-muted-foreground")}>
                    {letter}
                  </span>
                  <span className="flex-1">{text}</span>
                  {key === letter && <Check className="mt-0.5 h-4 w-4 text-emerald-600" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : key ? (
                <Badge variant="outline" className="border-emerald-300 text-emerald-700">Answer: {key}</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 text-amber-700">No answer key — click the correct option</Badge>
              )}
            </div>
            {itemKey?.rationale && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why: </span>
                {itemKey.rationale}
              </p>
            )}
            {itemKey?.diagnostic && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Diagnostic: </span>
                {itemKey.diagnostic}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobTitlesCard({ templateId, initial, known }: { templateId: string; initial: string[]; known: string[] }) {
  const router = useRouter();
  const [titles, setTitles] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(titles) !== JSON.stringify(initial);

  function add(value: string) {
    const v = value.trim();
    if (!v || titles.includes(v)) return;
    setTitles((t) => [...t, v]);
    setDraft("");
  }

  async function save() {
    setSaving(true);
    const result = await updateTemplateJobTitles(templateId, titles);
    setSaving(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Job titles saved.");
      router.refresh();
    }
  }

  const suggestions = known.filter((k) => !titles.includes(k) && k.toLowerCase().includes(draft.toLowerCase())).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Applies to job titles</CardTitle>
        <CardDescription>Employees with these titles get this assessment suggested when assigning.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {titles.map((t) => (
            <Badge key={t} variant="outline" className="gap-1 pr-1">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setTitles((x) => x.filter((y) => y !== t))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {titles.length === 0 && <span className="text-xs text-muted-foreground">No job titles mapped.</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder="Add a job title…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => add(draft)} aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {draft && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
                onClick={() => add(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save mapping
        </Button>
      </CardContent>
    </Card>
  );
}
