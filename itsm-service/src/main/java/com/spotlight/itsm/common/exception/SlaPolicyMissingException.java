package com.spotlight.itsm.common.exception;

/**
 * No SLA profile covers this service and priority. Failing loudly is deliberate: silently
 * defaulting would let an incident run with no deadline and hide a configuration gap.
 */
public class SlaPolicyMissingException extends DomainException {

    public SlaPolicyMissingException(String service, String priority) {
        super("SLA_POLICY_MISSING",
                "No SLA policy is configured for service " + service + " at priority " + priority + ".");
    }
}
