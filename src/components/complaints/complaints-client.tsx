"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, LockKeyhole, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitComplaint } from "@/lib/actions/complaints";
import { cn } from "@/lib/utils";

export type ComplaintListRow = {
  id: string;
  case_number: number;
  reporter_name: string;
  subject_name: string | null;
  category: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "submitted" | "under_review" | "escalated" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
};

type Subject = { employee_id: string; full_name: string; relation: "manager" | "direct_report" };

const STATUS_LABEL: Record<ComplaintListRow["status"], string> = {
  submitted: "Submitted",
  under_review: "Under review",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_STYLE: Record<ComplaintListRow["status"], string> = {
  submitted: "border-amber-300 bg-amber-50 text-amber-800",
  under_review: "border-blue-300 bg-blue-50 text-blue-800",
  escalated: "border-red-300 bg-red-50 text-red-800",
  resolved: "border-emerald-300 bg-emerald-50 text-emerald-800",
  closed: "border-slate-300 bg-slate-50 text-slate-700",
};

export function ComplaintsClient({
  role,
  subjects,
  complaints,
}: {
  role: string;
  subjects: Subject[];
  complaints: ComplaintListRow[];
}) {
  const router = useRouter();
  const canSubmit = role === "employee" || role === "manager";
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState("workplace");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!acknowledged) return toast.error("Confirm that the information is accurate before submitting.");
    setSaving(true);
    const result = await submitComplaint({
      subject_employee_id: subjectId || null,
      category,
      title,
      description,
      requested_outcome: outcome || null,
    });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    toast.success(`${result.reference} was submitted confidentially to HR.`);
    setShowForm(false);
    setSubjectId("");
    setTitle("");
    setDescription("");
    setOutcome("");
    setAcknowledged(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/[0.025]">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Confidential case channel</p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Complaints go directly to HR. The person named in the complaint and their manager cannot see the case. HR may escalate it to Faleh when executive review is required.
              </p>
            </div>
          </div>
          {canSubmit && (
            <Button onClick={() => setShowForm((value) => !value)}>
              <Plus className="h-4 w-4" /> {showForm ? "Cancel" : "Raise complaint"}
            </Button>
          )}
        </CardContent>
      </Card>

      {canSubmit && showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New confidential complaint</CardTitle>
            <CardDescription>Give HR enough factual detail to assess and follow up on the concern.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="complaint-category">Category</Label>
                <select id="complaint-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="workplace">Workplace concern</option>
                  <option value="management">Management concern</option>
                  <option value="conduct">Conduct</option>
                  <option value="harassment">Harassment</option>
                  <option value="discrimination">Discrimination</option>
                  <option value="safety">Health or safety</option>
                  <option value="ethics">Ethics or compliance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="complaint-subject">Person involved (optional)</Label>
                <select id="complaint-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">General concern / not listed</option>
                  {subjects.map((subject) => (
                    <option key={subject.employee_id} value={subject.employee_id}>
                      {subject.full_name} · {subject.relation === "manager" ? "My manager" : "Direct report"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {role === "manager" ? "Managers may select their own manager or a direct report." : "Your manager appears here when their employee record can be matched."}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="complaint-title">Short title</Label>
              <Input id="complaint-title" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Briefly describe the concern" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="complaint-description">What happened?</Label>
              <Textarea id="complaint-description" rows={7} maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Include dates, locations, people involved, what was said or done, and any steps already taken." />
              <p className="text-right text-xs text-muted-foreground">{description.length}/10,000</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="complaint-outcome">Requested outcome (optional)</Label>
              <Textarea id="complaint-outcome" rows={3} maxLength={2000} value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="What support or resolution would you like HR to consider?" />
            </div>
            <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              <span>I confirm this information is accurate to the best of my knowledge. I understand HR may contact me for clarification.</span>
            </label>
            <div className="flex justify-end">
              <Button onClick={submit} disabled={saving || title.trim().length < 5 || description.trim().length < 20 || !acknowledged}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                Submit securely to HR
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{role === "admin" ? "HR case queue" : role === "executive" ? "Escalated cases" : "My complaints"}</CardTitle>
          <CardDescription>{complaints.length} confidential {complaints.length === 1 ? "case" : "cases"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {complaints.length === 0 && (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              <AlertTriangle className="mx-auto mb-2 h-5 w-5" /> No complaint cases to show.
            </div>
          )}
          {complaints.map((complaint) => (
            <Link key={complaint.id} href={`/complaints/${complaint.id}`} className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">CMP-{String(complaint.case_number).padStart(6, "0")}</span>
                  <Badge variant="outline" className={cn(STATUS_STYLE[complaint.status])}>{STATUS_LABEL[complaint.status]}</Badge>
                  {complaint.priority === "urgent" && <Badge variant="destructive">Urgent</Badge>}
                </div>
                <p className="mt-2 font-medium">{complaint.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {role === "admin" && `${complaint.reporter_name} · `}{complaint.subject_name ? `Regarding ${complaint.subject_name} · ` : ""}{complaint.category.replace("_", " ")} · {new Date(complaint.created_at).toLocaleDateString()}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
