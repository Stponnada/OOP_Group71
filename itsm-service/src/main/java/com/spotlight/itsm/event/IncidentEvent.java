package com.spotlight.itsm.event;

import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Priority;

import java.time.Instant;
import java.util.UUID;

/**
 * Sealed domain events. A closed hierarchy means the notification, audit and SLA subscribers get
 * an exhaustive compile-time check when a new event type is added — Java 21's sealed types doing
 * real work rather than decoration.
 */
public sealed interface IncidentEvent
        permits IncidentEvent.Created, IncidentEvent.Classified, IncidentEvent.Assigned,
                IncidentEvent.Acknowledged, IncidentEvent.Resolved, IncidentEvent.Closed,
                IncidentEvent.SlaWarningRaised, IncidentEvent.SlaBreached,
                IncidentEvent.Escalated {

    UUID incidentId();

    String reference();

    Instant occurredAt();

    record Created(UUID incidentId, String reference, UUID reporterId, Instant occurredAt)
            implements IncidentEvent {
    }

    record Classified(UUID incidentId, String reference, UUID categoryId, Priority priority, Instant occurredAt)
            implements IncidentEvent {
    }

    record Assigned(UUID incidentId, String reference, UUID technicianId, UUID assignedBy, Instant occurredAt)
            implements IncidentEvent {
    }

    record Acknowledged(UUID incidentId, String reference, UUID technicianId, Instant occurredAt)
            implements IncidentEvent {
    }

    record Resolved(UUID incidentId, String reference, UUID technicianId, Instant occurredAt)
            implements IncidentEvent {
    }

    record Closed(UUID incidentId, String reference, Instant occurredAt)
            implements IncidentEvent {
    }

    record SlaWarningRaised(UUID incidentId, String reference, Instant dueAt, Instant occurredAt)
            implements IncidentEvent {
    }

    record SlaBreached(UUID incidentId, String reference, IncidentStatus statusAtBreach, Instant dueAt, Instant occurredAt)
            implements IncidentEvent {
    }

    record Escalated(UUID incidentId, String reference, int level, UUID toEmployeeId, Instant occurredAt)
            implements IncidentEvent {
    }
}
