package com.spotlight.itsm.sla;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** Tighter targets for revenue-bearing or regulated services. */
public final class CriticalServiceSlaPolicy extends SlaPolicy {

    public static final String KEY = "critical-service";

    private static final Set<BusinessCriticality> APPLIES_TO =
            EnumSet.of(BusinessCriticality.CRITICAL, BusinessCriticality.REVENUE_OR_REGULATED);

    public CriticalServiceSlaPolicy() {
        super(Map.of(
                Priority.P1, new SlaTarget(5, 20, 75),
                Priority.P2, new SlaTarget(10, 90, 75),
                Priority.P3, new SlaTarget(45, 360, 75),
                Priority.P4, new SlaTarget(180, 1440, 75)));
    }

    /** Same rule, with the targets an administrator has configured for this profile. */
    public CriticalServiceSlaPolicy(Map<Priority, SlaTarget> targets) {
        super(targets);
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public boolean appliesTo(ServiceRef service, Priority priority) {
        return APPLIES_TO.contains(service.criticality());
    }
}
