package com.spotlight.itsm.common.exception;

public class CapacityExceededException extends DomainException {

    public CapacityExceededException(int activeIncidents, int maxActiveIncidents) {
        super("CAPACITY_EXCEEDED",
                "That technician is at capacity (" + activeIncidents + " of " + maxActiveIncidents
                        + " active incidents).");
    }
}
