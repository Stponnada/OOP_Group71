package com.spotlight.itsm.incident.domain;

import com.spotlight.itsm.sla.SlaWindow;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A flat, complete picture of an incident, used by the persistence adapter to rehydrate the
 * aggregate and by the API to serialise it. It exists so {@link Incident} never needs a
 * public all-args constructor: the only ways in are {@code raise} and {@code restore}.
 */
public record IncidentSnapshot(
        IncidentId id,
        String reference,
        UUID reporterId,
        UUID orgId,
        CategoryRef category,
        ServiceRef service,
        String title,
        String description,
        Impact impact,
        Urgency urgency,
        BusinessCriticality businessCriticality,
        int affectedUsers,
        PriorityAssessment priority,
        IncidentStatus status,
        UUID assignedTechnicianId,
        SlaWindow slaWindow,
        String resolutionNote,
        Instant firstResponseAt,
        Instant acknowledgedAt,
        Instant resolvedAt,
        Instant verifiedAt,
        Instant closedAt,
        Instant createdAt,
        long version,
        List<Transition> history
) {
}
