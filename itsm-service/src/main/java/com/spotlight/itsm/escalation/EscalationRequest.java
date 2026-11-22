package com.spotlight.itsm.escalation;

import java.util.UUID;

/**
 * An incident that needs to move up the ladder from {@code currentLevel} to {@code targetLevel}.
 * Levels: 0 nobody yet, 1 team lead, 2 system administrator, 3 IT manager.
 */
public record EscalationRequest(UUID incidentId, UUID assigneeId, int currentLevel, int targetLevel, String reason) {

    public EscalationRequest {
        if (currentLevel < 0 || targetLevel > EscalationLevel.MAX) {
            throw new IllegalArgumentException("escalation levels run from 0 to " + EscalationLevel.MAX);
        }
    }
}
