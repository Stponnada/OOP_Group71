package com.spotlight.itsm.event;

import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.UUID;

/**
 * Internal Spring event raised after a successful command. Listeners run after the transaction
 * commits, so a failed email can never roll back an incident and a notification is never sent
 * for a change that did not stick.
 */
public record IncidentChangedEvent(
        Incident incident,
        UUID actorId,
        IncidentStatus from,
        IncidentStatus to,
        String note
) {
    public boolean isCreation() {
        return from == IncidentStatus.NEW;
    }
}
