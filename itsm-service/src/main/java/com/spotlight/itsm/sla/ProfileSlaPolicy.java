package com.spotlight.itsm.sla;

import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;

import java.util.Map;

/**
 * The SLA profile an administrator attached to a service in the catalog. It applies to that
 * service unconditionally, which is why it is consulted before the rule-based policies.
 */
public final class ProfileSlaPolicy extends SlaPolicy {

    private final String code;

    public ProfileSlaPolicy(String code, Map<Priority, SlaTarget> targets) {
        super(targets);
        this.code = code;
    }

    @Override
    public String key() {
        return code;
    }

    @Override
    public boolean appliesTo(ServiceRef service, Priority priority) {
        return true;
    }
}
