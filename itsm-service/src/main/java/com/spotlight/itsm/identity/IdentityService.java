package com.spotlight.itsm.identity;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Turns a Supabase {@code sub} claim into an {@link EmployeePrincipal}.
 *
 * <p>Authorities are derived from data, never hard-coded:
 * <ul>
 *   <li><b>technician</b> — a row exists in {@code itsm.technician_profiles};</li>
 *   <li><b>service-desk admin</b> — a superuser anywhere, or an admin of the configured
 *       ITSM department (default Engineering).</li>
 * </ul>
 */
@Service
public class IdentityService {

    private final EmployeeJpaRepository employees;
    private final EntityManager entityManager;
    private final String adminDepartment;

    public IdentityService(EmployeeJpaRepository employees,
                           EntityManager entityManager,
                           @org.springframework.beans.factory.annotation.Value("${itsm.access.admin-department:Engineering}")
                           String adminDepartment) {
        this.employees = employees;
        this.entityManager = entityManager;
        this.adminDepartment = adminDepartment;
    }

    @Transactional(readOnly = true)
    public Optional<EmployeePrincipal> resolve(UUID authUserId) {
        return employees.findByAuthUserIdAndActiveTrue(authUserId).map(this::toPrincipal);
    }

    @Transactional(readOnly = true)
    public UUID orgId(UUID employeeId) {
        return employees.findById(employeeId)
                .map(e -> (UUID) entityManager.createNativeQuery(
                                "SELECT org_id FROM public.employees WHERE id = :id")
                        .setParameter("id", e.getId())
                        .getSingleResult())
                .orElseThrow(() -> new IllegalStateException("Employee " + employeeId + " has no organisation."));
    }

    @Transactional(readOnly = true)
    public java.util.Optional<String> emailOf(UUID employeeId) {
        return employees.findById(employeeId).map(EmployeeEntity::getEmail);
    }

    @Transactional(readOnly = true)
    public String displayName(UUID employeeId) {
        return employees.findById(employeeId).map(EmployeeEntity::displayName).orElse("Unknown employee");
    }

    private EmployeePrincipal toPrincipal(EmployeeEntity employee) {
        List<Object[]> roles = entityManager.createNativeQuery("""
                        SELECT r.access_level, d.name
                        FROM public.employee_roles er
                        JOIN public.roles r ON r.id = er.role_id
                        JOIN public.departments d ON d.id = r.department_id
                        WHERE er.employee_id = :employeeId AND er.is_active
                        """, Object[].class)
                .setParameter("employeeId", employee.getId())
                .getResultList();

        Set<String> departments = new HashSet<>();
        boolean admin = false;
        for (Object[] row : roles) {
            String accessLevel = (String) row[0];
            String department = (String) row[1];
            if (department != null) {
                departments.add(department);
            }
            if ("superuser".equals(accessLevel)
                    || ("admin".equals(accessLevel) && adminDepartment.equalsIgnoreCase(department))) {
                admin = true;
            }
        }

        boolean technician = isTechnician(employee.getId());

        return new EmployeePrincipal(
                employee.getId(),
                employee.getAuthUserId(),
                employee.displayName(),
                employee.getEmail(),
                technician,
                admin,
                departments);
    }

    private boolean isTechnician(UUID employeeId) {
        Number count = (Number) entityManager.createNativeQuery(
                        "SELECT count(*) FROM itsm.technician_profiles WHERE employee_id = :id")
                .setParameter("id", employeeId)
                .getSingleResult();
        return count != null && count.longValue() > 0;
    }
}
