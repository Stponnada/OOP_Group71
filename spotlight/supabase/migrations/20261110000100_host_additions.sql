-- What the Spotlight UI and Mariner need on top of the core tables: RLS helper functions,
-- Mariner's chat history, employee profiles, and the employee columns the UI reads.
-- Definitions match the core schema in 20261110000000_host_schema.sql.
-- Additive and idempotent: safe to re-run.

BEGIN;

-- ── Helper functions used by RLS policies ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_employee_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id
  FROM public.employees
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(p_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_roles er
    JOIN public.roles r ON r.id = er.role_id
    WHERE er.employee_id = public.current_employee_id()
      AND (r.role_name = ANY(p_roles) OR r.access_level = 'superuser')
      AND er.is_active = true
  );
$$;

-- ── Mariner chat history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_chats (
  id          uuid PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title       text,
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_chats_employee_recent ON public.agent_chats (employee_id, updated_at DESC);
ALTER TABLE public.agent_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_chats_select_own ON public.agent_chats;
CREATE POLICY agent_chats_select_own ON public.agent_chats FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS agent_chats_insert_own ON public.agent_chats;
CREATE POLICY agent_chats_insert_own ON public.agent_chats FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS agent_chats_update_own ON public.agent_chats;
CREATE POLICY agent_chats_update_own ON public.agent_chats FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id())
  WITH CHECK (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS agent_chats_delete_own ON public.agent_chats;
CREATE POLICY agent_chats_delete_own ON public.agent_chats FOR DELETE TO authenticated
  USING (employee_id = public.current_employee_id());

GRANT ALL ON TABLE public.agent_chats TO authenticated, service_role;

-- ── Employee profiles (read by /employees and Mariner's people tools) ────────
CREATE TABLE IF NOT EXISTS public.employee_profiles (
    employee_id             uuid NOT NULL PRIMARY KEY REFERENCES public.employees(id),
    profile_photo_s3_key    text,
    address                 text,
    emergency_contact_name  varchar(255),
    emergency_contact_phone varchar(30),
    linkedin_url            text,
    bio                     text
);
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_profiles_select ON public.employee_profiles;
CREATE POLICY employee_profiles_select ON public.employee_profiles FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_any_role(ARRAY['CEO','HR_ADMINISTRATOR']));
DROP POLICY IF EXISTS employee_profiles_insert ON public.employee_profiles;
CREATE POLICY employee_profiles_insert ON public.employee_profiles FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.has_any_role(ARRAY['CEO','HR_ADMINISTRATOR']));
DROP POLICY IF EXISTS employee_profiles_update ON public.employee_profiles;
CREATE POLICY employee_profiles_update ON public.employee_profiles FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_any_role(ARRAY['CEO','HR_ADMINISTRATOR']))
  WITH CHECK (employee_id = public.current_employee_id() OR public.has_any_role(ARRAY['CEO','HR_ADMINISTRATOR']));

GRANT ALL ON TABLE public.employee_profiles TO authenticated, service_role;

-- ── Employee columns the UI reads (baseline types) ────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS date_of_birth   date,
  ADD COLUMN IF NOT EXISTS national_id     varchar(100),
  ADD COLUMN IF NOT EXISTS personal_email  varchar(255),
  ADD COLUMN IF NOT EXISTS phone           varchar(30),
  ADD COLUMN IF NOT EXISTS date_of_joining date,
  ADD COLUMN IF NOT EXISTS location        varchar(150),
  ADD COLUMN IF NOT EXISTS timezone        varchar(80) NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS deactivated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by  uuid,
  ADD COLUMN IF NOT EXISTS created_by      uuid,
  ADD COLUMN IF NOT EXISTS designation     varchar(150),
  ADD COLUMN IF NOT EXISTS deleted_by      uuid;

COMMIT;
