package com.spotlight.itsm.priority;

import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.PriorityAssessment;
import com.spotlight.itsm.incident.domain.UserScope;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The documented matrix:
 *
 * <pre>
 *   score = impact(1-4) x urgency(1-4) x businessCriticality(1-5) x userMultiplier(1.00-1.50)
 *   bands:  >= 60 -> P1   >= 30 -> P2   >= 10 -> P3   else P4      (maximum 120)
 * </pre>
 *
 * <p>Worked example: the payment application is down for the whole organisation.
 * 4 x 4 x 5 x 1.50 = 120 -> P1. A single user unable to print: 1 x 2 x 2 x 1.00 = 4 -> P4.
 */
public final class WeightedMatrixCalculator implements PriorityCalculator {

    public static final String KEY = "weighted-matrix";

    private static final double P1_THRESHOLD = 60;
    private static final double P2_THRESHOLD = 30;
    private static final double P3_THRESHOLD = 10;

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public PriorityAssessment assess(PriorityInput input) {
        UserScope scope = UserScope.of(input.affectedUsers());
        double score = input.impact().weight()
                * input.urgency().weight()
                * input.criticality().weight()
                * scope.multiplier();

        Priority priority = band(score);

        Map<String, Double> factors = new LinkedHashMap<>();
        factors.put("score", score);
        factors.put("impact", (double) input.impact().weight());
        factors.put("urgency", (double) input.urgency().weight());
        factors.put("criticality", (double) input.criticality().weight());
        factors.put("userMultiplier", scope.multiplier());

        String explanation = "%s (%d) x %s (%d) x %s (%d) x %.2f users = %.1f -> %s".formatted(
                input.impact().label(), input.impact().weight(),
                input.urgency().label(), input.urgency().weight(),
                input.criticality().label(), input.criticality().weight(),
                scope.multiplier(),
                score,
                priority.name());

        return new PriorityAssessment(round2(score), priority, factors, explanation);
    }

    static Priority band(double score) {
        if (score >= P1_THRESHOLD) {
            return Priority.P1;
        }
        if (score >= P2_THRESHOLD) {
            return Priority.P2;
        }
        if (score >= P3_THRESHOLD) {
            return Priority.P3;
        }
        return Priority.P4;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
