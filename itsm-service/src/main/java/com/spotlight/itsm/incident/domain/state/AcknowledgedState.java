package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** The technician has responded; this is where the SLA response clock stops. */
public final class AcknowledgedState implements IncidentState {

    public static final AcknowledgedState INSTANCE = new AcknowledgedState();

    private AcknowledgedState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.ACKNOWLEDGED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED);
    }
}
