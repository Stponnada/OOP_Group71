package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** Filed, not yet classified. Cannot be closed directly. */
public final class NewState implements IncidentState {

    public static final NewState INSTANCE = new NewState();

    private NewState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.NEW;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.CLASSIFIED, IncidentStatus.CANCELLED);
    }
}
