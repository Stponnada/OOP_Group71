package com.spotlight.itsm.event;

import com.spotlight.itsm.incident.domain.Incident;

import java.util.UUID;

/**
 * Something happened to an incident that isn't a status change: a question for the reporter, the
 * reporter's answer, feedback, or the incident being linked to another. Raised inside the command's
 * transaction and handled after it commits, like {@link IncidentChangedEvent}.
 */
public record IncidentActivityEvent(Incident incident, UUID actorId, Activity activity, String detail) {

    public enum Activity {
        INFO_REQUESTED,
        INFO_PROVIDED,
        FEEDBACK,
        LINKED
    }
}
