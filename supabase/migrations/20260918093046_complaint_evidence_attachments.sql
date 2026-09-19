CREATE TABLE public.complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX complaint_attachments_case_idx
  ON public.complaint_attachments(complaint_id, created_at);

ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.complaint_attachments FROM anon, authenticated;
GRANT SELECT ON public.complaint_attachments TO authenticated;

CREATE POLICY complaint_attachments_read_authorized
ON public.complaint_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.complaints complaint
    JOIN public.profiles viewer ON viewer.id = (SELECT auth.uid())
    WHERE complaint.id = complaint_attachments.complaint_id
      AND (
        complaint.reporter_id = viewer.id
        OR viewer.role = 'admin'
        OR (
          complaint.status = 'escalated'
          AND viewer.role = 'executive'
          AND (complaint.escalated_to = viewer.id OR lower(coalesce(viewer.full_name, '')) LIKE '%faleh%')
        )
      )
  )
);
