-- Images people give Mariner in a chat. Each person writes only under their own folder
-- (<auth user id>/<upload id>.jpg) and reads only their own. When Mariner attaches one to a record
-- (a purchase request picture, a vendor bill), it copies the image into that record's bucket as the
-- user, so the record's own storage rules apply from then on.

-- A screenshot the reporter gave with the report (a path in mariner-uploads, in their own folder).
ALTER TABLE public.issue_reports
  ADD COLUMN screenshot_path text CHECK (screenshot_path IS NULL OR char_length(screenshot_path) <= 200);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('mariner-uploads', 'mariner-uploads', false, 10485760, '{image/jpeg}'::text[])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_mariner_uploads_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mariner-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY storage_mariner_uploads_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mariner-uploads'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      -- Engineering sees screenshots attached to reported issues.
      OR (public.is_engineering_superuser() AND name IN (SELECT screenshot_path FROM public.issue_reports WHERE screenshot_path IS NOT NULL))
    )
  );

CREATE POLICY storage_mariner_uploads_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mariner-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Re-state the insert rule so a report can only point at the reporter's own upload.
DROP POLICY issue_reports_insert_own ON public.issue_reports;
CREATE POLICY issue_reports_insert_own
  ON public.issue_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = public.current_employee_id()
    AND status = 'open'
    AND resolution_note IS NULL
    AND resolved_by IS NULL
    AND resolved_at IS NULL
    AND (screenshot_path IS NULL OR split_part(screenshot_path, '/', 1) = auth.uid()::text)
  );
