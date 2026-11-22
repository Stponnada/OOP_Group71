package com.spotlight.itsm.assignment;

import com.spotlight.itsm.incident.domain.Priority;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.Optional;

/**
 * Critical work goes to whoever can actually fix it: most experienced, with prior experience on
 * the service. Routine work delegates to load balancing so senior engineers are not consumed by
 * password resets.
 */
@Component
public class PriorityAwareAssignment implements AssignmentStrategy {

    public static final String KEY = "priority-aware";

    private final LoadBasedAssignment loadBased;

    public PriorityAwareAssignment(LoadBasedAssignment loadBased) {
        this.loadBased = loadBased;
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String label() {
        return "Priority-aware";
    }

    @Override
    public Optional<TechnicianCandidate> select(AssignmentContext context) {
        if (context.priority() == Priority.P3 || context.priority() == Priority.P4) {
            return loadBased.select(context);
        }
        return context.candidates().stream()
                .filter(TechnicianCandidate::hasCapacity)
                .max(Comparator
                        .comparing((TechnicianCandidate c) -> c.hasWorkedOn(context.serviceId()))
                        .thenComparingInt(TechnicianCandidate::experienceYears)
                        .thenComparingDouble(c -> -c.utilisation()));
    }
}
