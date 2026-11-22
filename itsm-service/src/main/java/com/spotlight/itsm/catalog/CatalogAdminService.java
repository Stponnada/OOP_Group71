package com.spotlight.itsm.catalog;

import com.spotlight.itsm.assignment.AssignmentStrategyRegistry;
import com.spotlight.itsm.audit.AuditEvent;
import com.spotlight.itsm.audit.AuditRecorder;
import com.spotlight.itsm.catalog.CatalogDtos.AssignmentSettingsView;
import com.spotlight.itsm.catalog.CatalogDtos.CategoryView;
import com.spotlight.itsm.catalog.CatalogDtos.CategoryWrite;
import com.spotlight.itsm.catalog.CatalogDtos.ServiceView;
import com.spotlight.itsm.catalog.CatalogDtos.ServiceWrite;
import com.spotlight.itsm.catalog.CatalogDtos.SkillLevel;
import com.spotlight.itsm.catalog.CatalogDtos.SlaProfileUpdate;
import com.spotlight.itsm.catalog.CatalogDtos.SlaProfileView;
import com.spotlight.itsm.catalog.CatalogDtos.SlaTargetWrite;
import com.spotlight.itsm.catalog.CatalogDtos.StrategyView;
import com.spotlight.itsm.catalog.CatalogDtos.TechnicianUpdate;
import com.spotlight.itsm.catalog.CatalogDtos.TechnicianView;
import com.spotlight.itsm.common.exception.ValidationException;
import com.spotlight.itsm.identity.EmployeePrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * What a service-desk administrator changes at run time: the catalog, technician profiles, SLA
 * targets and the default assignment strategy. Every change is audited into
 * {@code public.audit_log} alongside incident history, so "who changed the P1 target" has the
 * same answer path as "who closed INC-…".
 *
 * <p>Changes apply to future work only. An incident snapshots its SLA deadlines when it is
 * classified, so editing a target never moves the goalposts on an incident already open.
 */
@Service
public class CatalogAdminService {

    private static final String SETTING_STRATEGY = "assignment.default-strategy";

    private final JdbcTemplate jdbc;
    private final AuditRecorder audit;
    private final AssignmentStrategyRegistry strategies;
    private final CatalogQueryService catalog;

    public CatalogAdminService(JdbcTemplate jdbc, AuditRecorder audit, AssignmentStrategyRegistry strategies,
                               CatalogQueryService catalog) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.strategies = strategies;
        this.catalog = catalog;
    }

    // ---------------------------------------------------------------- categories

    @Transactional
    public CategoryView createCategory(EmployeePrincipal actor, CategoryWrite w) {
        UUID id = UUID.randomUUID();
        String code = uniqueCode("itsm.service_categories", w.code(), w.name(), null);
        jdbc.update("""
                        INSERT INTO itsm.service_categories (id, code, name, description, sort_order, is_active)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                id, code, w.name().trim(), blankToNull(w.description()),
                w.sortOrder() == null ? nextSortOrder() : w.sortOrder(),
                w.isActive() == null || w.isActive());
        record(actor, "create", "itsm.service_categories", id, Map.of(), Map.of("code", code, "name", w.name().trim()));
        return category(id);
    }

    @Transactional
    public CategoryView updateCategory(EmployeePrincipal actor, UUID id, CategoryWrite w) {
        CategoryView before = category(id);
        String code = w.code() == null || w.code().isBlank() ? before.code() : uniqueCode(
                "itsm.service_categories", w.code(), w.name(), id);
        boolean active = w.isActive() == null ? before.isActive() : w.isActive();
        jdbc.update("""
                        UPDATE itsm.service_categories
                        SET code = ?, name = ?, description = ?, sort_order = ?, is_active = ?, updated_at = now()
                        WHERE id = ?
                        """,
                code, w.name().trim(), blankToNull(w.description()),
                w.sortOrder() == null ? before.sortOrder() : w.sortOrder(), active, id);
        record(actor, before.isActive() && !active ? "deactivate" : "status_change", "itsm.service_categories", id,
                Map.of("name", before.name(), "isActive", before.isActive()),
                Map.of("name", w.name().trim(), "isActive", active));
        return category(id);
    }

    // ------------------------------------------------------------------ services

    @Transactional
    public ServiceView createService(EmployeePrincipal actor, ServiceWrite w) {
        requireCategory(w.categoryId());
        requireSlaProfile(w.slaProfileId());
        UUID id = UUID.randomUUID();
        String code = uniqueCode("itsm.service_catalog", w.code(), w.name(), null);
        jdbc.update("""
                        INSERT INTO itsm.service_catalog
                            (id, code, name, description, category_id, business_criticality, sla_profile_id, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?::uuid, ?)
                        """,
                id, code, w.name().trim(), blankToNull(w.description()), w.categoryId(),
                w.businessCriticality().name(), w.slaProfileId(), w.isActive() == null || w.isActive());
        replaceRequiredSkills(id, w.requiredSkillIds());
        record(actor, "create", "itsm.service_catalog", id, Map.of(),
                Map.of("code", code, "name", w.name().trim(), "businessCriticality", w.businessCriticality().name()));
        return service(id);
    }

    @Transactional
    public ServiceView updateService(EmployeePrincipal actor, UUID id, ServiceWrite w) {
        ServiceView before = service(id);
        requireCategory(w.categoryId());
        requireSlaProfile(w.slaProfileId());
        String code = w.code() == null || w.code().isBlank() ? before.code() : uniqueCode(
                "itsm.service_catalog", w.code(), w.name(), id);
        boolean active = w.isActive() == null ? before.isActive() : w.isActive();
        jdbc.update("""
                        UPDATE itsm.service_catalog
                        SET code = ?, name = ?, description = ?, category_id = ?, business_criticality = ?,
                            sla_profile_id = ?::uuid, is_active = ?, updated_at = now()
                        WHERE id = ?
                        """,
                code, w.name().trim(), blankToNull(w.description()), w.categoryId(),
                w.businessCriticality().name(), w.slaProfileId(), active, id);
        if (w.requiredSkillIds() != null) {
            replaceRequiredSkills(id, w.requiredSkillIds());
        }
        Map<String, Object> old = new HashMap<>();
        old.put("name", before.name());
        old.put("businessCriticality", before.businessCriticality().name());
        old.put("slaProfileId", String.valueOf(before.slaProfileId()));
        old.put("isActive", before.isActive());
        Map<String, Object> now = new HashMap<>();
        now.put("name", w.name().trim());
        now.put("businessCriticality", w.businessCriticality().name());
        now.put("slaProfileId", String.valueOf(w.slaProfileId()));
        now.put("isActive", active);
        record(actor, before.isActive() && !active ? "deactivate" : "status_change", "itsm.service_catalog", id,
                old, now);
        return service(id);
    }

    // --------------------------------------------------------------- technicians

    /**
     * Creates or updates a technician profile. Scalars left out keep their current value (or the
     * default on create); a list left out is left alone, a list sent replaces what was there. The
     * team lead is replaced every time: leave it out to clear it.
     */
    @Transactional
    public TechnicianView upsertTechnician(EmployeePrincipal actor, UUID employeeId, TechnicianUpdate u) {
        Integer activeEmployee = jdbc.queryForObject(
                "SELECT count(*) FROM public.employees WHERE id = ? AND is_active", Integer.class, employeeId);
        if (activeEmployee == null || activeEmployee == 0) {
            throw new ValidationException("No active employee has that id.");
        }
        if (u.teamLeadId() != null) {
            if (u.teamLeadId().equals(employeeId)) {
                throw new ValidationException("A technician cannot be their own team lead.");
            }
            Integer lead = jdbc.queryForObject(
                    "SELECT count(*) FROM public.employees WHERE id = ? AND is_active", Integer.class, u.teamLeadId());
            if (lead == null || lead == 0) {
                throw new ValidationException("The team lead must be an active employee.");
            }
        }

        boolean existed = !jdbc.queryForList(
                "SELECT 1 FROM itsm.technician_profiles WHERE employee_id = ?", employeeId).isEmpty();
        Map<String, Object> before = existed ? jdbc.queryForMap("""
                SELECT is_available, max_active_incidents, experience_years, team_lead_id
                FROM itsm.technician_profiles WHERE employee_id = ?
                """, employeeId) : Map.of();

        jdbc.update("""
                        INSERT INTO itsm.technician_profiles
                            (employee_id, team_lead_id, max_active_incidents, experience_years, is_available)
                        VALUES (?, ?::uuid, coalesce(?::int, 5), coalesce(?::int, 0), coalesce(?::boolean, true))
                        ON CONFLICT (employee_id) DO UPDATE SET
                            team_lead_id = EXCLUDED.team_lead_id,
                            max_active_incidents = coalesce(?::int, itsm.technician_profiles.max_active_incidents),
                            experience_years = coalesce(?::int, itsm.technician_profiles.experience_years),
                            is_available = coalesce(?::boolean, itsm.technician_profiles.is_available),
                            updated_at = now()
                        """,
                employeeId, u.teamLeadId(), u.maxActiveIncidents(), u.experienceYears(), u.isAvailable(),
                u.maxActiveIncidents(), u.experienceYears(), u.isAvailable());

        if (u.skills() != null) {
            jdbc.update("DELETE FROM itsm.technician_skills WHERE employee_id = ?", employeeId);
            Set<UUID> seen = new LinkedHashSet<>();
            for (SkillLevel skill : u.skills()) {
                if (skill.proficiency() < 1 || skill.proficiency() > 5) {
                    throw new ValidationException("Proficiency is from 1 to 5.");
                }
                if (seen.add(skill.skillId())) {
                    jdbc.update("""
                                    INSERT INTO itsm.technician_skills (employee_id, skill_id, proficiency)
                                    VALUES (?, ?, ?)
                                    """,
                            employeeId, skill.skillId(), skill.proficiency());
                }
            }
        }
        if (u.serviceIds() != null) {
            UUID[] keep = u.serviceIds().stream().distinct().toArray(UUID[]::new);
            jdbc.update(con -> {
                var ps = con.prepareStatement(
                        "DELETE FROM itsm.technician_services WHERE employee_id = ? AND NOT (service_id = ANY(?))");
                ps.setObject(1, employeeId);
                ps.setArray(2, con.createArrayOf("uuid", keep));
                return ps;
            });
            for (UUID serviceId : keep) {
                jdbc.update("""
                                INSERT INTO itsm.technician_services (employee_id, service_id)
                                VALUES (?, ?) ON CONFLICT DO NOTHING
                                """,
                        employeeId, serviceId);
            }
        }

        Map<String, Object> after = new HashMap<>(jdbc.queryForMap("""
                SELECT is_available, max_active_incidents, experience_years, team_lead_id
                FROM itsm.technician_profiles WHERE employee_id = ?
                """, employeeId));
        after.replaceAll((k, v) -> v == null ? "none" : v.toString());
        Map<String, Object> old = new HashMap<>(before);
        old.replaceAll((k, v) -> v == null ? "none" : v.toString());
        record(actor, existed ? "status_change" : "role_assign", "itsm.technician_profiles", employeeId, old, after);

        return technician(employeeId);
    }

    /** Takes someone off the service desk. Refused while they still hold open incidents. */
    @Transactional
    public void removeTechnician(EmployeePrincipal actor, UUID employeeId) {
        Integer open = jdbc.queryForObject("""
                        SELECT count(*) FROM itsm.incidents
                        WHERE assigned_technician_id = ? AND status NOT IN ('CLOSED', 'CANCELLED')
                        """,
                Integer.class, employeeId);
        if (open != null && open > 0) {
            throw new ValidationException("They still hold " + open + " open incident" + (open == 1 ? "" : "s")
                    + ". Reassign " + (open == 1 ? "it" : "them") + " first.");
        }
        int removed = jdbc.update("DELETE FROM itsm.technician_profiles WHERE employee_id = ?", employeeId);
        if (removed == 0) {
            throw new ValidationException("They are not a technician.");
        }
        jdbc.update("UPDATE itsm.technician_profiles SET team_lead_id = NULL WHERE team_lead_id = ?", employeeId);
        record(actor, "role_revoke", "itsm.technician_profiles", employeeId, Map.of("technician", true),
                Map.of("technician", false));
    }

    // ---------------------------------------------------------------------- SLA

    @Transactional
    public SlaProfileView updateSlaProfile(EmployeePrincipal actor, UUID id, SlaProfileUpdate u) {
        SlaProfileView before = slaProfile(id);
        if (u.name() != null && !u.name().isBlank()) {
            jdbc.update("UPDATE itsm.sla_profiles SET name = ?, updated_at = now() WHERE id = ?", u.name().trim(), id);
        }
        if (u.isActive() != null) {
            jdbc.update("UPDATE itsm.sla_profiles SET is_active = ?, updated_at = now() WHERE id = ?", u.isActive(), id);
        }
        if (u.targets() != null) {
            for (SlaTargetWrite t : u.targets()) {
                int warning = t.warningPercent() == null ? 75 : t.warningPercent();
                if (t.resolutionMinutes() < t.responseMinutes()) {
                    throw new ValidationException(t.priority() + ": resolution cannot be sooner than the first response.");
                }
                if (warning < 1 || warning > 100) {
                    throw new ValidationException(t.priority() + ": the warning threshold is a percentage from 1 to 100.");
                }
                jdbc.update("""
                                INSERT INTO itsm.sla_targets
                                    (sla_profile_id, priority, response_minutes, resolution_minutes, warning_percent)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT (sla_profile_id, priority) DO UPDATE SET
                                    response_minutes = EXCLUDED.response_minutes,
                                    resolution_minutes = EXCLUDED.resolution_minutes,
                                    warning_percent = EXCLUDED.warning_percent
                                """,
                        id, t.priority().name(), t.responseMinutes(), t.resolutionMinutes(), warning);
            }
            jdbc.update("UPDATE itsm.sla_profiles SET updated_at = now() WHERE id = ?", id);
        }
        SlaProfileView after = slaProfile(id);
        record(actor, "status_change", "itsm.sla_profiles", id, targetsOf(before), targetsOf(after));
        return after;
    }

    // --------------------------------------------------------------- assignment

    @Transactional
    public AssignmentSettingsView setDefaultStrategy(EmployeePrincipal actor, String key) {
        String previous = strategies.defaultStrategy().key();
        strategies.byKey(key);
        jdbc.update("""
                        INSERT INTO itsm.settings (key, value, updated_by, updated_at)
                        VALUES (?, ?, ?, now())
                        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                                                        updated_at = now()
                        """,
                SETTING_STRATEGY, key, actor.employeeId());
        strategies.useAsDefault(key);
        record(actor, "status_change", "itsm.settings",
                UUID.nameUUIDFromBytes(SETTING_STRATEGY.getBytes(StandardCharsets.UTF_8)),
                Map.of("defaultStrategy", previous), Map.of("defaultStrategy", key));
        return new AssignmentSettingsView(key,
                strategies.all().stream().map(s -> new StrategyView(s.key(), s.label())).toList());
    }

    // ----------------------------------------------------------------- helpers

    private CategoryView category(UUID id) {
        return catalog.categories(true).stream().filter(c -> c.id().equals(id)).findFirst()
                .orElseThrow(() -> new ValidationException("No category has that id."));
    }

    private ServiceView service(UUID id) {
        return catalog.services(true).stream().filter(s -> s.id().equals(id)).findFirst()
                .orElseThrow(() -> new ValidationException("No service has that id."));
    }

    private TechnicianView technician(UUID id) {
        return catalog.technicians().stream().filter(t -> t.employeeId().equals(id)).findFirst()
                .orElseThrow(() -> new ValidationException("No technician has that id."));
    }

    private SlaProfileView slaProfile(UUID id) {
        return catalog.slaProfiles().stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> new ValidationException("No SLA profile has that id."));
    }

    private void requireCategory(UUID id) {
        category(id);
    }

    private void requireSlaProfile(UUID id) {
        if (id != null) {
            slaProfile(id);
        }
    }

    private void replaceRequiredSkills(UUID serviceId, List<UUID> skillIds) {
        jdbc.update("DELETE FROM itsm.service_required_skills WHERE service_id = ?", serviceId);
        if (skillIds == null) {
            return;
        }
        for (UUID skill : new LinkedHashSet<>(skillIds)) {
            jdbc.update("INSERT INTO itsm.service_required_skills (service_id, skill_id) VALUES (?, ?)",
                    serviceId, skill);
        }
    }

    private int nextSortOrder() {
        Integer max = jdbc.queryForObject("SELECT coalesce(max(sort_order), 0) FROM itsm.service_categories",
                Integer.class);
        return (max == null ? 0 : max) + 10;
    }

    /** NETWORK-VPN style codes, made unique with a numeric suffix when the name repeats. */
    private String uniqueCode(String table, String requested, String name, UUID self) {
        String base = (requested == null || requested.isBlank() ? name : requested)
                .trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isEmpty()) {
            throw new ValidationException("Give it a name with at least one letter or digit.");
        }
        base = base.length() > 36 ? base.substring(0, 36).replaceAll("-$", "") : base;
        String candidate = base;
        for (int n = 2; taken(table, candidate, self); n++) {
            if (requested != null && !requested.isBlank()) {
                throw new ValidationException("The code " + candidate + " is already in use.");
            }
            candidate = base + "-" + n;
        }
        return candidate;
    }

    private boolean taken(String table, String code, UUID self) {
        // table is one of two constants above, never user input.
        Integer n = jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE code = ? AND id IS DISTINCT FROM ?::uuid",
                Integer.class, code, self);
        return n != null && n > 0;
    }

    private static Map<String, Object> targetsOf(SlaProfileView profile) {
        Map<String, Object> out = new HashMap<>();
        out.put("name", profile.name());
        out.put("isActive", profile.isActive());
        profile.targets().forEach(t -> out.put(t.priority().name(),
                t.responseMinutes() + "/" + t.resolutionMinutes() + " min, warn at " + t.warningPercent() + "%"));
        return out;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void record(EmployeePrincipal actor, String action, String table, UUID id,
                        Map<String, Object> before, Map<String, Object> after) {
        audit.record(new AuditEvent(actor.employeeId(), action, table, id, before, after, Instant.now()));
    }
}
