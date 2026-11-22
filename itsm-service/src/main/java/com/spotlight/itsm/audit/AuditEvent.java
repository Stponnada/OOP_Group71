package com.spotlight.itsm.audit;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * One auditable action. Written to the existing {@code public.audit_log} so Spotlight has a
 * single history rather than a second, parallel one.
 *
 * <p>{@code action} must stay within that table's CHECK enum: create, status_change, approve,
 * reject, deactivate, role_assign, role_revoke, login, logout, download, delete.
 */
public record AuditEvent(
        UUID actorId,
        String action,
        String tableName,
        UUID recordId,
        Map<String, Object> oldValues,
        Map<String, Object> newValues,
        Instant occurredAt
) {

    public static final String TABLE = "itsm.incidents";

    public AuditEvent {
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(tableName, "tableName");
        Objects.requireNonNull(recordId, "recordId");
        Objects.requireNonNull(occurredAt, "occurredAt");
        oldValues = oldValues == null ? Map.of() : Map.copyOf(oldValues);
        newValues = newValues == null ? Map.of() : Map.copyOf(newValues);
    }

    public static AuditEvent created(UUID actorId, UUID incidentId, Map<String, Object> newValues, Instant now) {
        return new AuditEvent(actorId, "create", TABLE, incidentId, Map.of(), newValues, now);
    }

    public static AuditEvent statusChanged(
            UUID actorId, UUID incidentId, String from, String to, Instant now) {
        return new AuditEvent(actorId, "status_change", TABLE, incidentId,
                Map.of("status", from), Map.of("status", to), now);
    }
}
