"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveObjective, requestRevision, rejectObjective } from "@/lib/actions/objectives";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OBJECTIVE_STATUS_LABELS, type ObjectiveStatus } from "@/lib/constants/roles";

const statusColor: Record<ObjectiveStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  revision_requested: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

type ObjectiveReviewData = {
  id: string;
  title: string;
  description: string | null;
  success_criteria: string | null;
  weight: number;
  status: ObjectiveStatus;
  kpi_title?: string | null;
  comments?: { id: string; body: string; created_at: string; author_name: string | null }[];
};

export function ObjectiveReviewCard({
  objective,
}: {
  objective: ObjectiveReviewData;
}) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const canAct = objective.status === "submitted" || objective.status === "revision_requested";

  function handleApprove() {
    startTransition(async () => {
      const res = await approveObjective(objective.id);
      if (res?.error) toast.error(res.error);
      else toast.success("Objective approved");
    });
  }

  function handleRevision() {
    if (!comment.trim()) {
      toast.error("Please add a comment explaining the revision needed");
      return;
    }
    startTransition(async () => {
      const res = await requestRevision(objective.id, comment);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Revision requested");
        setComment("");
        setShowComment(false);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectObjective(objective.id, comment);
      if (res?.error) toast.error(res.error);
      else toast.success("Objective rejected");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{objective.title}</CardTitle>
            {objective.kpi_title && (
              <div className="mt-1 text-xs text-muted-foreground">
                Linked KPI: {objective.kpi_title}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {objective.weight}%
            </span>
            <Badge
              variant="outline"
              className={cn("border-0", statusColor[objective.status])}
            >
              {OBJECTIVE_STATUS_LABELS[objective.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {objective.description && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Description</div>
            <p className="text-sm">{objective.description}</p>
          </div>
        )}
        {objective.success_criteria && (
          <div>
            <div className="text-xs font-medium text-muted-foreground">Success Criteria</div>
            <p className="text-sm">{objective.success_criteria}</p>
          </div>
        )}

        {/* Comments thread */}
        {objective.comments && objective.comments.length > 0 && (
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Comments</div>
            {objective.comments.map((c) => (
              <div key={c.id} className="mb-2 text-sm">
                <span className="font-medium">{c.author_name ?? "Unknown"}</span>
                <span className="text-muted-foreground"> · {new Date(c.created_at).toLocaleDateString()}</span>
                <p className="mt-0.5">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Manager actions */}
        {canAct && (
          <div className="space-y-2 border-t pt-3">
            {showComment ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowComment(false); setComment(""); }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRevision}
                    disabled={isPending}
                  >
                    Request Revision
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleApprove} disabled={isPending}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowComment(true)}
                >
                  Comment / Revise
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
