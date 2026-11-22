package com.spotlight.itsm.incident.domain;

import java.util.Map;

/**
 * The result of running a priority calculation, including the reasoning.
 *
 * <p>Keeping {@code factors} and {@code explanation} on the assessment is what lets the UI
 * answer "why is this a P1?" — a question the brief requires the team to be able to defend.
 */
public record PriorityAssessment(
        double score,
        Priority priority,
        Map<String, Double> factors,
        String explanation
) {

    public PriorityAssessment {
        if (score < 0) {
            throw new IllegalArgumentException("score cannot be negative");
        }
        if (priority == null) {
            throw new IllegalArgumentException("priority is required");
        }
        factors = factors == null ? Map.of() : Map.copyOf(factors);
        explanation = explanation == null ? "" : explanation;
    }

    public static PriorityAssessment of(double score, Priority priority, String explanation) {
        return new PriorityAssessment(score, priority, Map.of("score", score), explanation);
    }
}
