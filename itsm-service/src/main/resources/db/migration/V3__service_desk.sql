-- V3: what the service-desk screens need on top of V1/V2. Additive only, so it applies cleanly
-- to a database that already has incidents.

-- The SLA monitor warns once per incident when the resolution clock passes its warning
-- threshold; this records that the warning went out so a restart doesn't repeat it.
ALTER TABLE itsm.incidents ADD COLUMN IF NOT EXISTS sla_warning_sent_at timestamptz;

-- Settings an administrator changes at run time (the default assignment strategy today).
-- Key/value keeps a new setting a row, not a migration.
CREATE TABLE IF NOT EXISTS itsm.settings (
    key        varchar(60) PRIMARY KEY,
    value      text        NOT NULL,
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- "Is the reporter's answer still outstanding?" looks at the newest question and answer.
CREATE INDEX IF NOT EXISTS incident_notes_by_kind ON itsm.incident_notes (incident_id, kind, created_at);

-- The unassigned pool technicians pick work from.
CREATE INDEX IF NOT EXISTS incidents_unassigned_open ON itsm.incidents (created_at)
    WHERE assigned_technician_id IS NULL AND status NOT IN ('CLOSED', 'CANCELLED');

-- Escalations are read newest first on the service-desk dashboard.
CREATE INDEX IF NOT EXISTS escalations_recent ON itsm.escalations (created_at DESC);
