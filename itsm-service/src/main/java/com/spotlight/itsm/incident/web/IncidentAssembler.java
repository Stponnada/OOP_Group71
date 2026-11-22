package com.spotlight.itsm.incident.web;

import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.incident.application.IncidentAccessPolicy;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentAction;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Transition;
import com.spotlight.itsm.incident.web.IncidentDtos.Extras;
import com.spotlight.itsm.incident.web.IncidentDtos.FeedbackView;
import com.spotlight.itsm.incident.web.IncidentDtos.IncidentSummary;
import com.spotlight.itsm.incident.web.IncidentDtos.IncidentView;
import com.spotlight.itsm.incident.web.IncidentDtos.LinkView;
import com.spotlight.itsm.incident.web.IncidentDtos.Person;
import com.spotlight.itsm.sla.HistoricalSlaRiskAssessor;
import com.spotlight.itsm.sla.SlaClock;
import com.spotlight.itsm.sla.SlaRiskAssessor;
import com.spotlight.itsm.sla.SlaStatus;
import com.spotlight.itsm.sla.infrastructure.ResolutionHistory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Component;

import java.sql.Array;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Builds the wire views. Kept out of the controller so the controller stays a router. Lists are
 * assembled with one query per concern for the whole page, never one per row.
 */
@Component
public class IncidentAssembler {

    private static final Set<IncidentStatus> CLOCK_STOPPED = Set.of(
            IncidentStatus.RESOLVED, IncidentStatus.VERIFIED, IncidentStatus.CLOSED, IncidentStatus.CANCELLED);

    private final SlaClock slaClock;
    private final IncidentAccessPolicy accessPolicy;
    private final JdbcTemplate jdbc;
    private final ResolutionHistory history;
    private final SlaRiskAssessor riskAssessor = new HistoricalSlaRiskAssessor();

    public IncidentAssembler(SlaClock slaClock, IncidentAccessPolicy accessPolicy, JdbcTemplate jdbc,
                             ResolutionHistory history) {
        this.slaClock = slaClock;
        this.accessPolicy = accessPolicy;
        this.jdbc = jdbc;
        this.history = history;
    }

    public IncidentView view(Incident incident, Instant now, EmployeePrincipal actor) {
        UUID id = incident.id().value();
        UUID assigneeId = incident.assignee().orElse(null);
        Map<UUID, String> names = namesOf(assigneeId == null
                ? List.of(incident.reporterId()) : List.of(incident.reporterId(), assigneeId));
        Person reporter = new Person(incident.reporterId(), names.getOrDefault(incident.reporterId(), "Unknown employee"));
        Person assignee = assigneeId == null ? null : new Person(assigneeId, names.getOrDefault(assigneeId, "Unknown employee"));

        SlaStatus responseStatus = null;
        SlaStatus resolutionStatus = null;
        if (incident.slaWindow().isPresent()) {
            var window = incident.slaWindow().get();
            responseStatus = slaClock.responseStatus(window, incident.firstResponseAt(), now);
            resolutionStatus = slaClock.resolutionStatus(window, incident.resolvedAt(), now);
        }

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT escalation_level, assigned_at, verified_at FROM itsm.incidents WHERE id = ?", id);
        FeedbackView feedback = jdbc.query("""
                        SELECT rating, comment, created_at FROM itsm.incident_feedback WHERE incident_id = ?
                        """,
                rs -> rs.next() ? new FeedbackView(rs.getInt("rating"), rs.getString("comment"),
                        rs.getTimestamp("created_at").toInstant()) : null, id);
        boolean awaiting = !incident.isTerminal() && awaitingReporter(List.of(id)).contains(id);
        String cancellationReason = incident.history().stream()
                .filter(t -> t.to() == IncidentStatus.CANCELLED)
                .reduce((first, second) -> second)
                .map(Transition::reason)
                .orElse(null);
        List<IncidentAction> actions = new ArrayList<>(accessPolicy.actionsFor(incident, actor, feedback != null));

        Extras extras = new Extras(
                ((Number) row.get("escalation_level")).intValue(),
                instant(row.get("assigned_at")),
                instant(row.get("verified_at")),
                cancellationReason,
                actions,
                awaiting,
                riskOf(incident, now),
                feedback,
                linksOf(id));

        return IncidentView.from(incident, reporter, assignee,
                IncidentDtos.slaView(incident, responseStatus, resolutionStatus, now), extras);
    }

    public List<IncidentSummary> summaries(List<Incident> incidents, Instant now) {
        Set<UUID> people = new HashSet<>();
        List<UUID> ids = new ArrayList<>();
        for (Incident i : incidents) {
            people.add(i.reporterId());
            i.assignee().ifPresent(people::add);
            ids.add(i.id().value());
        }
        Map<UUID, String> names = namesOf(people);
        Set<UUID> awaiting = awaitingReporter(ids);

        List<IncidentSummary> out = new ArrayList<>();
        for (Incident incident : incidents) {
            SlaStatus status = null;
            Instant dueAt = null;
            if (incident.slaWindow().isPresent()) {
                var window = incident.slaWindow().get();
                status = slaClock.overall(window, incident.firstResponseAt(), incident.resolvedAt(), now);
                // The deadline that is running now: response until someone responds, then resolution.
                dueAt = incident.firstResponseAt() == null && incident.resolvedAt() == null
                        ? window.responseDueAt()
                        : window.resolutionDueAt();
            }
            out.add(new IncidentSummary(
                    incident.id().value(),
                    incident.reference(),
                    incident.title(),
                    incident.status(),
                    incident.priority().priority(),
                    incident.service() == null ? null : incident.service().name(),
                    incident.assignee().map(names::get).orElse(null),
                    status,
                    dueAt,
                    incident.createdAt(),
                    names.getOrDefault(incident.reporterId(), "Unknown employee"),
                    incident.category() == null ? null : incident.category().name(),
                    riskOf(incident, now),
                    !incident.isTerminal() && awaiting.contains(incident.id().value())));
        }
        return out;
    }

    /** LOW / MEDIUM / HIGH while the resolution clock runs; null once it has stopped. */
    private String riskOf(Incident incident, Instant now) {
        if (incident.slaWindow().isEmpty() || CLOCK_STOPPED.contains(incident.status())) {
            return null;
        }
        var band = riskAssessor.assess(incident.slaWindow().get(),
                history.medianFor(incident.service() == null ? null : incident.service().id(),
                        incident.priority().priority()),
                now);
        return band == SlaRiskAssessor.RiskBand.BREACHED ? "HIGH" : band.name();
    }

    private List<LinkView> linksOf(UUID id) {
        return jdbc.query("""
                        SELECT o.id, o.reference, o.title, o.status, l.relation, l.similarity
                        FROM (
                            SELECT related_incident_id AS other, relation, similarity
                            FROM itsm.incident_links WHERE incident_id = ?
                            UNION ALL
                            SELECT incident_id,
                                   CASE relation WHEN 'PARENT' THEN 'CHILD' WHEN 'CHILD' THEN 'PARENT' ELSE relation END,
                                   similarity
                            FROM itsm.incident_links WHERE related_incident_id = ?
                        ) l
                        JOIN itsm.incidents o ON o.id = l.other
                        ORDER BY l.similarity DESC, o.created_at DESC
                        """,
                (rs, n) -> new LinkView(rs.getObject("id", UUID.class), rs.getString("reference"),
                        rs.getString("title"), IncidentStatus.valueOf(rs.getString("status")),
                        rs.getString("relation"), rs.getDouble("similarity")),
                id, id);
    }

    /** Incidents whose newest question to the reporter is newer than their newest answer. */
    private Set<UUID> awaitingReporter(Collection<UUID> ids) {
        Set<UUID> out = new HashSet<>();
        if (ids.isEmpty()) {
            return out;
        }
        jdbc.query(con -> {
                    PreparedStatement ps = con.prepareStatement("""
                            SELECT incident_id
                            FROM itsm.incident_notes
                            WHERE incident_id = ANY(?)
                            GROUP BY incident_id
                            HAVING max(created_at) FILTER (WHERE kind = 'INFO_REQUEST')
                                 > coalesce(max(created_at) FILTER (WHERE kind = 'INFO_RESPONSE'), '-infinity')
                            """);
                    Array array = con.createArrayOf("uuid", ids.toArray());
                    ps.setArray(1, array);
                    return ps;
                },
                (RowCallbackHandler) rs -> out.add(rs.getObject("incident_id", UUID.class)));
        return out;
    }

    private Map<UUID, String> namesOf(Collection<UUID> ids) {
        Map<UUID, String> names = new HashMap<>();
        if (ids.isEmpty()) {
            return names;
        }
        List<UUID> unique = new ArrayList<>(new LinkedHashSet<>(ids));
        jdbc.query(con -> {
                    PreparedStatement ps = con.prepareStatement("""
                            SELECT id, trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) AS name
                            FROM public.employees WHERE id = ANY(?)
                            """);
                    ps.setArray(1, con.createArrayOf("uuid", unique.toArray()));
                    return ps;
                },
                (RowCallbackHandler) rs -> names.put(rs.getObject("id", UUID.class), rs.getString("name")));
        return names;
    }

    private static Instant instant(Object value) {
        if (value instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant();
        }
        return (Instant) value;
    }
}
