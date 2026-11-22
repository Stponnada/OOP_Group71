package com.spotlight.itsm.escalation;

import com.spotlight.itsm.sla.SlaWindow;

import java.time.Duration;
import java.time.Instant;

/**
 * How far up the ladder an open incident should be, from its SLA clock alone:
 * <ul>
 *   <li>1 (team lead) once the response deadline passes with nobody having responded;</li>
 *   <li>2 (system administrator) once the resolution deadline passes;</li>
 *   <li>3 (IT manager) once it is overdue by another half of its resolution window.</li>
 * </ul>
 */
public final class EscalationPolicy {

    private EscalationPolicy() {
    }

    public static int requiredLevel(SlaWindow window, Instant firstResponseAt, Instant resolvedAt, Instant now) {
        if (resolvedAt != null) {
            return 0;
        }
        Duration windowLength = Duration.between(window.startedAt(), window.resolutionDueAt());
        if (now.isAfter(window.resolutionDueAt().plus(windowLength.dividedBy(2)))) {
            return EscalationLevel.IT_MANAGER;
        }
        if (now.isAfter(window.resolutionDueAt())) {
            return EscalationLevel.SYSTEM_ADMINISTRATOR;
        }
        if (firstResponseAt == null && now.isAfter(window.responseDueAt())) {
            return EscalationLevel.TEAM_LEAD;
        }
        return 0;
    }

    public static String reasonFor(int level) {
        return switch (level) {
            case EscalationLevel.TEAM_LEAD -> "Nobody responded within the response target";
            case EscalationLevel.SYSTEM_ADMINISTRATOR -> "Resolution deadline passed";
            default -> "Still unresolved well past the resolution deadline";
        };
    }
}
