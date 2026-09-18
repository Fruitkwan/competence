"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getComplaintEvidenceUrl, uploadComplaintEvidence } from "@/lib/actions/complaints";

type Attachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ComplaintAttachments({ complaintId, attachments, canUpload }: { complaintId: string; attachments: Attachment[]; canUpload: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload() {
    const formData = new FormData();
    files.forEach((file) => formData.append("evidence", file));
    setBusy("upload");
    const result = await uploadComplaintEvidence(complaintId, formData);
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success(`${result.uploaded?.length ?? 0} evidence file${result.uploaded?.length === 1 ? "" : "s"} uploaded.`);
    setFiles([]);
    setInputKey((value) => value + 1);
    router.refresh();
  }

  async function open(attachment: Attachment) {
    setBusy(attachment.id);
    const result = await getComplaintEvidenceUrl(attachment.id);
    setBusy(null);
    if (result.error || !result.url) return toast.error(result.error ?? "Could not open evidence file.");
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Paperclip className="h-4 w-4" /> Evidence</CardTitle>
        <CardDescription>Evidence is stored privately and is available only to authorized case participants.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachments.length === 0 ? <p className="text-sm text-muted-foreground">No evidence files attached.</p> : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{attachment.file_name}</p><p className="text-xs text-muted-foreground">{fileSize(attachment.size_bytes)} · {new Date(attachment.created_at).toLocaleString()}</p></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => open(attachment)} disabled={busy !== null}>
                  {busy === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Open
                </Button>
              </div>
            ))}
          </div>
        )}
        {canUpload && attachments.length < 10 && (
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <Input key={inputKey} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Up to 3 files per upload, 10 files per case, and 10 MB per file.</p>
              <Button size="sm" onClick={upload} disabled={!files.length || busy !== null}>
                {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload evidence
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
