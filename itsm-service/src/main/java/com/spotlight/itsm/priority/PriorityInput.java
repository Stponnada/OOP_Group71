package com.spotlight.itsm.priority;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Urgency;

/**
 * Everything a priority calculation may legitimately look at. Passing an explicit input rather
 * than the incident itself keeps the calculators pure and prevents them reaching for fields they
 * should not depend on.
 */
public record PriorityInput(
        Impact impact,
        Urgency urgency,
        BusinessCriticality criticality,
        int affectedUsers,
        boolean securityIncident,
        boolean regulatedService,
        boolean executiveReporter,
        String categoryCode,
        String serviceCode
) {

    public PriorityInput {
        if (impact == null || urgency == null || criticality == null) {
            throw new IllegalArgumentException("impact, urgency and criticality are all required");
        }
        if (affectedUsers < 0) {
            throw new IllegalArgumentException("affectedUsers cannot be negative");
        }
    }
}
