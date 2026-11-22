package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** The reporter accepted the fix. Only from here may an incident be closed. */
public final class VerifiedState implements IncidentState {

    public static final VerifiedState INSTANCE = new VerifiedState();

    private VerifiedState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.VERIFIED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.CLOSED);
    }
}
