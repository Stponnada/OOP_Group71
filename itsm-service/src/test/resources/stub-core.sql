-- A minimal stand-in for Spotlight's core `public` schema, used by local runs and
-- Testcontainers. Only the tables and columns the ITSM service actually reads or references.
-- NOT a replacement for the real schema: never run this against production.

CREATE TABLE public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    org_type varchar(50) NOT NULL DEFAULT 'standalone',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(150) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id),
    title varchar(150) NOT NULL,
    access_level varchar(20) NOT NULL CHECK (access_level IN ('standard','admin','superuser')),
    role_name varchar(100),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid,
    first_name varchar(150) NOT NULL,
    last_name varchar(150) NOT NULL,
    email varchar(255) NOT NULL,
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    is_active boolean NOT NULL DEFAULT true,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.employees(id),
    role_id uuid NOT NULL REFERENCES public.roles(id),
    is_active boolean NOT NULL DEFAULT true,
    activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL,
    sender_id uuid,
    notification_type varchar(60) NOT NULL,
    title varchar(255) NOT NULL,
    body text NOT NULL,
    reference_table varchar(100),
    reference_id uuid,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid,
    action varchar(60) NOT NULL,
    table_name varchar(100) NOT NULL,
    record_id uuid NOT NULL,
    old_values jsonb,
    new_values jsonb NOT NULL,
    ip_address varchar(45),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- One org, one Engineering department, three people: an employee, a technician, an admin.
INSERT INTO public.organizations (id, name, org_type)
VALUES ('00000000-0000-0000-0000-000000000001', 'Spotlite Inc', 'standalone');

INSERT INTO public.departments (id, name) VALUES
    ('00000000-0000-0000-0000-0000000000d1', 'Engineering'),
    ('00000000-0000-0000-0000-0000000000d2', 'Finance');

INSERT INTO public.roles (id, department_id, title, access_level, role_name) VALUES
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'Engineer', 'standard', 'EMPLOYEE'),
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', 'Engineering Lead', 'superuser', 'ENGINEERING_LEAD'),
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d2', 'Finance Admin', 'standard', 'FINANCE');

INSERT INTO public.employees (id, auth_user_id, first_name, last_name, email, org_id) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000a001', 'Asha', 'Rao', 'asha@example.com', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000a002', 'Omar', 'Sheikh', 'omar@example.com', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000a003', 'Leela', 'Nair', 'leela@example.com', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.employee_roles (employee_id, role_id) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a2');
