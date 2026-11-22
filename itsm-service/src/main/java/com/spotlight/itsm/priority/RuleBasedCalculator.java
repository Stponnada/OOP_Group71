package com.spotlight.itsm.priority;

import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.PriorityAssessment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Decorates another calculator with explicit policy overrides. Demonstrates that strategies
 * compose: the weighted matrix still produces the baseline and a readable explanation, and the
 * rules only ever raise the floor.
 *
 * <p>This is also the honest answer to "what if the algorithm is wrong?" — an administrator can
 * add a rule without touching the matrix.
 */
public final class RuleBasedCalculator implements PriorityCalculator {

    public static final String KEY = "rule-based";

    private final PriorityCalculator delegate;
    private final List<PriorityRule> rules;

    public RuleBasedCalculator(PriorityCalculator delegate, List<PriorityRule> rules) {
        this.delegate = delegate;
        this.rules = List.copyOf(rules);
    }

    /** The stock rules described in the report. */
    public static RuleBasedCalculator withDefaults(PriorityCalculator delegate) {
        return new RuleBasedCalculator(delegate, List.of(
                new SecurityOverrideRule(),
                new RegulatedServiceFloorRule(),
                new ExecutiveEscalationRule()));
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public PriorityAssessment assess(PriorityInput input) {
        PriorityAssessment baseline = delegate.assess(input);

        Priority effective = baseline.priority();
        List<String> applied = new ArrayList<>();
        Map<String, Double> factors = new LinkedHashMap<>(baseline.factors());

        for (PriorityRule rule : rules) {
            Priority floor = rule.floorFor(input).orElse(null);
            if (floor != null && floor.atLeast(effective)) {
                effective = Priority.moreSevere(effective, floor);
                applied.add(rule.name() + " -> at least " + floor.name());
            }
        }

        if (applied.isEmpty()) {
            return baseline;
        }

        factors.put("ruleFloors", (double) applied.size());
        String explanation = baseline.explanation() + " | raised by " + String.join(", ", applied);
        return new PriorityAssessment(baseline.score(), effective, factors, explanation);
    }

    /** A security incident is never below P1: confidentiality and availability outrank the matrix. */
    static final class SecurityOverrideRule implements PriorityRule {
        @Override
        public String name() {
            return "security-incident";
        }

        @Override
        public java.util.Optional<Priority> floorFor(PriorityInput input) {
            return input.securityIncident() ? java.util.Optional.of(Priority.P1) : java.util.Optional.empty();
        }
    }

    /** A wide outage on a regulated service never drops below P2. */
    static final class RegulatedServiceFloorRule implements PriorityRule {
        @Override
        public String name() {
            return "regulated-service";
        }

        @Override
        public java.util.Optional<Priority> floorFor(PriorityInput input) {
            boolean wide = input.impact().weight() >= 3;
            return input.regulatedService() && wide
                    ? java.util.Optional.of(Priority.P2)
                    : java.util.Optional.empty();
        }
    }

    /** Executive-reported problems get one band of benefit of the doubt. */
    static final class ExecutiveEscalationRule implements PriorityRule {
        @Override
        public String name() {
            return "executive-reporter";
        }

        @Override
        public java.util.Optional<Priority> floorFor(PriorityInput input) {
            return input.executiveReporter() ? java.util.Optional.of(Priority.P2) : java.util.Optional.empty();
        }
    }
}
