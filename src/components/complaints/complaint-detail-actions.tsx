"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageSquare, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addComplaintUpdate, escalateComplaintToFaleh, updateComplaint } from "@/lib/actions/complaints";

export function ComplaintDetailActions({
  complaint,
  role,
  isReporter,
}: {
  complaint: {
    id: string;
    status: "submitted" | "under_review" | "escalated" | "resolved" | "closed";
    priority: "low" | "normal" | "high" | "urgent";
    resolution_summary: string | null;
  };
  role: string;
  isReporter: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(role !== "employee" && role !== "manager");
  const [status, setStatus] = useState(
    complaint.status === "submitted" || complaint.status === "escalated" ? "under_review" : complaint.status
  );
  const [priority, setPriority] = useState(complaint.priority);
  const [resolution, setResolution] = useState(complaint.resolution_summary ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function sendMessage() {
    setBusy("message");
    const result = await addComplaintUpdate({ complaint_id: complaint.id, body: message, internal });
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success(internal ? "Internal note added." : "Message sent.");
    setMessage("");
    router.refresh();
  }

  async function saveReview() {
    setBusy("review");
    const result = await updateComplaint({ complaint_id: complaint.id, status, priority, resolution_summary: resolution || null });
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success("Case updated.");
    router.refresh();
  }

  async function escalate() {
    if (!confirm("Escalate this confidential case to Faleh for executive review?")) return;
    setBusy("escalate");
    const result = await escalateComplaintToFaleh(complaint.id);
    setBusy(null);
    if (result.error) return toast.error(result.error);
    if (result.warning) toast.warning(result.warning);
    else toast.success("Case escalated to Faleh.");
    router.refresh();
  }

  const canComment = complaint.status !== "closed";

  return (
    <div className="space-y-6">
      {role === "admin" && complaint.status !== "closed" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">HR case controls</CardTitle>
            <CardDescription>Set ownership through review, record a resolution, or escalate for executive review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="case-status">Status</Label>
                <select id="case-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="under_review">Under review</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="case-priority">Priority</Label>
                <select id="case-priority" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            {status === "resolved" && (
              <div className="grid gap-2">
                <Label htmlFor="resolution">Resolution summary</Label>
                <Textarea id="resolution" rows={4} maxLength={4000} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Summarize the findings, action taken, and any follow-up." />
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="destructive" onClick={escalate} disabled={busy !== null || complaint.status === "escalated"}>
                {busy === "escalate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Escalate to Faleh
              </Button>
              <Button onClick={saveReview} disabled={busy !== null}>
                {busy === "review" && <Loader2 className="h-4 w-4 animate-spin" />} Save case update
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canComment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add message</CardTitle>
            <CardDescription>{isReporter ? "Your message goes directly to HR." : role === "admin" ? "Choose whether the reporter can see this message." : "Add a confidential executive note for HR."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={internal ? "Internal note…" : "Message to the reporter…"} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {role === "admin" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Internal HR note
                </label>
              ) : <span />}
              <Button onClick={sendMessage} disabled={busy !== null || !message.trim()}>
                {busy === "message" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Add message
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
