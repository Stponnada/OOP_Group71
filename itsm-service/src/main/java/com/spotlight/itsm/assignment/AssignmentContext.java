package com.spotlight.itsm.assignment;

import com.spotlight.itsm.incident.domain.Priority;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Everything a strategy may consider, gathered once by the caller. */
public record AssignmentContext(
        Priority priority,
        UUID serviceId,
        Set<UUID> requiredSkillIds,
        List<TechnicianCandidate> candidates
) {

    public AssignmentContext {
        if (priority == null) {
            throw new IllegalArgumentException("priority is required");
        }
        requiredSkillIds = requiredSkillIds == null ? Set.of() : Set.copyOf(requiredSkillIds);
        candidates = candidates == null ? List.of() : List.copyOf(candidates);
    }

    public List<TechnicianCandidate> available() {
        return candidates.stream().filter(TechnicianCandidate::hasCapacity).toList();
    }
}
