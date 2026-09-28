"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Eye, EyeOff, HeartPulse, Loader2, Plus, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCompanyPost, setCompanyPostPublished } from "@/lib/actions/company-engagement";
import { COMPANY_POST_KIND_LABELS, type CompanyPost, type CompanyPostKind } from "@/lib/company-engagement";

type FormState = {
  id?: string;
  kind: CompanyPostKind;
  title: string;
  summary: string;
  details: string;
  recipientName: string;
  startsOn: string;
  endsOn: string;
  ctaLabel: string;
  ctaUrl: string;
  published: boolean;
};

const EMPTY: FormState = { kind: "health_challenge", title: "", summary: "", details: "", recipientName: "", startsOn: "", endsOn: "", ctaLabel: "", ctaUrl: "", published: true };

export function EngagementManager({ posts }: { posts: CompanyPost[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);

  async function save() {
    setBusy("save");
    const result = await saveCompanyPost(form);
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success(form.id ? "Company post updated." : "Company post published.");
    setForm(EMPTY);
    router.refresh();
  }

  function edit(post: CompanyPost) {
    setForm({
      id: post.id,
      kind: post.kind,
      title: post.title,
      summary: post.summary,
      details: post.details ?? "",
      recipientName: post.recipient_name ?? "",
      startsOn: post.starts_on ?? "",
      endsOn: post.ends_on ?? "",
      ctaLabel: post.cta_label ?? "",
      ctaUrl: post.cta_url ?? "",
      published: post.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(post: CompanyPost) {
    setBusy(post.id);
    const result = await setCompanyPostPublished(post.id, !post.published);
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success(post.published ? "Post hidden from dashboards." : "Post published.");
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{form.id ? "Edit company post" : "Create company post"}</CardTitle>
          <CardDescription>Published posts appear on every employee dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2"><Label htmlFor="post-kind">Type</Label><select id="post-kind" className="h-9 rounded-lg border bg-background px-3 text-sm" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as CompanyPostKind })}><option value="health_challenge">Health challenge</option><option value="promotion">Promotion</option><option value="prize">Prize & recognition</option></select></div>
          <div className="grid gap-2"><Label htmlFor="post-title">Title</Label><Input id="post-title" maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
          <div className="grid gap-2"><Label htmlFor="post-summary">Short summary</Label><Textarea id="post-summary" rows={3} maxLength={500} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></div>
          <div className="grid gap-2"><Label htmlFor="post-details">Details</Label><Textarea id="post-details" rows={4} maxLength={3000} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></div>
          {form.kind !== "health_challenge" && <div className="grid gap-2"><Label htmlFor="post-recipient">Employee or team</Label><Input id="post-recipient" maxLength={160} value={form.recipientName} placeholder="Optional" onChange={(event) => setForm({ ...form, recipientName: event.target.value })} /></div>}
          <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="post-start">Start date</Label><Input id="post-start" type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="post-end">End date</Label><Input id="post-end" type="date" value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="post-cta">Link label</Label><Input id="post-cta" maxLength={60} value={form.ctaLabel} placeholder="Join challenge" onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="post-url">Link</Label><Input id="post-url" maxLength={500} value={form.ctaUrl} placeholder="/page or https://..." onChange={(event) => setForm({ ...form, ctaUrl: event.target.value })} /></div></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} />Publish immediately</label>
          <div className="flex flex-wrap gap-2"><Button onClick={() => void save()} disabled={busy != null || !form.title.trim() || !form.summary.trim()}>{busy === "save" ? <Loader2 className="animate-spin" /> : form.id ? <Edit3 /> : <Plus />}{form.id ? "Save changes" : "Publish post"}</Button>{form.id && <Button variant="outline" onClick={() => setForm(EMPTY)}>Cancel editing</Button>}</div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {posts.length ? posts.map((post) => {
          const Icon = post.kind === "health_challenge" ? HeartPulse : post.kind === "promotion" ? Sparkles : Trophy;
          return <Card key={post.id} className={!post.published ? "opacity-65" : undefined}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Icon className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{post.title}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{COMPANY_POST_KIND_LABELS[post.kind]}</span>{!post.published && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Hidden</span>}</div>{post.recipient_name && <p className="mt-1 text-sm font-medium text-violet-700">{post.recipient_name}</p>}<p className="mt-1 text-sm text-muted-foreground">{post.summary}</p><p className="mt-2 text-xs text-muted-foreground">{dateRange(post)}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => edit(post)}><Edit3 />Edit</Button><Button size="sm" variant="ghost" onClick={() => void toggle(post)} disabled={busy === post.id}>{busy === post.id ? <Loader2 className="animate-spin" /> : post.published ? <EyeOff /> : <Eye />}{post.published ? "Hide" : "Publish"}</Button></div></CardContent></Card>;
        }) : <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No company highlights yet. Create the first post using the form.</CardContent></Card>}
      </div>
    </div>
  );
}

function dateRange(post: CompanyPost) {
  if (!post.starts_on && !post.ends_on) return "No scheduled dates";
  const format = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  if (post.starts_on && post.ends_on) return `${format(post.starts_on)} – ${format(post.ends_on)}`;
  return post.starts_on ? `Starts ${format(post.starts_on)}` : `Ends ${format(post.ends_on!)}`;
}
