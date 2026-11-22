-- Local-only seed for `supabase db reset`: the organisation and the departments and roles the
-- app and the ITSM service expect. People are added by signing up and through Employees.
-- The ITSM catalogue (services, categories, SLA profiles, skills) is seeded by the Java
-- service's Flyway migration V2, not here.

INSERT INTO public.organizations (id, name, org_type)
VALUES ('00000000-0000-0000-0000-000000000001', 'Spotlite Inc', 'standalone')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, org_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Engineering', 'IT service desk and engineering'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Operations', 'Day-to-day operations')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, department_id, title, access_level, description) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Engineer', 'standard', 'Reports incidents; works them when given a technician profile'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'Engineering Lead', 'admin', 'Runs the service desk queue'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000101', 'IT Manager', 'superuser', 'Configures the system and sees everything'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000102', 'Operations Associate', 'standard', 'Reports incidents')
ON CONFLICT (id) DO NOTHING;

-- First superuser: after the first person has signed in and has an employee row, give them the
-- IT Manager role (unlocks Employees and Company Settings, and makes them a service-desk admin):
--
--   INSERT INTO public.employee_roles (employee_id, role_id, org_id)
--   SELECT id, '00000000-0000-0000-0000-000000000203', org_id FROM public.employees WHERE email = '<their email>';
