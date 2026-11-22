-- Follow-ups on a reported issue: a clarification or a screenshot added after it was filed, by the
-- person who reported it (while it's still open) or by Engineering. Shown as a thread on Reported
-- Issues.

CREATE TABLE public.issue_report_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id        uuid NOT NULL REFERENCES public.issue_reports(id) ON DELETE CASCADE,
  author_id       uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  body            text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  -- A screenshot in mariner-uploads, in the author's own folder.
  screenshot_path text CHECK (screenshot_path IS NULL OR char_length(screenshot_path) <= 200),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX issue_report_notes_issue ON public.issue_report_notes (issue_id, created_at);

ALTER TABLE public.issue_report_notes ENABLE ROW LEVEL SECURITY;

-- Whoever can see the issue can see its notes.
CREATE POLICY issue_report_notes_select
  ON public.issue_report_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.issue_reports r
      WHERE r.id = issue_id
        AND (r.reporter_id = public.current_employee_id() OR public.is_engineering_superuser())
    )
  );

-- The reporter adds to their own open report; Engineering to any. Screenshots must be the
-- author's own upload.
CREATE POLICY issue_report_notes_insert
  ON public.issue_report_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = public.current_employee_id()
    AND (screenshot_path IS NULL OR split_part(screenshot_path, '/', 1) = auth.uid()::text)
    AND (
      public.is_engineering_superuser()
      OR EXISTS (
        SELECT 1 FROM public.issue_reports r
        WHERE r.id = issue_id
          AND r.reporter_id = public.current_employee_id()
          AND r.status IN ('open', 'in_progress')
      )
    )
  );

-- Engineering can see screenshots on notes too, as it can on the reports themselves.
DROP POLICY storage_mariner_uploads_select ON storage.objects;
CREATE POLICY storage_mariner_uploads_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mariner-uploads'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        public.is_engineering_superuser()
        AND (
          name IN (SELECT screenshot_path FROM public.issue_reports WHERE screenshot_path IS NOT NULL)
          OR name IN (SELECT screenshot_path FROM public.issue_report_notes WHERE screenshot_path IS NOT NULL)
        )
      )
    )
  );
