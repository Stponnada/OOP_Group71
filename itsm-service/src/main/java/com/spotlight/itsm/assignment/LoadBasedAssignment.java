package com.spotlight.itsm.assignment;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.Optional;

/**
 * Picks the qualified technician with the lowest utilisation. "Qualified" means available and
 * holding at least one of the required skills; if no skill filter is supplied, capacity alone
 * decides. Reference implementation for the other three strategies.
 */
@Component
public final class LoadBasedAssignment implements AssignmentStrategy {

    public static final String KEY = "load-based";

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String label() {
        return "Load-based";
    }

    @Override
    public Optional<TechnicianCandidate> select(AssignmentContext context) {
        return context.candidates().stream()
                .filter(TechnicianCandidate::hasCapacity)
                .filter(candidate -> isQualified(candidate, context))
                .min(Comparator.comparingDouble(TechnicianCandidate::utilisation)
                        .thenComparingInt(candidate -> -candidate.experienceYears())
                        .thenComparing(TechnicianCandidate::employeeId));
    }

    static boolean isQualified(TechnicianCandidate candidate, AssignmentContext context) {
        if (context.requiredSkillIds().isEmpty()) {
            return true;
        }
        return context.requiredSkillIds().stream().anyMatch(skill -> candidate.proficiency(skill) > 0);
    }
}
