package com.spotlight.itsm.assignment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Loads the flat {@link TechnicianCandidate} projection. All the joins happen here, once, so the
 * strategies stay pure functions over a list.
 */
@Component
public class TechnicianDirectory {

    private final JdbcTemplate jdbc;

    public TechnicianDirectory(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<TechnicianCandidate> candidates() {
        Map<UUID, Map<UUID, Integer>> skills = new HashMap<>();
        jdbc.query("SELECT employee_id, skill_id, proficiency FROM itsm.technician_skills",
                (RowCallbackHandler) rs -> skills
                        .computeIfAbsent(rs.getObject("employee_id", UUID.class), k -> new HashMap<>())
                        .put(rs.getObject("skill_id", UUID.class), rs.getInt("proficiency")));

        Map<UUID, Set<UUID>> services = new HashMap<>();
        jdbc.query("SELECT employee_id, service_id FROM itsm.technician_services",
                (RowCallbackHandler) rs -> services
                        .computeIfAbsent(rs.getObject("employee_id", UUID.class), k -> new HashSet<>())
                        .add(rs.getObject("service_id", UUID.class)));

        Map<UUID, Integer> active = new HashMap<>();
        jdbc.query("""
                        SELECT assigned_technician_id, count(*) AS n
                        FROM itsm.incidents
                        WHERE assigned_technician_id IS NOT NULL
                          AND status NOT IN ('CLOSED','CANCELLED')
                        GROUP BY assigned_technician_id
                        """,
                (RowCallbackHandler) rs -> active.put(
                        rs.getObject("assigned_technician_id", UUID.class), rs.getInt("n")));

        return jdbc.query("""
                        SELECT t.employee_id,
                               trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) AS display_name,
                               t.is_available,
                               t.max_active_incidents,
                               t.experience_years
                        FROM itsm.technician_profiles t
                        JOIN public.employees e ON e.id = t.employee_id
                        WHERE e.is_active
                        ORDER BY e.first_name
                        """,
                (rs, rowNum) -> {
                    UUID id = rs.getObject("employee_id", UUID.class);
                    return new TechnicianCandidate(
                            id,
                            rs.getString("display_name"),
                            rs.getBoolean("is_available"),
                            active.getOrDefault(id, 0),
                            rs.getInt("max_active_incidents"),
                            rs.getInt("experience_years"),
                            skills.getOrDefault(id, Map.of()),
                            services.getOrDefault(id, Set.of()));
                });
    }

    public List<TechnicianCandidate> candidatesForService(UUID serviceId) {
        List<TechnicianCandidate> all = candidates();
        Set<UUID> required = requiredSkills(serviceId);
        if (required.isEmpty()) {
            return all;
        }
        return all.stream()
                .filter(c -> required.stream().anyMatch(s -> c.proficiency(s) > 0))
                .toList();
    }

    public Set<UUID> requiredSkills(UUID serviceId) {
        return new HashSet<>(jdbc.queryForList(
                "SELECT skill_id FROM itsm.service_required_skills WHERE service_id = ?",
                UUID.class, serviceId));
    }
}
