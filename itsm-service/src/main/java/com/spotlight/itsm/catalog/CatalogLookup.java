package com.spotlight.itsm.catalog;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.CategoryRef;
import com.spotlight.itsm.incident.domain.ServiceRef;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * The narrow read port the incident mapper and service need. Kept as native SQL with explicit
 * column lists so a schema change in `public` cannot silently alter ITSM behaviour.
 */
@Component
public class CatalogLookup {

    private final JdbcTemplate jdbc;

    public CatalogLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<ServiceRef> service(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        return jdbc.query("""
                        SELECT id, code, name, business_criticality, owner_department_id
                        FROM itsm.service_catalog WHERE id = ?
                        """,
                rs -> rs.next()
                        ? Optional.of(new ServiceRef(
                                rs.getObject("id", UUID.class),
                                rs.getString("code"),
                                rs.getString("name"),
                                BusinessCriticality.valueOf(rs.getString("business_criticality")),
                                rs.getObject("owner_department_id", UUID.class)))
                        : Optional.empty(),
                id);
    }

    public Optional<CategoryRef> category(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        return jdbc.query("""
                        SELECT id, code, name FROM itsm.service_categories WHERE id = ?
                        """,
                rs -> rs.next()
                        ? Optional.of(new CategoryRef(
                                rs.getObject("id", UUID.class),
                                rs.getString("code"),
                                rs.getString("name")))
                        : Optional.empty(),
                id);
    }

    public boolean isServiceActive(UUID id) {
        Boolean active = jdbc.queryForObject(
                "SELECT is_active FROM itsm.service_catalog WHERE id = ?", Boolean.class, id);
        return Boolean.TRUE.equals(active);
    }

    public Optional<UUID> defaultSlaProfileFor(UUID serviceId, String priority) {
        return jdbc.query("""
                        SELECT COALESCE(
                                 (SELECT sla_profile_id FROM itsm.service_catalog WHERE id = ?),
                                 (SELECT id FROM itsm.sla_profiles WHERE code = 'STANDARD'))
                        """,
                rs -> rs.next() ? Optional.ofNullable(rs.getObject(1, UUID.class)) : Optional.empty(),
                serviceId);
    }
}
