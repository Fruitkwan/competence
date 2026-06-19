"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RatingSelect } from "./rating-select";
import type { GoalRow } from "@/lib/supabase/performance-appraisal-types";
import { Trash2 } from "lucide-react";

interface GoalRowEditorProps {
  index: number;
  goal: GoalRow;
  onChange: (updated: GoalRow) => void;
  onRemove: () => void;
  canRemove: boolean;
  canEditDetails?: boolean;
  canRateN1?: boolean;
  canRateN2?: boolean;
}

export function GoalRowEditor({
  index,
  goal,
  onChange,
  onRemove,
  canRemove,
  canEditDetails = true,
  canRateN1 = true,
  canRateN2 = true,
}: GoalRowEditorProps) {
  const update = (patch: Partial<GoalRow>) => onChange({ ...goal, ...patch });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">
          Goal {index + 1}
        </span>
        {canRemove && canEditDetails && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            className="text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">
            Goal / Objective
          </label>
          <Input
            value={goal.objective}
            onChange={(e) => update({ objective: e.target.value })}
            placeholder="Describe the goal..."
            readOnly={!canEditDetails}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Key Metric / KPI
          </label>
          <Input
            value={goal.kpi}
            onChange={(e) => update({ kpi: e.target.value })}
            placeholder="e.g. Revenue, NPS..."
            readOnly={!canEditDetails}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Target
          </label>
          <Input
            value={goal.target}
            onChange={(e) => update({ target: e.target.value })}
            placeholder="e.g. $1M, 90%..."
            readOnly={!canEditDetails}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Actual
          </label>
          <Input
            value={goal.actual}
            onChange={(e) => update({ actual: e.target.value })}
            placeholder="Actual result..."
            readOnly={!canEditDetails}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Achievement %
          </label>
          <Input
            value={goal.achievement_pct}
            onChange={(e) => update({ achievement_pct: e.target.value })}
            placeholder="e.g. 95%"
            readOnly={!canEditDetails}
          />
        </div>
      </div>

      {/* Ratings */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Employee Rating (N1)
          </label>
          <RatingSelect
            value={goal.rating_n1}
            onChange={(v) => update({ rating_n1: v })}
            disabled={!canRateN1}
            compact
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Manager Rating (N2)
          </label>
          <RatingSelect
            value={goal.rating_n2}
            onChange={(v) => update({ rating_n2: v })}
            disabled={!canRateN2}
            compact
          />
        </div>
      </div>
    </div>
  );
}
