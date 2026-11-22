package com.spotlight.itsm.sla.infrastructure;

import com.spotlight.itsm.incident.domain.Priority;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Median time to resolve, per service and priority, over the last 90 days. Read by the SLA risk
 * forecast for every incident on a page, so it is cached for a few minutes rather than queried
 * per row.
 */
@Component
public class ResolutionHistory {

    private static final Duration TTL = Duration.ofMinutes(5);

    private final JdbcTemplate jdbc;
    private volatile Snapshot snapshot = new Snapshot(Map.of(), Map.of(), Instant.EPOCH);

    public ResolutionHistory(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The median for this service and priority, else for this priority anywhere, else null. */
    public Duration medianFor(UUID serviceId, Priority priority) {
        Snapshot current = fresh();
        Duration byService = serviceId == null ? null : current.byService().get(serviceId + ":" + priority);
        return byService != null ? byService : current.byPriority().get(priority.name());
    }

    private Snapshot fresh() {
        Snapshot current = snapshot;
        if (Duration.between(current.loadedAt(), Instant.now()).compareTo(TTL) < 0) {
            return current;
        }
        Map<String, Duration> byService = new HashMap<>();
        Map<String, Duration> byPriority = new HashMap<>();
        jdbc.query("""
                        SELECT service_id, priority,
                               percentile_cont(0.5) WITHIN GROUP (
                                   ORDER BY extract(epoch FROM resolved_at - sla_started_at)) AS median_s,
                               GROUPING(service_id) AS all_services
                        FROM itsm.incidents
                        WHERE resolved_at IS NOT NULL
                          AND sla_started_at IS NOT NULL
                          AND resolved_at > now() - interval '90 days'
                        GROUP BY GROUPING SETS ((service_id, priority), (priority))
                        """,
                rs -> {
                    Duration median = Duration.ofSeconds(Math.round(rs.getDouble("median_s")));
                    if (rs.getInt("all_services") == 1) {
                        byPriority.put(rs.getString("priority"), median);
                    } else {
                        byService.put(rs.getObject("service_id", UUID.class) + ":" + rs.getString("priority"), median);
                    }
                });
        Snapshot loaded = new Snapshot(Map.copyOf(byService), Map.copyOf(byPriority), Instant.now());
        snapshot = loaded;
        return loaded;
    }

    private record Snapshot(Map<String, Duration> byService, Map<String, Duration> byPriority, Instant loadedAt) {
    }
}
