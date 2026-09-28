import Link from "next/link";
import { ArrowUpRight, CalendarDays, HeartPulse, Sparkles, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyPost } from "@/lib/company-engagement";

export function CompanyHighlights({ posts }: { posts: CompanyPost[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const challenges = posts.filter((post) => post.kind === "health_challenge" && (!post.ends_on || post.ends_on >= today));
  const celebrations = posts.filter((post) => post.kind === "promotion" || post.kind === "prize");

  return (
    <section aria-labelledby="company-highlights-heading" className="space-y-4">
      <div>
        <h2 id="company-highlights-heading" className="text-lg font-semibold">Company life</h2>
        <p className="text-sm text-muted-foreground">Join shared wellbeing activities and celebrate colleagues across Dhofar Global.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-background to-background dark:border-emerald-900 dark:from-emerald-950/30">
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"><HeartPulse className="size-5" /></div>
            <CardTitle>Company health challenges</CardTitle>
            <CardDescription>Activities that help us build healthy habits together.</CardDescription>
          </CardHeader>
          <CardContent>
            {challenges.length ? <div className="space-y-3">{challenges.slice(0, 3).map((post) => <Highlight key={post.id} post={post} tone="emerald" />)}</div> : <EmptyHighlight icon={HeartPulse} text="New company health challenges will appear here." />}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-background to-background dark:border-amber-900 dark:from-amber-950/30">
          <CardHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"><Trophy className="size-5" /></div>
            <CardTitle>Promotions and prizes</CardTitle>
            <CardDescription>Celebrate career milestones, achievements, and company recognition.</CardDescription>
          </CardHeader>
          <CardContent>
            {celebrations.length ? <div className="space-y-3">{celebrations.slice(0, 4).map((post) => <Highlight key={post.id} post={post} tone="amber" />)}</div> : <EmptyHighlight icon={Sparkles} text="Promotions, prizes, and recognition will appear here." />}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Highlight({ post, tone }: { post: CompanyPost; tone: "emerald" | "amber" }) {
  const content = <>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{post.title}</p>
        {post.recipient_name && <p className={tone === "emerald" ? "mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300" : "mt-1 text-sm font-medium text-amber-700 dark:text-amber-300"}>{post.recipient_name}</p>}
      </div>
      {post.kind === "prize" && <Trophy className="size-4 shrink-0 text-amber-600" />}
      {post.kind === "promotion" && <Sparkles className="size-4 shrink-0 text-violet-600" />}
    </div>
    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
    {(post.starts_on || post.ends_on) && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{dateRange(post)}</p>}
  </>;
  const className = "block rounded-xl border bg-background/80 p-4 transition-colors hover:bg-background";
  if (post.cta_url && safeLink(post.cta_url)) {
    const callToAction = <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">{post.cta_label || "Learn more"}<ArrowUpRight className="size-3.5" /></span>;
    return post.cta_url.startsWith("/")
      ? <Link href={post.cta_url} className={className}>{content}{callToAction}</Link>
      : <a href={post.cta_url} target="_blank" rel="noreferrer" className={className}>{content}{callToAction}</a>;
  }
  return <div className={className}>{content}</div>;
}

function EmptyHighlight({ icon: Icon, text }: { icon: typeof HeartPulse; text: string }) {
  return <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed bg-background/50 p-6 text-center text-sm text-muted-foreground"><Icon className="mb-2 size-5 opacity-60" />{text}</div>;
}

function safeLink(value: string) {
  if (value.startsWith("/")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function dateRange(post: CompanyPost) {
  const format = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  if (post.starts_on && post.ends_on) return `${format(post.starts_on)} – ${format(post.ends_on)}`;
  return post.starts_on ? `Starts ${format(post.starts_on)}` : `Ends ${format(post.ends_on!)}`;
}
