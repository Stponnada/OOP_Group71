package com.spotlight.itsm.assignment;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.Optional;

/**
 * Picks the best skill match, using proficiency as the weighted score. Prior experience with
 * the service breaks ties, then seniority, then the id so the choice is deterministic.
 */
@Component
public class SkillBasedAssignment implements AssignmentStrategy {

    public static final String KEY = "skill-based";

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String label() {
        return "Skill-based";
    }

    @Override
    public Optional<TechnicianCandidate> select(AssignmentContext context) {
        return context.candidates().stream()
                .filter(TechnicianCandidate::hasCapacity)
                .filter(c -> context.requiredSkillIds().isEmpty()
                        || context.requiredSkillIds().stream().anyMatch(s -> c.proficiency(s) > 0))
                .max(Comparator
                        .comparingDouble((TechnicianCandidate c) -> skillScore(c, context))
                        .thenComparing(c -> c.hasWorkedOn(context.serviceId()))
                        .thenComparingInt(TechnicianCandidate::experienceYears)
                        .thenComparing(c -> c.employeeId().toString(), Comparator.reverseOrder()));
    }

    private double skillScore(TechnicianCandidate candidate, AssignmentContext context) {
        return context.requiredSkillIds().stream()
                .mapToDouble(candidate::proficiency)
                .sum();
    }
}
