package com.spotlight.itsm.sla;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;

import java.util.Map;

/** The house default: the same targets for every service that has no override. */
public final class StandardSlaPolicy extends SlaPolicy {

    public static final String KEY = "standard";

    public StandardSlaPolicy() {
        super(Map.of(
                Priority.P1, new SlaTarget(5, 30, 75),
                Priority.P2, new SlaTarget(15, 120, 75),
                Priority.P3, new SlaTarget(60, 480, 75),
                Priority.P4, new SlaTarget(240, 1440, 75)));
    }

    /** Same rule, with the targets an administrator has configured for this profile. */
    public StandardSlaPolicy(Map<Priority, SlaTarget> targets) {
        super(targets);
    }

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public boolean appliesTo(ServiceRef service, Priority priority) {
        return true;
    }

    /** Convenience for seeding: does this service deserve the tighter policy? */
    public static boolean isBusinessCritical(ServiceRef service) {
        return service.criticality().atLeast(BusinessCriticality.HIGH);
    }
}
