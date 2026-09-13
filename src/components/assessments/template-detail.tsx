"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ClipboardList, Loader2, Plus, Search, Settings2, X } from "lucide-react";
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
  const [view, setView] = useState<"content" | "settings">("content");
  const [selected, setSelected] = useState(items[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const content = useRef<HTMLDivElement>(null);
  const activeIndex = items.findIndex(item => item.id === selected);
  const active = items[activeIndex];
  const filtered = items.filter(item => `${item.name} ${item.group_name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const selectItem = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => { content.current?.focus(); content.current?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  };
  const scenarioCount = items.filter(item => item.scenario).length;
  const missingKeys = items.filter(item => item.scenario && !keyByItem.get(item.id)?.answer_key).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 rounded-2xl border bg-muted/20 p-5 sm:grid-cols-3 sm:p-6">
        <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Competencies</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scenario checks</p><p className="mt-2 text-2xl font-semibold">{scenarioCount}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Answer keys</p><p className={cn("mt-2 text-sm font-medium", missingKeys > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>{missingKeys > 0 ? `${missingKeys} need attention` : scenarioCount ? "All scenarios have an answer key" : "No scenario keys required"}</p></div>
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-4" aria-label="Template views">
        <Button variant={view === "content" ? "default" : "outline"} aria-pressed={view === "content"} onClick={() => setView("content")}><ClipboardList className="size-4" /> Assessment content</Button>
        <Button variant={view === "settings" ? "default" : "outline"} aria-pressed={view === "settings"} onClick={() => setView("settings")}><Settings2 className="size-4" /> Template settings</Button>
      </div>
      <div hidden={view !== "content"}>
        <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="rounded-2xl border bg-muted/20 p-4 lg:sticky lg:top-6">
            <h2 className="mb-3 text-sm font-semibold">Competencies</h2>
            <div className="relative mb-4"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search competencies" placeholder="Find a competency..." className="pl-9" value={query} onChange={event => setQuery(event.target.value)} /></div>
            <nav aria-label="Competencies" className="flex max-h-72 gap-2 overflow-auto lg:max-h-[55vh] lg:flex-col">
              {filtered.map(item => <button key={item.id} onClick={() => selectItem(item.id)} aria-current={selected === item.id ? "true" : undefined} className={cn("flex shrink-0 items-start gap-3 rounded-xl p-3 text-left text-sm hover:bg-muted focus-visible:outline-2", selected === item.id && "bg-background font-medium shadow-sm ring-1 ring-border")}><span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs">{item.sort_order}</span><span>{item.name}{item.group_name && <span className="mt-1 block text-xs font-normal text-muted-foreground">{item.group_name}</span>}{item.scenario && !keyByItem.get(item.id)?.answer_key && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">Answer key needed</span>}</span></button>)}
            </nav>
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">No matching competencies.</p>}
          </aside>
          <div ref={content} tabIndex={-1} className="min-w-0 scroll-mt-6 space-y-4 outline-none">
            {active ? <>
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Competency {activeIndex + 1} of {items.length}</p><Badge variant="outline">Admin preview</Badge></div>
              <ItemCard key={active.id} item={active} itemKey={keyByItem.get(active.id) ?? null} />
              <div className="flex justify-between gap-3 rounded-xl border bg-background p-3"><Button variant="outline" disabled={activeIndex <= 0} onClick={() => selectItem(items[activeIndex - 1].id)}><ArrowLeft className="size-4" /> Previous</Button><Button disabled={activeIndex >= items.length - 1} onClick={() => selectItem(items[activeIndex + 1].id)}>Next competency <ArrowRight className="size-4" /></Button></div>
            </> : <Card><CardHeader><CardTitle>No competencies yet</CardTitle><CardDescription>This template does not contain any assessment items.</CardDescription></CardHeader></Card>}
          </div>
        </div>
      </div>
      <div hidden={view !== "settings"}>
      <div className="grid items-start gap-6 md:grid-cols-2">
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
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3">
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
    <Card className="overflow-hidden rounded-2xl py-0">
      <CardHeader className="gap-3 border-b bg-muted/20 px-6 py-6 sm:px-8">
        <CardTitle className="text-xl tracking-tight">
          {item.name}
        </CardTitle>
        <CardDescription className="leading-relaxed">{item.indicator}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-8 text-sm sm:px-8">
        <details className="rounded-xl border bg-muted/20 p-4">
          <summary className="cursor-pointer font-medium">Rating guide · Levels 2–4</summary>
          <div className="mt-4 grid gap-4 leading-relaxed">
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
        </details>

        {item.scenario && (
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scenario check</div>
            <p className="rounded-xl bg-muted/40 p-5 leading-7">{item.scenario}</p>
            <p className="text-xs text-muted-foreground">The highlighted option is the correct answer. Selecting another option updates the answer key immediately.</p>
            <div className="grid gap-3">
              {options.map(([letter, text]) => (
                <button
                  key={letter}
                  type="button"
                  disabled={saving}
                  aria-pressed={key === letter}
                  onClick={() => setAnswer(letter)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left leading-relaxed transition-colors hover:bg-accent",
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
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Why: </span>
                {itemKey.rationale}
              </p>
            )}
            {itemKey?.diagnostic && (
              <p className="text-sm leading-relaxed text-muted-foreground">
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
            aria-label="Job title"
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
