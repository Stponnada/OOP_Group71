package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** Fixed, waiting for the reporter to confirm. Rejection sends it back to IN_PROGRESS. */
public final class ResolvedState implements IncidentState {

    public static final ResolvedState INSTANCE = new ResolvedState();

    private ResolvedState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.RESOLVED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.VERIFIED, IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED);
    }
}
