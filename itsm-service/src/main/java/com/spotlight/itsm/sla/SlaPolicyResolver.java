package com.spotlight.itsm.sla;

import com.spotlight.itsm.common.exception.SlaPolicyMissingException;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;

import java.util.List;

/**
 * Picks the applicable policy. First match wins, so register the tightest policy first.
 * An explicit configured profile (from the SLA settings screen) is consulted before these.
 */
public interface SlaPolicyResolver {

    SlaPolicy resolve(ServiceRef service, Priority priority);

    static SlaPolicyResolver firstMatch(List<SlaPolicy> policies) {
        if (policies == null || policies.isEmpty()) {
            throw new IllegalArgumentException("at least one SLA policy is required");
        }
        List<SlaPolicy> ordered = List.copyOf(policies);
        return (service, priority) -> ordered.stream()
                .filter(policy -> policy.appliesTo(service, priority))
                .findFirst()
                .orElseThrow(() -> new SlaPolicyMissingException(
                        service.code(), priority.name()));
    }
}
