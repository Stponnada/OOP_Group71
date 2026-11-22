package com.spotlight.itsm.identity;

import com.spotlight.itsm.escalation.EscalationDirectory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Finds the people behind each service-desk role, from the same HR tables {@link IdentityService}
 * reads: admins of the IT department are the system administrators, superusers are the IT
 * managers, and both together are the service-desk admins who triage unassigned work.
 */
@Component
public class ServiceDeskDirectory implements EscalationDirectory {

    private final JdbcTemplate jdbc;
    private final String adminDepartment;

    public ServiceDeskDirectory(JdbcTemplate jdbc,
                                @Value("${itsm.access.admin-department:Engineering}") String adminDepartment) {
        this.jdbc = jdbc;
        this.adminDepartment = adminDepartment;
    }

    @Override
    public Optional<UUID> teamLeadOf(UUID technicianId) {
        List<UUID> leads = jdbc.queryForList("""
                        SELECT t.team_lead_id
                        FROM itsm.technician_profiles t
                        JOIN public.employees e ON e.id = t.team_lead_id AND e.is_active
                        WHERE t.employee_id = ?
                        """,
                UUID.class, technicianId);
        return leads.stream().findFirst();
    }

    @Override
    public List<UUID> systemAdministrators() {
        return jdbc.queryForList("""
                        SELECT DISTINCT e.id
                        FROM public.employees e
                        JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active
                        JOIN public.roles r ON r.id = er.role_id
                        JOIN public.departments d ON d.id = r.department_id
                        WHERE e.is_active AND r.access_level = 'admin' AND lower(d.name) = lower(?)
                        """,
                UUID.class, adminDepartment);
    }

    @Override
    public List<UUID> itManagers() {
        return jdbc.queryForList("""
                        SELECT DISTINCT e.id
                        FROM public.employees e
                        JOIN public.employee_roles er ON er.employee_id = e.id AND er.is_active
                        JOIN public.roles r ON r.id = er.role_id
                        WHERE e.is_active AND r.access_level = 'superuser'
                        """,
                UUID.class);
    }

    /** Everyone who can assign work: system administrators and IT managers. */
    public List<UUID> serviceDeskAdmins() {
        LinkedHashSet<UUID> all = new LinkedHashSet<>(systemAdministrators());
        all.addAll(itManagers());
        return new ArrayList<>(all);
    }
}
