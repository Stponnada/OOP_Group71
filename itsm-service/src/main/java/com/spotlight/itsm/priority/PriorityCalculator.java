package com.spotlight.itsm.priority;

import com.spotlight.itsm.incident.domain.PriorityAssessment;

/**
 * Strategy contract for turning impact, urgency and criticality into a priority band.
 *
 * <p>Two implementations ship: {@link WeightedMatrixCalculator} (the documented matrix) and
 * {@link RuleBasedCalculator} (explicit overrides layered on top of any delegate). The
 * administrator picks the default; tests pick directly.
 */
public interface PriorityCalculator {

    String key();

    PriorityAssessment assess(PriorityInput input);
}
