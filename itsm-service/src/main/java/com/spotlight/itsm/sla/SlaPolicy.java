package com.spotlight.itsm.sla;

import com.spotlight.itsm.common.exception.SlaPolicyMissingException;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;

/**
 * Template Method: the window arithmetic is shared, the targets and the applicability rule are
 * supplied by the subtype. A service that needs different numbers gets its own subclass rather
 * than a row of conditionals.
 */
public abstract class SlaPolicy {

    private final Map<Priority, SlaTarget> targets;

    protected SlaPolicy(Map<Priority, SlaTarget> targets) {
        if (targets == null || targets.isEmpty()) {
            throw new IllegalArgumentException("an SLA policy needs at least one target");
        }
        this.targets = new EnumMap<>(Priority.class);
        this.targets.putAll(targets);
    }

    public abstract String key();

    /** Whether this policy governs incidents on this service at this priority. */
    public abstract boolean appliesTo(ServiceRef service, Priority priority);

    public SlaTarget targetFor(Priority priority) {
        SlaTarget target = targets.get(priority);
        if (target == null) {
            throw new SlaPolicyMissingException(key(), priority.name());
        }
        return target;
    }

    public SlaWindow windowFor(Priority priority, Instant startedAt) {
        return SlaWindow.of(startedAt, targetFor(priority));
    }

    public Map<Priority, SlaTarget> targets() {
        return Map.copyOf(targets);
    }
}
