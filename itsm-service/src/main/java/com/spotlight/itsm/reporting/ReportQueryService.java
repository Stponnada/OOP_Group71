package com.spotlight.itsm.reporting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.reporting.ReportDtos.AuditEntry;
import com.spotlight.itsm.reporting.ReportDtos.CategoryReportRow;
import com.spotlight.itsm.reporting.ReportDtos.EscalationRow;
import com.spotlight.itsm.reporting.ReportDtos.OverviewReport;
import com.spotlight.itsm.reporting.ReportDtos.ServiceReportRow;
import com.spotlight.itsm.reporting.ReportDtos.SlaReportRow;
import com.spotlight.itsm.reporting.ReportDtos.TrendPoint;
import com.spotlight.itsm.reporting.ReportDtos.WorkloadRow;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Reads the reporting views. All the aggregation lives in SQL, not in Java loops. */
@Service
public class ReportQueryService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ReportQueryService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public OverviewReport overview() {
        Double averageMinutes = jdbc.queryForObject("""
                SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60.0)::numeric, 1)
                FROM itsm.incidents WHERE resolved_at IS NOT NULL
                """, Double.class);
        double average = averageMinutes == null ? 0 : averageMinutes;
        Long finishedClean = jdbc.queryForObject("""
                SELECT count(*) FROM itsm.incidents
                WHERE status IN ('RESOLVED','VERIFIED','CLOSED') AND NOT resolution_breached AND NOT response_breached
                """, Long.class);
        return jdbc.queryForObject("SELECT * FROM itsm.v_incident_overview", (rs, i) -> {
            long resolved = rs.getLong("resolved_incidents");
            long clean = finishedClean == null ? 0 : finishedClean;
            return new OverviewReport(
                    rs.getLong("total_incidents"),
                    rs.getLong("open_incidents"),
                    rs.getLong("critical_incidents"),
                    resolved,
                    rs.getLong("sla_violations"),
                    // Of the incidents that reached Resolved or beyond, the share that never breached.
                    resolved == 0 ? 100.0 : Math.round(1000.0 * clean / resolved) / 10.0,
                    average);
        });
    }

    public List<WorkloadRow> workload() {
        return jdbc.query("""
                        SELECT w.employee_id,
                               trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) AS display_name,
                               w.active_incidents, w.resolved_incidents, w.utilisation_pct, w.is_available
                        FROM itsm.v_technician_workload w
                        JOIN public.employees e ON e.id = w.employee_id
                        ORDER BY w.active_incidents DESC
                        """,
                (rs, i) -> new WorkloadRow(
                        rs.getObject("employee_id", UUID.class),
                        rs.getString("display_name"),
                        rs.getLong("active_incidents"),
                        rs.getLong("resolved_incidents"),
                        rs.getDouble("utilisation_pct"),
                        rs.getBoolean("is_available")));
    }

    public List<ServiceReportRow> services() {
        return jdbc.query("""
                        SELECT service_id, name, business_criticality, incidents, p1_incidents,
                               sla_violations, coalesce(avg_resolution_minutes, 0) AS avg_resolution_minutes
                        FROM itsm.v_service_analysis
                        ORDER BY incidents DESC
                        """,
                (rs, i) -> new ServiceReportRow(
                        rs.getObject("service_id", UUID.class),
                        rs.getString("name"),
                        rs.getString("business_criticality"),
                        rs.getLong("incidents"),
                        rs.getLong("p1_incidents"),
                        rs.getLong("sla_violations"),
                        rs.getDouble("avg_resolution_minutes")));
    }

    public List<SlaReportRow> sla() {
        return jdbc.query("SELECT * FROM itsm.v_sla_compliance ORDER BY priority",
                (rs, i) -> new SlaReportRow(
                        Priority.valueOf(rs.getString("priority")),
                        rs.getLong("incidents"),
                        rs.getLong("response_met"),
                        rs.getLong("resolution_met"),
                        rs.getDouble("compliance_pct")));
    }

    /** One row per day for the last {@code days} days (India time), gaps filled with zeros. */
    public List<TrendPoint> trend(int days) {
        return jdbc.query("""
                        WITH d AS (
                            SELECT generate_series(
                                       (now() AT TIME ZONE 'Asia/Kolkata')::date - (?::int - 1),
                                       (now() AT TIME ZONE 'Asia/Kolkata')::date,
                                       interval '1 day')::date AS day
                        )
                        SELECT d.day,
                               (SELECT count(*) FROM itsm.incidents
                                 WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day) AS created,
                               (SELECT count(*) FROM itsm.incidents
                                 WHERE (resolved_at AT TIME ZONE 'Asia/Kolkata')::date = d.day) AS resolved,
                               (SELECT count(*) FROM itsm.incidents
                                 WHERE resolution_breached
                                   AND (resolution_due_at AT TIME ZONE 'Asia/Kolkata')::date = d.day) AS breached
                        FROM d
                        ORDER BY d.day
                        """,
                (rs, i) -> new TrendPoint(rs.getObject("day", LocalDate.class), rs.getLong("created"),
                        rs.getLong("resolved"), rs.getLong("breached")),
                days);
    }

    public List<CategoryReportRow> categories() {
        return jdbc.query("""
                        SELECT c.id, c.name,
                               count(i.id) AS incidents,
                               count(i.id) FILTER (WHERE i.status NOT IN ('CLOSED','CANCELLED')) AS open_incidents,
                               count(i.id) FILTER (WHERE i.resolution_breached OR i.response_breached) AS violations
                        FROM itsm.service_categories c
                        LEFT JOIN itsm.incidents i ON i.category_id = c.id
                        WHERE c.is_active
                        GROUP BY c.id, c.name, c.sort_order
                        ORDER BY count(i.id) DESC, c.sort_order
                        """,
                (rs, i) -> new CategoryReportRow(rs.getObject("id", UUID.class), rs.getString("name"),
                        rs.getLong("incidents"), rs.getLong("open_incidents"), rs.getLong("violations")));
    }

    public List<EscalationRow> escalations(int limit) {
        return jdbc.query("""
                        SELECT x.id, x.incident_id, i.reference, i.title, i.priority, x.level, x.reason,
                               nullif(trim(coalesce(f.first_name, '') || ' ' || coalesce(f.last_name, '')), '') AS from_name,
                               nullif(trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')), '') AS to_name,
                               x.created_at
                        FROM itsm.escalations x
                        JOIN itsm.incidents i ON i.id = x.incident_id
                        LEFT JOIN public.employees f ON f.id = x.from_employee_id
                        LEFT JOIN public.employees t ON t.id = x.to_employee_id
                        ORDER BY x.created_at DESC, x.level DESC
                        LIMIT ?
                        """,
                (rs, i) -> new EscalationRow(rs.getObject("id", UUID.class), rs.getObject("incident_id", UUID.class),
                        rs.getString("reference"), rs.getString("title"), Priority.valueOf(rs.getString("priority")),
                        rs.getInt("level"), rs.getString("reason"), rs.getString("from_name"),
                        rs.getString("to_name"), rs.getTimestamp("created_at").toInstant()),
                limit);
    }

    /**
     * Everything Spotlight's service desk wrote to the shared audit log: incident history and
     * configuration changes. {@code subject} names what changed in words a reader can scan.
     */
    public List<AuditEntry> audit(UUID incidentId, int limit) {
        String sql = """
                SELECT a.id::text AS id,
                       CASE WHEN a.table_name IN ('itsm.incidents', 'itsm.incident_notes') THEN a.record_id END AS incident_id,
                       i.reference AS incident_reference,
                       CASE a.table_name
                           WHEN 'itsm.incidents'           THEN coalesce(i.reference, 'Incident')
                           WHEN 'itsm.incident_notes'      THEN coalesce(i.reference, 'Incident') || ' note'
                           WHEN 'itsm.service_catalog'     THEN 'Service: ' || coalesce(s.name, 'removed')
                           WHEN 'itsm.service_categories'  THEN 'Category: ' || coalesce(c.name, 'removed')
                           WHEN 'itsm.sla_profiles'        THEN 'SLA profile: ' || coalesce(p.name, 'removed')
                           WHEN 'itsm.technician_profiles' THEN 'Technician: ' || coalesce(
                                nullif(trim(coalesce(te.first_name, '') || ' ' || coalesce(te.last_name, '')), ''), 'unknown')
                           WHEN 'itsm.settings'            THEN 'Assignment settings'
                           ELSE a.table_name
                       END AS subject,
                       trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) AS actor_name,
                       a.action,
                       a.old_values::text AS old_values,
                       a.new_values::text AS new_values,
                       a.created_at
                FROM public.audit_log a
                LEFT JOIN public.employees e ON e.id = a.employee_id
                LEFT JOIN itsm.incidents i ON a.table_name IN ('itsm.incidents', 'itsm.incident_notes') AND i.id = a.record_id
                LEFT JOIN itsm.service_catalog s ON a.table_name = 'itsm.service_catalog' AND s.id = a.record_id
                LEFT JOIN itsm.service_categories c ON a.table_name = 'itsm.service_categories' AND c.id = a.record_id
                LEFT JOIN itsm.sla_profiles p ON a.table_name = 'itsm.sla_profiles' AND p.id = a.record_id
                LEFT JOIN public.employees te ON a.table_name = 'itsm.technician_profiles' AND te.id = a.record_id
                WHERE a.table_name LIKE 'itsm.%'
                """ + (incidentId == null ? "" : " AND a.record_id = ? ") + """
                ORDER BY a.created_at DESC
                LIMIT ?
                """;
        Object[] args = incidentId == null ? new Object[]{limit} : new Object[]{incidentId, limit};
        return jdbc.query(sql, (rs, i) -> new AuditEntry(
                rs.getString("id"),
                rs.getObject("incident_id", UUID.class),
                rs.getString("incident_reference"),
                rs.getString("subject"),
                rs.getString("actor_name"),
                rs.getString("action"),
                json(rs.getString("old_values")),
                json(rs.getString("new_values")),
                rs.getTimestamp("created_at").toInstant()), args);
    }

    private Object json(String text) {
        if (text == null) {
            return Map.of();
        }
        try {
            return mapper.readValue(text, Object.class);
        } catch (Exception e) {
            return Map.of();
        }
    }
}
