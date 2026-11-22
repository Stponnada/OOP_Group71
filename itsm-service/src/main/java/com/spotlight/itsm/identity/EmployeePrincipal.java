package com.spotlight.itsm.identity;

import java.util.Set;
import java.util.UUID;

/**
 * The caller, resolved from the Supabase token. This is the only identity type the service
 * reasons about; Spring's {@code Jwt} never leaks past the converter.
 */
public record EmployeePrincipal(
        UUID employeeId,
        UUID authUserId,
        String displayName,
        String email,
        boolean technician,
        boolean serviceDeskAdmin,
        Set<String> departments
) {

    public EmployeePrincipal {
        departments = departments == null ? Set.of() : Set.copyOf(departments);
    }

    public String firstName() {
        int space = displayName.indexOf(' ');
        return space > 0 ? displayName.substring(0, space) : displayName;
    }
}
