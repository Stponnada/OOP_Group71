-- Problems people hit with Spotlight itself: a bug, a broken page, something confusing. Anyone
-- can file one (from the sidebar or by telling Mariner); Engineering superusers see every report
-- and work it to a close. Reporters can see their own, so they know it landed.

-- Engineering superusers: an active superuser role in the Engineering department.
CREATE OR REPLACE FUNCTION public.is_engineering_superuser() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    JOIN public.departments d ON d.id = r.department_id
    WHERE er.employee_id = public.current_employee_id()
      AND er.is_active
      AND r.access_level = 'superuser'
      AND d.name = 'Engineering'
  );
$$;

REVOKE ALL ON FUNCTION public.is_engineering_superuser() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_engineering_superuser() TO authenticated, service_role;

CREATE TABLE public.issue_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  description     text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),
  -- The page the reporter was on, e.g. /incidents/new, when we know it.
  page_path       text CHECK (page_path IS NULL OR char_length(page_path) <= 500),
  source          text NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'mariner')),
  user_agent      text CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'fixed', 'wont_fix')),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  resolved_by     uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX issue_reports_status_recent ON public.issue_reports (status, created_at DESC);
CREATE INDEX issue_reports_reporter ON public.issue_reports (reporter_id, created_at DESC);

ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY issue_reports_insert_own
  ON public.issue_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = public.current_employee_id()
    AND status = 'open'
    AND resolution_note IS NULL
    AND resolved_by IS NULL
    AND resolved_at IS NULL
  );

CREATE POLICY issue_reports_select
  ON public.issue_reports FOR SELECT
  TO authenticated
  USING (reporter_id = public.current_employee_id() OR public.is_engineering_superuser());

CREATE POLICY issue_reports_update_engineering
  ON public.issue_reports FOR UPDATE
  TO authenticated
  USING (public.is_engineering_superuser())
  WITH CHECK (public.is_engineering_superuser());
