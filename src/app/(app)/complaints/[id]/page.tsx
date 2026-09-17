import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplaintDetailActions } from "@/components/complaints/complaint-detail-actions";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  submitted: "border-amber-300 bg-amber-50 text-amber-800",
  under_review: "border-blue-300 bg-blue-50 text-blue-800",
  escalated: "border-red-300 bg-red-50 text-red-800",
  resolved: "border-emerald-300 bg-emerald-50 text-emerald-800",
  closed: "border-slate-300 bg-slate-50 text-slate-700",
};

export default async function ComplaintDetailPage(props: PageProps<"/complaints/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/complaints/${id}`);

  const [{ data: profile }, { data: complaint }] = await Promise.all([
    supabase.from("profiles").select("id, role").eq("id", user.id).single(),
    supabase.from("complaints").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!profile || !complaint) notFound();
  const { data: updates } = await supabase
    .from("complaint_updates")
    .select("id, author_name, kind, visibility, body, created_at")
    .eq("complaint_id", complaint.id)
    .order("created_at");

  const reference = `CMP-${String(complaint.case_number).padStart(6, "0")}`;
  const isReporter = complaint.reporter_id === profile.id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/complaints" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Complaint cases</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Confidential · {reference}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{complaint.title}</h1>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={cn(STATUS_STYLE[complaint.status])}>{complaint.status.replace("_", " ")}</Badge>
            <Badge variant={complaint.priority === "urgent" ? "destructive" : "outline"}>{complaint.priority}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Case details</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted-foreground">Submitted by</dt><dd className="mt-1 font-medium">{complaint.reporter_name}</dd></div>
            <div><dt className="text-muted-foreground">Person involved</dt><dd className="mt-1 font-medium">{complaint.subject_name ?? "General concern"}</dd></div>
            <div><dt className="text-muted-foreground">Category</dt><dd className="mt-1 font-medium capitalize">{complaint.category}</dd></div>
            <div><dt className="text-muted-foreground">Submitted</dt><dd className="mt-1 font-medium">{new Date(complaint.created_at).toLocaleString()}</dd></div>
          </dl>
          <div><h2 className="text-sm font-medium">Description</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{complaint.description}</p></div>
          {complaint.requested_outcome && <div><h2 className="text-sm font-medium">Requested outcome</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{complaint.requested_outcome}</p></div>}
          {complaint.escalated_at && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Escalated to {complaint.escalated_to_name ?? "Faleh"} on {new Date(complaint.escalated_at).toLocaleString()}.</div>}
          {complaint.resolution_summary && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><h2 className="text-sm font-medium text-emerald-900">Resolution</h2><p className="mt-1 whitespace-pre-wrap text-sm text-emerald-800">{complaint.resolution_summary}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Case timeline</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-l-2 border-primary/30 pl-4"><p className="text-sm font-medium">Complaint submitted</p><p className="text-xs text-muted-foreground">{new Date(complaint.created_at).toLocaleString()}</p></div>
          {(updates ?? []).map((update) => (
            <div key={update.id} className="border-l-2 border-muted pl-4">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{update.author_name}</p>{update.visibility === "internal" && <Badge variant="outline">Internal</Badge>}<span className="text-xs capitalize text-muted-foreground">{update.kind}</span></div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{update.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(update.created_at).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <ComplaintDetailActions complaint={complaint} role={profile.role} isReporter={isReporter} />
    </div>
  );
}
