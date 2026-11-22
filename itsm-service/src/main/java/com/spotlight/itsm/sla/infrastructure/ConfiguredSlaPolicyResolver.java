package com.spotlight.itsm.sla.infrastructure;

import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;
import com.spotlight.itsm.sla.CriticalServiceSlaPolicy;
import com.spotlight.itsm.sla.ProfileSlaPolicy;
import com.spotlight.itsm.sla.SlaPolicy;
import com.spotlight.itsm.sla.SlaPolicyResolver;
import com.spotlight.itsm.sla.SlaTarget;
import com.spotlight.itsm.sla.StandardSlaPolicy;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Resolves the SLA policy from what administrators have configured, read fresh for every new
 * incident so an edit on the SLA settings screen applies to the next report:
 *
 * <ol>
 *   <li>the active profile attached to the service in the catalog, if any;</li>
 *   <li>otherwise the rule-based policies (critical services first), using the targets of the
 *       matching profile in the database, or the built-in defaults if that profile is missing.</li>
 * </ol>
 *
 * Changing a profile never moves an existing incident's deadlines: those are snapshotted onto the
 * incident when it is classified.
 */
public class ConfiguredSlaPolicyResolver implements SlaPolicyResolver {

    private final JdbcTemplate jdbc;

    public ConfiguredSlaPolicyResolver(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public SlaPolicy resolve(ServiceRef service, Priority priority) {
        List<Map<String, Object>> assigned = jdbc.queryForList("""
                        SELECT p.id, p.code
                        FROM itsm.service_catalog s
                        JOIN itsm.sla_profiles p ON p.id = s.sla_profile_id
                        WHERE s.id = ? AND p.is_active
                        """, service.id());
        if (!assigned.isEmpty()) {
            Map<Priority, SlaTarget> targets = targetsOf((UUID) assigned.get(0).get("id"));
            if (targets.containsKey(priority)) {
                return new ProfileSlaPolicy((String) assigned.get(0).get("code"), targets);
            }
        }

        return SlaPolicyResolver.firstMatch(List.of(
                withTargets("CRITICAL-SERVICE", CriticalServiceSlaPolicy::new, new CriticalServiceSlaPolicy()),
                withTargets("STANDARD", StandardSlaPolicy::new, new StandardSlaPolicy())
        )).resolve(service, priority);
    }

    private SlaPolicy withTargets(String code,
                                  java.util.function.Function<Map<Priority, SlaTarget>, SlaPolicy> build,
                                  SlaPolicy fallback) {
        List<UUID> ids = jdbc.queryForList(
                "SELECT id FROM itsm.sla_profiles WHERE code = ? AND is_active", UUID.class, code);
        if (ids.isEmpty()) {
            return fallback;
        }
        Map<Priority, SlaTarget> targets = targetsOf(ids.get(0));
        return targets.size() == Priority.values().length ? build.apply(targets) : fallback;
    }

    private Map<Priority, SlaTarget> targetsOf(UUID profileId) {
        Map<Priority, SlaTarget> targets = new EnumMap<>(Priority.class);
        jdbc.query("""
                        SELECT priority, response_minutes, resolution_minutes, warning_percent
                        FROM itsm.sla_targets WHERE sla_profile_id = ?
                        """,
                rs -> {
                    targets.put(Priority.valueOf(rs.getString("priority")), new SlaTarget(
                            rs.getInt("response_minutes"),
                            rs.getInt("resolution_minutes"),
                            rs.getInt("warning_percent")));
                },
                profileId);
        return targets;
    }
}
