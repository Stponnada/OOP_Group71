package com.spotlight.itsm.assignment;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The projection of a technician that assignment strategies are allowed to see. Deliberately a
 * flat value object: it prevents a strategy from loading the employee aggregate or writing to it,
 * which is what makes these strategies trivially unit-testable.
 */
public record TechnicianCandidate(
        UUID employeeId,
        String displayName,
        boolean available,
        int activeIncidents,
        int maxActiveIncidents,
        int experienceYears,
        Map<UUID, Integer> skillProficiency,
        Set<UUID> servicedServiceIds
) {

    public TechnicianCandidate {
        if (maxActiveIncidents < 1) {
            throw new IllegalArgumentException("maxActiveIncidents must be at least 1");
        }
        skillProficiency = skillProficiency == null ? Map.of() : Map.copyOf(skillProficiency);
        servicedServiceIds = servicedServiceIds == null ? Set.of() : Set.copyOf(servicedServiceIds);
    }

    public boolean hasCapacity() {
        return available && activeIncidents < maxActiveIncidents;
    }

    public double utilisation() {
        return (double) activeIncidents / maxActiveIncidents;
    }

    public int proficiency(UUID skillId) {
        return skillProficiency.getOrDefault(skillId, 0);
    }

    public boolean hasWorkedOn(UUID serviceId) {
        return servicedServiceIds.contains(serviceId);
    }
}
