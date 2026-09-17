REVOKE ALL ON public.complaints, public.complaint_updates FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.complaints_case_number_seq FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.complaints_case_number_seq TO authenticated;
GRANT SELECT, INSERT ON public.complaint_updates TO authenticated;
