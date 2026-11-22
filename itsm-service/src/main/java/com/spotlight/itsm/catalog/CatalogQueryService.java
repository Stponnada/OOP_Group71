package com.spotlight.itsm.catalog;

import com.spotlight.itsm.catalog.CatalogDtos.CategoryView;
import com.spotlight.itsm.catalog.CatalogDtos.SkillProficiency;
import com.spotlight.itsm.catalog.CatalogDtos.SkillView;
import com.spotlight.itsm.catalog.CatalogDtos.SlaProfileView;
import com.spotlight.itsm.catalog.CatalogDtos.SlaTargetView;
import com.spotlight.itsm.catalog.CatalogDtos.ServiceView;
import com.spotlight.itsm.catalog.CatalogDtos.TechnicianView;
import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Priority;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Read-only catalog queries. Small explicit SQL, no clever abstractions. */
@Service
public class CatalogQueryService {

    private final JdbcTemplate jdbc;

    public CatalogQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CategoryView> categories() {
        return categories(false);
    }

    public List<CategoryView> categories(boolean includeInactive) {
        return jdbc.query("""
                        SELECT id, code, name, sort_order, is_active, description
                        FROM itsm.service_categories
                        WHERE is_active OR ?
                        ORDER BY sort_order, name
                        """,
                (rs, i) -> new CategoryView(
                        rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getInt("sort_order"), rs.getBoolean("is_active"), rs.getString("description")),
                includeInactive);
    }

    public List<ServiceView> services() {
        return services(false);
    }

    public List<ServiceView> services(boolean includeInactive) {
        Map<UUID, List<UUID>> required = new HashMap<>();
        jdbc.query("SELECT service_id, skill_id FROM itsm.service_required_skills",
                (RowCallbackHandler) rs -> required
                        .computeIfAbsent(rs.getObject("service_id", UUID.class), k -> new ArrayList<>())
                        .add(rs.getObject("skill_id", UUID.class)));

        return jdbc.query("""
                        SELECT id, code, name, category_id, business_criticality, sla_profile_id, is_active,
                               description
                        FROM itsm.service_catalog
                        WHERE is_active OR ?
                        ORDER BY name
                        """,
                (rs, i) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    return new ServiceView(
                            id, rs.getString("code"), rs.getString("name"),
                            rs.getObject("category_id", UUID.class),
                            BusinessCriticality.valueOf(rs.getString("business_criticality")),
                            rs.getObject("sla_profile_id", UUID.class),
                            rs.getBoolean("is_active"),
                            rs.getString("description"),
                            List.copyOf(required.getOrDefault(id, List.of())));
                },
                includeInactive);
    }

    public List<SkillView> skills() {
        return jdbc.query("SELECT id, code, name FROM itsm.skills ORDER BY name",
                (rs, i) -> new SkillView(
                        rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name")));
    }

    public List<SlaProfileView> slaProfiles() {
        Map<UUID, List<SlaTargetView>> targets = new HashMap<>();
        jdbc.query("""
                        SELECT sla_profile_id, priority, response_minutes, resolution_minutes, warning_percent
                        FROM itsm.sla_targets ORDER BY priority
                        """,
                (RowCallbackHandler) rs -> targets
                        .computeIfAbsent(rs.getObject("sla_profile_id", UUID.class), k -> new ArrayList<>())
                        .add(new SlaTargetView(
                                Priority.valueOf(rs.getString("priority")),
                                rs.getInt("response_minutes"),
                                rs.getInt("resolution_minutes"),
                                rs.getInt("warning_percent"))));

        return jdbc.query("SELECT id, code, name, is_active FROM itsm.sla_profiles ORDER BY name",
                (rs, i) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    return new SlaProfileView(id, rs.getString("code"), rs.getString("name"),
                            rs.getBoolean("is_active"), targets.getOrDefault(id, List.of()));
                });
    }

    public List<TechnicianView> technicians() {
        Map<UUID, List<SkillProficiency>> skills = new HashMap<>();
        jdbc.query("""
                        SELECT ts.employee_id, ts.skill_id, ts.proficiency, s.name
                        FROM itsm.technician_skills ts JOIN itsm.skills s ON s.id = ts.skill_id
                        """,
                (RowCallbackHandler) rs -> skills
                        .computeIfAbsent(rs.getObject("employee_id", UUID.class), k -> new ArrayList<>())
                        .add(new SkillProficiency(rs.getObject("skill_id", UUID.class),
                                rs.getString("name"), rs.getInt("proficiency"))));

        Map<UUID, Set<UUID>> services = new HashMap<>();
        jdbc.query("SELECT employee_id, service_id FROM itsm.technician_services",
                (RowCallbackHandler) rs -> services
                        .computeIfAbsent(rs.getObject("employee_id", UUID.class), k -> new HashSet<>())
                        .add(rs.getObject("service_id", UUID.class)));

        Map<UUID, Integer> active = new HashMap<>();
        jdbc.query("""
                        SELECT assigned_technician_id, count(*) AS n FROM itsm.incidents
                        WHERE assigned_technician_id IS NOT NULL AND status NOT IN ('CLOSED','CANCELLED')
                        GROUP BY assigned_technician_id
                        """,
                (RowCallbackHandler) rs -> active.put(
                        rs.getObject("assigned_technician_id", UUID.class), rs.getInt("n")));

        return jdbc.query("""
                        SELECT t.employee_id,
                               trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) AS display_name,
                               t.is_available, t.max_active_incidents, t.experience_years, t.team_lead_id,
                               nullif(trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, '')), '')
                                   AS team_lead_name
                        FROM itsm.technician_profiles t
                        JOIN public.employees e ON e.id = t.employee_id
                        LEFT JOIN public.employees l ON l.id = t.team_lead_id
                        WHERE e.is_active
                        ORDER BY e.first_name
                        """,
                (rs, i) -> {
                    UUID id = rs.getObject("employee_id", UUID.class);
                    int max = rs.getInt("max_active_incidents");
                    int current = active.getOrDefault(id, 0);
                    return new TechnicianView(
                            id, rs.getString("display_name"), rs.getBoolean("is_available"),
                            current, max, max == 0 ? 0 : Math.round(1000.0 * current / max) / 10.0,
                            rs.getInt("experience_years"),
                            skills.getOrDefault(id, List.of()),
                            List.copyOf(services.getOrDefault(id, Set.of())),
                            rs.getObject("team_lead_id", UUID.class),
                            rs.getString("team_lead_name"));
                });
    }
}
