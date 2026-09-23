"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, CheckCircle2, FileUp, Loader2, Trash2, Undo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteTemplate, setTemplateStatus, uploadAssessmentDocx } from "@/lib/actions/assessments";
import { cn } from "@/lib/utils";

export type TemplateRow = {
  id: string;
  kind: "skill" | "behaviour" | "placement";
  name: string;
  role_family: string | null;
  department: string | null;
  job_titles: string[];
  version: string | null;
  status: "draft" | "published" | "archived";
  source_file_name: string | null;
  published_at: string | null;
  created_at: string;
  item_count: number;
  keyed_count: number;
};

const STATUS_STYLE: Record<TemplateRow["status"], string> = {
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  archived: "bg-muted text-muted-foreground",
};

export function TemplateLibrary({ templates, loadError }: { templates: TemplateRow[]; loadError: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    const result = await uploadAssessmentDocx(new FormData(e.currentTarget));
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const parts = [];
    if (result.created?.length) parts.push(`${result.created.length} template(s) created`);
    if (result.keysApplied) parts.push(`${result.keysApplied} answer key(s) applied`);
    toast.success(parts.join(" · ") || "Done.");
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }

  async function changeStatus(id: string, status: TemplateRow["status"]) {
    setBusyId(id);
    const result = await setTemplateStatus(id, status);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success(status === "published" ? "Published. Employees can now be assigned." : `Marked as ${status}.`);
      router.refresh();
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Move "${name}" to the Recycle Bin?`)) return;
    setBusyId(id);
    const result = await deleteTemplate(id);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Moved to the Recycle Bin.");
      router.refresh();
    }
  }

  const visible = templates.filter((t) => showArchived || t.status !== "archived");
  const archivedCount = templates.length - templates.filter((t) => t.status !== "archived").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{templates.filter((t) => t.status === "published").length} published</span>
          <span>·</span>
          <span>{templates.filter((t) => t.status === "draft").length} draft</span>
          {archivedCount > 0 && (
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Hide" : "Show"} {archivedCount} archived
            </button>
          )}
        </div>
        <Button onClick={() => setOpen(true)}>
          <FileUp className="h-4 w-4" /> Upload instrument
        </Button>
      </div>

      {loadError && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assessment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Answer keys</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No assessments yet. Upload the Skill Assessment and Behaviour Assessment .docx files to get started.
                </TableCell>
              </TableRow>
            )}
            {visible.map((t) => {
              const busy = busyId === t.id;
              const keysMissing = t.item_count - t.keyed_count;
              return (
                <TableRow key={t.id} className={cn(t.status === "archived" && "opacity-60")}>
                  <TableCell>
                    <Link href={`/admin/assessments/${t.id}`} className="font-medium hover:underline">
                      {t.role_family ?? t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {t.version ? `v${t.version}` : ""}
                      {t.kind === "skill" && t.job_titles.length > 0 && ` · ${t.job_titles.length} job title(s)`}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{t.kind}</TableCell>
                  <TableCell>{t.department ?? "All"}</TableCell>
                  <TableCell>{t.item_count}</TableCell>
                  <TableCell>
                    {keysMissing === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t.keyed_count}/{t.item_count}
                      </span>
                    ) : (
                      <span className="text-amber-600">
                        {t.keyed_count}/{t.item_count} missing {keysMissing}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLE[t.status]}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {t.status !== "published" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus(t.id, "published")}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Publish
                        </Button>
                      )}
                      {t.status === "published" && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => changeStatus(t.id, "draft")}>
                          <Undo2 className="h-3.5 w-3.5" /> Unpublish
                        </Button>
                      )}
                      {t.status !== "archived" && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => changeStatus(t.id, "archived")}>
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                      {t.status !== "published" && (
                        <Button size="icon-sm" variant="ghost" disabled={busy} onClick={() => remove(t.id, t.role_family ?? t.name)} aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form ref={formRef} onSubmit={handleUpload}>
            <DialogHeader>
              <DialogTitle>Upload assessment documents</DialogTitle>
              <DialogDescription>
                Use the DG-format Word documents. The Skill Assessment creates one template per role family; the Behaviour
                Assessment creates a single company-wide template. The Scoring Annexe loads answer keys into matching templates.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="instrument">Instrument (.docx)</Label>
                <input
                  id="instrument"
                  name="instrument"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
                />
                <p className="text-xs text-muted-foreground">DG_Skill_Assessment_All_Roles or DG_Behaviour_Assessment.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="annexe">Scoring annexe (.docx, optional)</Label>
                <input
                  id="annexe"
                  name="annexe"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Controlled document. Keys are stored in an admin-only table and never shown to employees.
                </p>
              </div>
            </div>
            <DialogFooter>
              <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? "Parsing…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
