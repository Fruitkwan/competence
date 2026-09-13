"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function CertificateUpload({
  assignmentId,
  employeeId,
  initialUrl,
}: {
  assignmentId: string;
  employeeId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${employeeId}/${assignmentId}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("certificates").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Update the assignment record
    const { error: updateError } = await supabase
      .from("employee_courses")
      .update({ certificate_url: publicUrl })
      .eq("id", assignmentId);

    if (updateError) {
      toast.error(updateError.message);
    } else {
      setUrl(publicUrl);
      toast.success("Certificate uploaded successfully!");
    }
    setUploading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleUpload}
      />
      {url ? (
        <>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileCheck className="h-3.5 w-3.5" />
            View
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Replace"}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          Upload
        </Button>
      )}
    </div>
  );
}
