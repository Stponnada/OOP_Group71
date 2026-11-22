package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** Being investigated. Also the state a rejected resolution returns to. */
public final class InProgressState implements IncidentState {

    public static final InProgressState INSTANCE = new InProgressState();

    private InProgressState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.IN_PROGRESS;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.RESOLVED, IncidentStatus.CANCELLED);
    }
}
