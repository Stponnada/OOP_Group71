package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** Terminal. Reachable from any non-terminal state, always with a reason. */
public final class CancelledState implements IncidentState {

    public static final CancelledState INSTANCE = new CancelledState();

    private CancelledState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.CANCELLED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of();
    }
}
