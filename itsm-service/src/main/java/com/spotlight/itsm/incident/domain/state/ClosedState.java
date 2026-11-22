package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** Terminal. */
public final class ClosedState implements IncidentState {

    public static final ClosedState INSTANCE = new ClosedState();

    private ClosedState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.CLOSED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of();
    }
}
