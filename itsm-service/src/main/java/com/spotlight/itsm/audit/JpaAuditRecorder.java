package com.spotlight.itsm.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Writes the audit trail into the shared {@code public.audit_log}, so Spotlight has one
 * history rather than two. Runs in the caller's transaction: if the change rolls back, so does
 * its audit row.
 *
 * <p>An audit failure must never block a legitimate operation, so it is logged and swallowed.
 */
@Component
public class JpaAuditRecorder implements AuditRecorder {

    private static final Logger log = LoggerFactory.getLogger(JpaAuditRecorder.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JpaAuditRecorder(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditEvent event) {
        try {
            jdbc.update("""
                            INSERT INTO public.audit_log
                                (employee_id, action, table_name, record_id, old_values, new_values, created_at)
                            VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)
                            """,
                    event.actorId(),
                    event.action(),
                    event.tableName(),
                    event.recordId(),
                    json(event.oldValues()),
                    json(event.newValues()),
                    java.sql.Timestamp.from(event.occurredAt()));
        } catch (RuntimeException e) {
            log.warn("audit write failed for {} {}: {}", event.tableName(), event.recordId(), e.getMessage());
        }
    }

    private String json(Map<String, Object> values) {
        try {
            return mapper.writeValueAsString(values == null ? Map.of() : values);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
