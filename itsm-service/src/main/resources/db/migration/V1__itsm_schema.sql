-- =====================================================================================
-- I-ITSM core schema.
--
-- This migration owns the `itsm` schema and nothing else. It reads from `public`
-- (employees, departments, organizations) and writes to `public.notifications` and
-- `public.audit_log`, but it never alters them. The core tables have their own
-- Supabase migrations; the two chains must never overlap.
-- =====================================================================================

CREATE SCHEMA IF NOT EXISTS itsm;

-- Fuzzy matching for duplicate detection. Optional: if the extension is unavailable the
-- service falls back to its in-Java similarity scorer, so this must not break the deploy.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm unavailable - duplicate detection will use the Java fallback';
END $$;

-- ------------------------------------------------------------------ helpers

CREATE OR REPLACE FUNCTION itsm.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS itsm.incident_reference_seq START 1;

CREATE OR REPLACE FUNCTION itsm.next_incident_reference(p_year int) RETURNS text
    LANGUAGE sql AS $$
    SELECT 'INC-' || p_year::text || '-' || lpad(nextval('itsm.incident_reference_seq')::text, 6, '0');
$$;

-- ------------------------------------------------------------------ catalog

CREATE TABLE itsm.skills (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(40)  NOT NULL UNIQUE,
    name        varchar(120) NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE itsm.sla_profiles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(40)  NOT NULL UNIQUE,
    name        varchar(120) NOT NULL,
    description text,
    is_active   boolean      NOT NULL DEFAULT true,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE itsm.sla_targets (
    sla_profile_id     uuid NOT NULL REFERENCES itsm.sla_profiles(id) ON DELETE CASCADE,
    priority           varchar(2) NOT NULL CHECK (priority IN ('P1','P2','P3','P4')),
    response_minutes   integer NOT NULL CHECK (response_minutes > 0),
    resolution_minutes integer NOT NULL CHECK (resolution_minutes >= response_minutes),
    warning_percent    integer NOT NULL DEFAULT 75 CHECK (warning_percent BETWEEN 1 AND 100),
    PRIMARY KEY (sla_profile_id, priority)
);

CREATE TABLE itsm.service_categories (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code           varchar(40)  NOT NULL UNIQUE,
    name           varchar(120) NOT NULL,
    description    text,
    sort_order     integer      NOT NULL DEFAULT 0,
    is_active      boolean      NOT NULL DEFAULT true,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE itsm.service_catalog (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(40)  NOT NULL UNIQUE,
    name                 varchar(160) NOT NULL,
    description          text,
    category_id          uuid NOT NULL REFERENCES itsm.service_categories(id),
    owner_department_id  uuid,
    business_criticality varchar(24) NOT NULL
                         CHECK (business_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL','REVENUE_OR_REGULATED')),
    sla_profile_id       uuid REFERENCES itsm.sla_profiles(id),
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_catalog_category ON itsm.service_catalog (category_id);

-- Which skills an incident on this service needs. Drives skill-based assignment.
CREATE TABLE itsm.service_required_skills (
    service_id uuid NOT NULL REFERENCES itsm.service_catalog(id) ON DELETE CASCADE,
    skill_id   uuid NOT NULL REFERENCES itsm.skills(id) ON DELETE CASCADE,
    weight     numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
    PRIMARY KEY (service_id, skill_id)
);

-- ------------------------------------------------------------------ technicians

CREATE TABLE itsm.technician_profiles (
    employee_id          uuid PRIMARY KEY,
    team_lead_id         uuid,
    max_active_incidents integer NOT NULL DEFAULT 5 CHECK (max_active_incidents > 0),
    experience_years     integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    is_available         boolean NOT NULL DEFAULT true,
    timezone             varchar(80) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE itsm.technician_skills (
    employee_id uuid NOT NULL REFERENCES itsm.technician_profiles(employee_id) ON DELETE CASCADE,
    skill_id    uuid NOT NULL REFERENCES itsm.skills(id) ON DELETE CASCADE,
    proficiency smallint NOT NULL CHECK (proficiency BETWEEN 1 AND 5),
    PRIMARY KEY (employee_id, skill_id)
);

CREATE TABLE itsm.technician_services (
    employee_id  uuid NOT NULL REFERENCES itsm.technician_profiles(employee_id) ON DELETE CASCADE,
    service_id   uuid NOT NULL REFERENCES itsm.service_catalog(id) ON DELETE CASCADE,
    last_worked_at timestamptz,
    PRIMARY KEY (employee_id, service_id)
);

-- Round-robin state, per category so a new category starts clean.
CREATE TABLE itsm.assignment_cursor (
    service_id       uuid PRIMARY KEY REFERENCES itsm.service_catalog(id) ON DELETE CASCADE,
    last_employee_id uuid,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ incidents

CREATE TABLE itsm.incidents (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference              varchar(32) NOT NULL UNIQUE,
    org_id                 uuid NOT NULL,
    reporter_id            uuid,

    category_id            uuid REFERENCES itsm.service_categories(id),
    service_id             uuid REFERENCES itsm.service_catalog(id),
    title                  varchar(200) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 200),
    description            text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),

    impact                 varchar(16) NOT NULL
                           CHECK (impact IN ('MINIMAL','MINOR','MAJOR','EXTENSIVE')),
    urgency                varchar(16) NOT NULL
                           CHECK (urgency IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    business_criticality   varchar(24) NOT NULL
                           CHECK (business_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL','REVENUE_OR_REGULATED')),
    affected_users         integer NOT NULL DEFAULT 1 CHECK (affected_users >= 0),

    priority               varchar(2) NOT NULL CHECK (priority IN ('P1','P2','P3','P4')),
    priority_score         numeric(10,2) NOT NULL CHECK (priority_score >= 0),
    priority_factors       jsonb NOT NULL DEFAULT '{}'::jsonb,
    priority_explanation   text,

    status                 varchar(16) NOT NULL DEFAULT 'NEW'
                           CHECK (status IN ('NEW','CLASSIFIED','ASSIGNED','ACKNOWLEDGED',
                                             'IN_PROGRESS','RESOLVED','VERIFIED','CLOSED','CANCELLED')),
    assigned_technician_id uuid,
    assigned_at            timestamptz,
    acknowledged_at        timestamptz,
    first_response_at      timestamptz,
    resolved_at            timestamptz,
    verified_at            timestamptz,
    closed_at              timestamptz,
    cancelled_at           timestamptz,
    resolution_note        text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 4000),
    cancellation_reason    text,

    sla_profile_id         uuid REFERENCES itsm.sla_profiles(id),
    sla_started_at         timestamptz,
    -- Snapshotted from the policy at classification time: changing a profile later must not
    -- retroactively move this incident's warning threshold.
    warning_percent        integer NOT NULL DEFAULT 75 CHECK (warning_percent BETWEEN 1 AND 100),
    response_due_at        timestamptz,
    resolution_due_at      timestamptz,
    response_breached      boolean NOT NULL DEFAULT false,
    resolution_breached    boolean NOT NULL DEFAULT false,
    escalation_level       smallint NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 3),

    version                bigint NOT NULL DEFAULT 0,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),

    -- Defence in depth: these mirror the aggregate's invariants at the storage layer, so a
    -- bug in the service (or a manual SQL edit) cannot produce an impossible incident.
    CONSTRAINT incidents_classified_beyond_new
        CHECK (status = 'NEW' OR (category_id IS NOT NULL AND service_id IS NOT NULL)),
    CONSTRAINT incidents_working_has_technician
        CHECK (status NOT IN ('ASSIGNED','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','VERIFIED','CLOSED')
               OR assigned_technician_id IS NOT NULL),
    CONSTRAINT incidents_resolved_has_note
        CHECK (status <> 'RESOLVED' OR resolution_note IS NOT NULL),
    CONSTRAINT incidents_closed_was_verified
        CHECK (status <> 'CLOSED' OR verified_at IS NOT NULL),
    CONSTRAINT incidents_cancelled_has_reason
        CHECK (status <> 'CANCELLED' OR cancellation_reason IS NOT NULL),
    CONSTRAINT incidents_sla_window_ordered
        CHECK (resolution_due_at IS NULL OR response_due_at IS NULL OR resolution_due_at >= response_due_at)
);

CREATE INDEX incidents_open_queue
    ON itsm.incidents (priority, created_at)
    WHERE status NOT IN ('CLOSED','CANCELLED');
CREATE INDEX incidents_by_technician
    ON itsm.incidents (assigned_technician_id, status);
CREATE INDEX incidents_by_reporter
    ON itsm.incidents (reporter_id, created_at DESC);
CREATE INDEX incidents_by_service
    ON itsm.incidents (service_id, created_at DESC);
CREATE INDEX incidents_by_status
    ON itsm.incidents (status, created_at DESC);
CREATE INDEX incidents_due
    ON itsm.incidents (resolution_due_at)
    WHERE status NOT IN ('CLOSED','CANCELLED');
CREATE TRIGGER incidents_touch BEFORE UPDATE ON itsm.incidents
    FOR EACH ROW EXECUTE FUNCTION itsm.touch_updated_at();

-- Free-text duplicate search. Guarded so a database without pg_trgm still migrates.
DO $$
BEGIN
    CREATE INDEX incidents_title_trgm ON itsm.incidents USING gin (title gin_trgm_ops);
    CREATE INDEX incidents_description_trgm ON itsm.incidents USING gin (description gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trigram indexes skipped';
END $$;

-- ------------------------------------------------------------------ history

CREATE TABLE itsm.incident_transitions (
    id          bigserial PRIMARY KEY,
    incident_id uuid NOT NULL REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    from_status varchar(16) NOT NULL,
    to_status   varchar(16) NOT NULL,
    actor_id    uuid,
    reason      text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incident_transitions_incident ON itsm.incident_transitions (incident_id, occurred_at);

CREATE TABLE itsm.incident_notes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id uuid NOT NULL REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    author_id   uuid,
    kind        varchar(20) NOT NULL
                CHECK (kind IN ('INVESTIGATION','INFO_REQUEST','INFO_RESPONSE','RESOLUTION','INTERNAL')),
    body        text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incident_notes_incident ON itsm.incident_notes (incident_id, created_at);

CREATE TABLE itsm.incident_attachments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id  uuid NOT NULL REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    note_id      uuid REFERENCES itsm.incident_notes(id) ON DELETE CASCADE,
    storage_path text NOT NULL CHECK (char_length(storage_path) <= 300),
    uploaded_by  uuid,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE itsm.incident_links (
    incident_id         uuid NOT NULL REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    related_incident_id uuid NOT NULL REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    relation            varchar(12) NOT NULL CHECK (relation IN ('DUPLICATE','RELATED','PARENT','CHILD')),
    similarity          numeric(4,3) NOT NULL DEFAULT 0 CHECK (similarity BETWEEN 0 AND 1),
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (incident_id, related_incident_id, relation),
    CONSTRAINT incident_links_no_self CHECK (incident_id <> related_incident_id)
);

CREATE TABLE itsm.incident_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id uuid NOT NULL UNIQUE REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     text CHECK (comment IS NULL OR char_length(comment) <= 2000),
    submitted_by uuid,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE itsm.escalations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     uuid NOT NULL REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    level           smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
    from_employee_id uuid,
    to_employee_id  uuid,
    reason          varchar(200) NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    acknowledged_at timestamptz
);
CREATE INDEX escalations_incident ON itsm.escalations (incident_id, created_at);

-- Transactional outbox: notifications are written here in the same transaction as the
-- incident change, then dispatched asynchronously. A failed email can never roll back an
-- incident, and a crash cannot lose a notification.
CREATE TABLE itsm.outbox_event (
    id           bigserial PRIMARY KEY,
    incident_id  uuid REFERENCES itsm.incidents(id) ON DELETE CASCADE,
    event_type   varchar(40) NOT NULL,
    payload      jsonb NOT NULL,
    attempts     smallint NOT NULL DEFAULT 0,
    published_at timestamptz,
    last_error   text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending ON itsm.outbox_event (created_at) WHERE published_at IS NULL;

-- ------------------------------------------------------------------ reporting views

CREATE OR REPLACE VIEW itsm.v_incident_overview AS
SELECT
    count(*)                                                        AS total_incidents,
    count(*) FILTER (WHERE status NOT IN ('CLOSED','CANCELLED'))      AS open_incidents,
    count(*) FILTER (WHERE priority = 'P1' AND status NOT IN ('CLOSED','CANCELLED')) AS critical_incidents,
    count(*) FILTER (WHERE status IN ('RESOLVED','VERIFIED','CLOSED')) AS resolved_incidents,
    count(*) FILTER (WHERE resolution_breached OR response_breached)  AS sla_violations,
    count(*) FILTER (WHERE status = 'CLOSED' AND resolved_at <= resolution_due_at) AS met_sla
FROM itsm.incidents;

CREATE OR REPLACE VIEW itsm.v_technician_workload AS
SELECT
    t.employee_id,
    t.is_available,
    t.max_active_incidents,
    count(i.id) FILTER (WHERE i.status NOT IN ('CLOSED','CANCELLED'))             AS active_incidents,
    count(i.id) FILTER (WHERE i.status IN ('RESOLVED','VERIFIED','CLOSED'))        AS resolved_incidents,
    round(100.0 * count(i.id) FILTER (WHERE i.status NOT IN ('CLOSED','CANCELLED'))
          / t.max_active_incidents, 1)                                            AS utilisation_pct
FROM itsm.technician_profiles t
LEFT JOIN itsm.incidents i ON i.assigned_technician_id = t.employee_id
GROUP BY t.employee_id, t.is_available, t.max_active_incidents;

CREATE OR REPLACE VIEW itsm.v_service_analysis AS
SELECT
    s.id              AS service_id,
    s.code,
    s.name,
    s.business_criticality,
    count(i.id)                                                        AS incidents,
    count(i.id) FILTER (WHERE i.priority = 'P1')                       AS p1_incidents,
    count(i.id) FILTER (WHERE i.resolution_breached)                   AS sla_violations,
    round(avg(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 60.0), 1) AS avg_resolution_minutes
FROM itsm.service_catalog s
LEFT JOIN itsm.incidents i ON i.service_id = s.id
GROUP BY s.id, s.code, s.name, s.business_criticality;

CREATE OR REPLACE VIEW itsm.v_sla_compliance AS
SELECT
    priority,
    count(*)                                                              AS incidents,
    count(*) FILTER (WHERE NOT response_breached)                         AS response_met,
    count(*) FILTER (WHERE NOT resolution_breached)                       AS resolution_met,
    round(100.0 * count(*) FILTER (WHERE NOT resolution_breached) / NULLIF(count(*), 0), 1) AS compliance_pct
FROM itsm.incidents
WHERE status IN ('RESOLVED','VERIFIED','CLOSED')
GROUP BY priority;

CREATE OR REPLACE VIEW itsm.v_priority_breakdown AS
SELECT priority, status, count(*) AS incidents
FROM itsm.incidents
GROUP BY priority, status;

-- Recurring problems: services that keep failing, which is what the "correlation" feature
-- and the service-health panel read.
CREATE OR REPLACE VIEW itsm.v_recurring_problems AS
SELECT
    service_id,
    category_id,
    count(*)                       AS incidents_30d,
    count(*) FILTER (WHERE priority IN ('P1','P2')) AS high_severity_30d,
    max(created_at)                AS last_seen_at
FROM itsm.incidents
WHERE created_at > now() - interval '30 days'
GROUP BY service_id, category_id
HAVING count(*) >= 3;

-- ------------------------------------------------------------------ cross-schema foreign keys
--
-- These reference the core `public` tables. They are added conditionally so the schema can
-- also be migrated into a bare Postgres (Testcontainers) that has no `public.employees`.
-- The presence of the real constraint in production keeps every incident tied to a real employee.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'employees') THEN
        ALTER TABLE itsm.incidents
            ADD CONSTRAINT incidents_reporter_fk
                FOREIGN KEY (reporter_id) REFERENCES public.employees(id) ON DELETE SET NULL,
            ADD CONSTRAINT incidents_technician_fk
                FOREIGN KEY (assigned_technician_id) REFERENCES public.employees(id) ON DELETE SET NULL;

        ALTER TABLE itsm.technician_profiles
            ADD CONSTRAINT technician_profiles_employee_fk
                FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
            ADD CONSTRAINT technician_profiles_lead_fk
                FOREIGN KEY (team_lead_id) REFERENCES public.employees(id) ON DELETE SET NULL;

        ALTER TABLE itsm.incident_transitions
            ADD CONSTRAINT incident_transitions_actor_fk
                FOREIGN KEY (actor_id) REFERENCES public.employees(id) ON DELETE SET NULL;

        ALTER TABLE itsm.incident_notes
            ADD CONSTRAINT incident_notes_author_fk
                FOREIGN KEY (author_id) REFERENCES public.employees(id) ON DELETE SET NULL;

        ALTER TABLE itsm.incident_feedback
            ADD CONSTRAINT incident_feedback_author_fk
                FOREIGN KEY (submitted_by) REFERENCES public.employees(id) ON DELETE SET NULL;

        ALTER TABLE itsm.escalations
            ADD CONSTRAINT escalations_from_fk
                FOREIGN KEY (from_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL,
            ADD CONSTRAINT escalations_to_fk
                FOREIGN KEY (to_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

        ALTER TABLE itsm.assignment_cursor
            ADD CONSTRAINT assignment_cursor_employee_fk
                FOREIGN KEY (last_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
    ELSE
        RAISE NOTICE 'public.employees not found - ITSM foreign keys skipped (bare database)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'organizations') THEN
        ALTER TABLE itsm.incidents
            ADD CONSTRAINT incidents_org_fk
                FOREIGN KEY (org_id) REFERENCES public.organizations(id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'departments') THEN
        ALTER TABLE itsm.service_catalog
            ADD CONSTRAINT service_catalog_department_fk
                FOREIGN KEY (owner_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------ grants
--
-- Supabase defines these roles. A bare Postgres does not, hence the guard.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA itsm TO service_role;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA itsm TO service_role;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA itsm TO service_role;
    END IF;
END $$;

COMMENT ON SCHEMA itsm IS 'I-ITSM bounded context. Owned by Flyway. Never altered by Supabase migrations.';
