"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RatingSelect } from "./rating-select";
import type { CompetencyEntry, RatingValue } from "@/lib/supabase/performance-appraisal-types";

interface CompetencyRowProps {
  name: string;
  entry: CompetencyEntry;
  onChange: (updated: CompetencyEntry) => void;
}

export function CompetencyRow({ name, entry, onChange }: CompetencyRowProps) {
  const update = (patch: Partial<CompetencyEntry>) =>
    onChange({ ...entry, ...patch });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-sm font-semibold">{name}</div>

      {/* Ratings row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Employee Rating (N1)
          </label>
          <RatingSelect
            value={entry.rating_n1}
            onChange={(v) => update({ rating_n1: v })}
            compact
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Manager Rating (N2)
          </label>
          <RatingSelect
            value={entry.rating_n2}
            onChange={(v) => update({ rating_n2: v })}
            compact
          />
        </div>
      </div>

      {/* Comments row */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Employee Comments
          </label>
          <Textarea
            value={entry.comments_n1}
            onChange={(e) => update({ comments_n1: e.target.value })}
            rows={2}
            placeholder="Self-assessment comments..."
            className="text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Manager Comments
          </label>
          <Textarea
            value={entry.comments_n2}
            onChange={(e) => update({ comments_n2: e.target.value })}
            rows={2}
            placeholder="Manager observations..."
            className="text-sm"
          />
        </div>
      </div>

      {/* Evidence */}
      <div className="mt-3">
        <label className="mb-1 block text-xs text-muted-foreground">
          Supporting Evidence / Observations
        </label>
        <Input
          value={entry.evidence}
          onChange={(e) => update({ evidence: e.target.value })}
          placeholder="Evidence and specific examples..."
          className="text-sm"
        />
      </div>
    </div>
  );
}
