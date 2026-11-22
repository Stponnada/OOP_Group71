package com.spotlight.itsm.event;

import java.util.List;
import java.util.UUID;

/**
 * The SLA monitor found something people need to hear about: a deadline getting close, a deadline
 * missed, or an incident climbing the escalation ladder. The monitor decides who; the
 * notification side decides how.
 */
public record SlaAlertEvent(UUID incidentId, String reference, String title, String priority,
                            Alert alert, List<UUID> recipients, String detail) {

    public SlaAlertEvent {
        recipients = List.copyOf(recipients);
    }

    public enum Alert {
        WARNING,
        BREACHED,
        ESCALATED
    }
}
