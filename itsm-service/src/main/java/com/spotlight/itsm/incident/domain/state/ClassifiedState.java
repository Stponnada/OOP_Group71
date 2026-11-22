package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/** Category, service and priority are known; no technician yet. */
public final class ClassifiedState implements IncidentState {

    public static final ClassifiedState INSTANCE = new ClassifiedState();

    private ClassifiedState() {
    }

    @Override
    public IncidentStatus status() {
        return IncidentStatus.CLASSIFIED;
    }

    @Override
    public Set<IncidentStatus> successors() {
        return Set.of(IncidentStatus.ASSIGNED, IncidentStatus.CANCELLED);
    }
}
