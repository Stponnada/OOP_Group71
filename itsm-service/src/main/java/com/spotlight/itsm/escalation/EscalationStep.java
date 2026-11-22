package com.spotlight.itsm.escalation;

import java.util.List;
import java.util.UUID;

/**
 * One rung climbed. {@code handledBy} names who actually took it, which differs from the rung
 * when nobody holds that role (no team lead set, say) and the request was passed further up.
 */
public record EscalationStep(int level, String handledBy, List<UUID> recipients, String reason) {

    public EscalationStep {
        recipients = List.copyOf(recipients);
    }
}
