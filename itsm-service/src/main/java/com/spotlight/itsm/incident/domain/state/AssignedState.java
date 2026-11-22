package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/**
 * Owned by a technician who has not picked it up yet. {@code ASSIGNED -> ASSIGNED} is a legal
 * self-move: it is how a reassignment is recorded without resetting the SLA clock.
 */
public final class AssignedState implements IncidentState {

    public static final AssignedState INSTANCE = new AssignedState();

    private AssignedState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.ASSIGNED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.ASSIGNED, IncidentStatus.ACKNOWLEDGED, IncidentStatus.CANCELLED);
    }
}
