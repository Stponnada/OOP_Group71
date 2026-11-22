package com.spotlight.itsm.incident.web;

import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.web.IncidentDtos.TimelineEntry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

/** One ordered feed of everything that happened, for the incident detail page. */
@Component
public class TimelineQuery {

    private final JdbcTemplate jdbc;

    public TimelineQuery(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Everything that happened, oldest first. {@code includeInternal} is false for the reporter:
     * INTERNAL notes are the service desk talking among itself.
     */
    public List<TimelineEntry> forIncident(UUID incidentId, boolean includeInternal) {
        return jdbc.query("""
                        SELECT t.id::text                        AS id,
                               'TRANSITION'                      AS kind,
                               trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) AS actor_name,
                               t.from_status                     AS from_status,
                               t.to_status                       AS to_status,
                               t.reason                          AS body,
                               NULL::varchar                     AS note_kind,
                               t.occurred_at                     AS occurred_at
                        FROM itsm.incident_transitions t
                        LEFT JOIN public.employees e ON e.id = t.actor_id
                        WHERE t.incident_id = ?

                        UNION ALL

                        SELECT n.id::text,
                               'NOTE',
                               trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')),
                               NULL::varchar,
                               NULL::varchar,
                               n.body,
                               n.kind,
                               n.created_at
                        FROM itsm.incident_notes n
                        LEFT JOIN public.employees e ON e.id = n.author_id
                        WHERE n.incident_id = ? AND (? OR n.kind <> 'INTERNAL')

                        UNION ALL

                        SELECT x.id::text,
                               'ESCALATION',
                               NULL,
                               NULL::varchar,
                               NULL::varchar,
                               -- reason is stored as "<role that received it>: <why>"; read it back as a sentence.
                               CASE WHEN position(': ' IN x.reason) > 0
                                    THEN split_part(x.reason, ': ', 2) || '.'
                                    ELSE x.reason || '.' END
                                   || coalesce(' Sent to ' || nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), '')
                                       || CASE WHEN position(': ' IN x.reason) > 0
                                               THEN ' as ' || CASE WHEN substr(split_part(x.reason, ': ', 1), 2, 1) ~ '[A-Z]'
                                                                    THEN split_part(x.reason, ': ', 1)
                                                                    ELSE lower(left(split_part(x.reason, ': ', 1), 1))
                                                                         || substr(split_part(x.reason, ': ', 1), 2) END
                                               ELSE '' END || '.', ' Nobody holds that role yet.'),
                               NULL::varchar,
                               x.created_at
                        FROM itsm.escalations x
                        LEFT JOIN public.employees e ON e.id = x.to_employee_id
                        WHERE x.incident_id = ?

                        UNION ALL

                        SELECT f.id::text,
                               'FEEDBACK',
                               trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')),
                               NULL::varchar,
                               NULL::varchar,
                               'Rated ' || f.rating || '/5' || coalesce(' - ' || f.comment, ''),
                               NULL::varchar,
                               f.created_at
                        FROM itsm.incident_feedback f
                        LEFT JOIN public.employees e ON e.id = f.submitted_by
                        WHERE f.incident_id = ?

                        ORDER BY occurred_at
                        """,
                (rs, rowNum) -> map(rs),
                incidentId, incidentId, includeInternal, incidentId, incidentId);
    }

    private TimelineEntry map(ResultSet rs) throws SQLException {
        String from = rs.getString("from_status");
        String to = rs.getString("to_status");
        String actor = rs.getString("actor_name");
        return new TimelineEntry(
                rs.getString("id"),
                rs.getString("kind"),
                actor == null || actor.isBlank() ? null : actor,
                from == null ? null : IncidentStatus.valueOf(from),
                to == null ? null : IncidentStatus.valueOf(to),
                rs.getString("body"),
                rs.getString("note_kind"),
                rs.getTimestamp("occurred_at").toInstant());
    }
}
