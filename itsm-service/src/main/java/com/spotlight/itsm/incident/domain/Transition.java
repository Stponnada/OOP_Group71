package com.spotlight.itsm.incident.domain;

import java.time.Instant;
import java.util.UUID;

/** An immutable lifecycle event, kept on the aggregate and persisted to the history table. */
public record Transition(
        IncidentStatus from,
        IncidentStatus to,
        UUID actorId,
        String reason,
        Instant occurredAt
) {
}
