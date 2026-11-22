package com.spotlight.itsm.incident.application;

import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Urgency;

import java.util.UUID;

public record CreateIncidentCommand(
        String title,
        String description,
        UUID categoryId,
        UUID serviceId,
        Impact impact,
        Urgency urgency,
        int affectedUsers,
        boolean securityIncident
) {
}
