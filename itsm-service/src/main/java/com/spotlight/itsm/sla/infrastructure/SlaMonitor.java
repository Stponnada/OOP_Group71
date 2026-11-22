package com.spotlight.itsm.sla.infrastructure;

import com.spotlight.itsm.escalation.EscalationDirectory;
import com.spotlight.itsm.escalation.EscalationHandler;
import com.spotlight.itsm.escalation.EscalationPolicy;
import com.spotlight.itsm.escalation.EscalationRequest;
import com.spotlight.itsm.escalation.EscalationStep;
import com.spotlight.itsm.event.SlaAlertEvent;
import com.spotlight.itsm.identity.ServiceDeskDirectory;
import com.spotlight.itsm.sla.SlaTarget;
import com.spotlight.itsm.sla.SlaWindow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sweeps open incidents once a minute and acts on the SLA clock:
 * <ol>
 *   <li><b>warning</b> once the resolution clock passes the profile's warning percentage, sent once
 *       to the assignee (or to the service desk when nobody has it);</li>
 *   <li><b>breach</b> when a deadline passes, recorded on the incident for reporting and announced
 *       to the assignee;</li>
 *   <li><b>escalation</b> up the ladder (team lead, system administrator, IT manager) as far as
 *       {@link EscalationPolicy} says the incident should be, one rung per record, through the
 *       chain of responsibility in {@code escalation}.</li>
 * </ol>
 *
 * <p>The API computes SLA status on every read, so a missed sweep never shows an incident as
 * healthy. This job is what persists, notifies and escalates.
 */
@Component
public class SlaMonitor {

    private static final Logger log = LoggerFactory.getLogger(SlaMonitor.class);
    private static final DateTimeFormatter WHEN =
            DateTimeFormatter.ofPattern("d MMM, HH:mm").withZone(ZoneId.of("Asia/Kolkata"));

    private final JdbcTemplate jdbc;
    private final ServiceDeskDirectory directory;
    private final ApplicationEventPublisher events;
    private final EscalationHandler ladder = EscalationHandler.standardChain();

    public SlaMonitor(JdbcTemplate jdbc, ServiceDeskDirectory directory, ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.directory = directory;
        this.events = events;
    }

    @Scheduled(fixedDelayString = "${itsm.sla.sweep-ms:60000}", initialDelayString = "${itsm.sla.initial-delay-ms:15000}")
    @Transactional
    public void sweep() {
        Instant now = Instant.now();
        List<Map<String, Object>> open = jdbc.queryForList("""
                SELECT id, reference, title, priority, assigned_technician_id,
                       sla_started_at, response_due_at, resolution_due_at, warning_percent,
                       first_response_at, resolved_at, escalation_level,
                       response_breached, resolution_breached, sla_warning_sent_at
                FROM itsm.incidents
                WHERE status IN ('NEW','CLASSIFIED','ASSIGNED','ACKNOWLEDGED','IN_PROGRESS')
                  AND sla_started_at IS NOT NULL
                  AND resolution_due_at IS NOT NULL
                """);
        for (Map<String, Object> row : open) {
            try {
                check(row, now);
            } catch (RuntimeException e) {
                log.warn("SLA sweep skipped {}: {}", row.get("reference"), e.getMessage());
            }
        }
    }

    private void check(Map<String, Object> row, Instant now) {
        UUID id = (UUID) row.get("id");
        String reference = (String) row.get("reference");
        String title = (String) row.get("title");
        String priority = (String) row.get("priority");
        UUID assignee = (UUID) row.get("assigned_technician_id");
        Instant firstResponse = instant(row.get("first_response_at"));
        Instant resolvedAt = instant(row.get("resolved_at"));
        Instant responseDue = instant(row.get("response_due_at"));
        Instant resolutionDue = instant(row.get("resolution_due_at"));
        Instant started = instant(row.get("sla_started_at"));
        int warningPercent = ((Number) row.get("warning_percent")).intValue();
        int level = ((Number) row.get("escalation_level")).intValue();

        SlaWindow window = SlaWindow.of(started, new SlaTarget(
                (int) Math.max(1, Duration.between(started, responseDue).toMinutes()),
                (int) Math.max(1, Duration.between(started, resolutionDue).toMinutes()),
                warningPercent));
        List<UUID> owners = assignee != null ? List.of(assignee) : directory.serviceDeskAdmins();

        // 1. Warning, once, while there is still time to act.
        Duration total = Duration.between(started, resolutionDue);
        Duration elapsed = Duration.between(started, now);
        boolean warned = row.get("sla_warning_sent_at") != null;
        if (!warned && now.isBefore(resolutionDue)
                && elapsed.toSeconds() * 100 >= total.toSeconds() * warningPercent) {
            jdbc.update("UPDATE itsm.incidents SET sla_warning_sent_at = ? WHERE id = ?", Timestamp.from(now), id);
            long left = Math.max(1, Duration.between(now, resolutionDue).toMinutes());
            events.publishEvent(new SlaAlertEvent(id, reference, title, priority, SlaAlertEvent.Alert.WARNING,
                    owners, "Resolution due " + WHEN.format(resolutionDue) + " (" + left + " min left)."));
        }

        // 2. Breaches, recorded for reporting and announced to whoever owns it.
        if (!(Boolean) row.get("response_breached") && firstResponse == null && now.isAfter(responseDue)) {
            jdbc.update("UPDATE itsm.incidents SET response_breached = true WHERE id = ?", id);
            events.publishEvent(new SlaAlertEvent(id, reference, title, priority, SlaAlertEvent.Alert.BREACHED,
                    owners, "Nobody responded by " + WHEN.format(responseDue) + "."));
        }
        if (!(Boolean) row.get("resolution_breached") && now.isAfter(resolutionDue)) {
            jdbc.update("UPDATE itsm.incidents SET resolution_breached = true WHERE id = ?", id);
            events.publishEvent(new SlaAlertEvent(id, reference, title, priority, SlaAlertEvent.Alert.BREACHED,
                    owners, "Resolution was due " + WHEN.format(resolutionDue) + "."));
            log.info("SLA breach recorded for {}", reference);
        }

        // 3. Escalation, as far up the ladder as the clock says, one record per rung.
        int required = EscalationPolicy.requiredLevel(window, firstResponse, resolvedAt, now);
        if (required > level) {
            String reason = EscalationPolicy.reasonFor(required);
            List<EscalationStep> steps = ladder.escalate(
                    new EscalationRequest(id, assignee, level, required, reason), (EscalationDirectory) directory);
            // One record per rung, each with that rung's own reason. Someone reached on several
            // rungs in one sweep (a superuser who is also the department admin, say) is told once,
            // at the highest rung.
            java.util.Map<UUID, EscalationStep> highestFor = new java.util.LinkedHashMap<>();
            for (EscalationStep step : steps) {
                String why = EscalationPolicy.reasonFor(step.level());
                UUID to = step.recipients().isEmpty() ? null : step.recipients().get(0);
                jdbc.update("""
                                INSERT INTO itsm.escalations (incident_id, level, from_employee_id, to_employee_id, reason)
                                VALUES (?, ?, ?, ?, ?)
                                """,
                        id, step.level(), assignee, to, truncate(step.handledBy() + ": " + why, 200));
                step.recipients().forEach(r -> highestFor.put(r, step));
            }
            java.util.Map<EscalationStep, List<UUID>> byStep = new java.util.LinkedHashMap<>();
            highestFor.forEach((person, step) -> byStep.computeIfAbsent(step, k -> new java.util.ArrayList<>()).add(person));
            byStep.forEach((step, people) -> events.publishEvent(new SlaAlertEvent(id, reference, title, priority,
                    SlaAlertEvent.Alert.ESCALATED, people,
                    "Escalated to you as " + inSentence(step.handledBy()) + ": "
                            + EscalationPolicy.reasonFor(step.level()) + ".")));
            jdbc.update("UPDATE itsm.incidents SET escalation_level = ? WHERE id = ?", required, id);
            log.info("{} escalated from level {} to {}", reference, level, required);
        }
    }

    /** "Team lead" -> "team lead", but "IT manager" keeps its acronym. */
    private static String inSentence(String role) {
        if (role.length() > 1 && Character.isUpperCase(role.charAt(1))) {
            return role;
        }
        return Character.toLowerCase(role.charAt(0)) + role.substring(1);
    }

    private static Instant instant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant();
        }
        return (Instant) value;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
