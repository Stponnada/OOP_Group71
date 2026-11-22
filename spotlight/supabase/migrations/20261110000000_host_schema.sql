-- The core tables Spotlight runs on: organisations, departments, roles, employees and their
-- role assignments, notifications, audit log and email queue. Column shapes come from the
-- schema the rest of the app was designed against.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name varchar(255) NOT NULL,
    parent_org_id uuid,
    org_type varchar(50) NOT NULL DEFAULT 'standalone',
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    name varchar(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    department_id uuid NOT NULL REFERENCES public.departments(id),
    title varchar(150) NOT NULL,
    access_level varchar(20) NOT NULL CHECK (access_level IN ('standard','admin','superuser')),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    role_name varchar(100)
);

CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    auth_user_id uuid,
    employee_code varchar(20),
    first_name varchar(150) NOT NULL,
    last_name varchar(150) NOT NULL,
    email varchar(255) NOT NULL UNIQUE,
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.employee_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    role_id uuid NOT NULL REFERENCES public.roles(id),
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    assigned_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    activated_at timestamptz DEFAULT now() NOT NULL,
    deactivated_at timestamptz DEFAULT '9999-12-31 00:00:00+00' NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    recipient_id uuid NOT NULL,
    sender_id uuid,
    notification_type varchar(60) NOT NULL,
    title varchar(255) NOT NULL,
    body text NOT NULL,
    reference_table varchar(100),
    reference_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    employee_id uuid,
    action varchar(60) NOT NULL,
    table_name varchar(100) NOT NULL,
    record_id uuid NOT NULL,
    old_values jsonb,
    new_values jsonb NOT NULL,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    to_email varchar(255) NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    reference_table varchar(100),
    reference_id uuid,
    status varchar(10) DEFAULT 'queued' NOT NULL,
    sent_at timestamptz,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- If the ITSM service's Flyway migrations ran before this file (as they did on the hosted
-- project), its foreign keys into public were skipped; add them now. On a fresh stack the itsm
-- schema doesn't exist yet and Flyway adds these keys itself when the service first starts.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'itsm') THEN
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
        BEGIN ALTER TABLE itsm.incidents ADD CONSTRAINT incidents_reporter_fk FOREIGN KEY (reporter_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.incidents ADD CONSTRAINT incidents_technician_fk FOREIGN KEY (assigned_technician_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.technician_profiles ADD CONSTRAINT technician_profiles_employee_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.technician_profiles ADD CONSTRAINT technician_profiles_lead_fk FOREIGN KEY (team_lead_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.incident_transitions ADD CONSTRAINT incident_transitions_actor_fk FOREIGN KEY (actor_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.incident_notes ADD CONSTRAINT incident_notes_author_fk FOREIGN KEY (author_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.incident_feedback ADD CONSTRAINT incident_feedback_author_fk FOREIGN KEY (submitted_by) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.escalations ADD CONSTRAINT escalations_from_fk FOREIGN KEY (from_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.escalations ADD CONSTRAINT escalations_to_fk FOREIGN KEY (to_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TABLE itsm.assignment_cursor ADD CONSTRAINT assignment_cursor_employee_fk FOREIGN KEY (last_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') THEN
        BEGIN ALTER TABLE itsm.incidents ADD CONSTRAINT incidents_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id); EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='departments') THEN
        BEGIN ALTER TABLE itsm.service_catalog ADD CONSTRAINT service_catalog_department_fk FOREIGN KEY (owner_department_id) REFERENCES public.departments(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END $$;
