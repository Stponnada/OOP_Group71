package com.spotlight.itsm.sla;

import java.time.Instant;

/**
 * Reads a window and says where the incident stands. Deliberately pure and instant-parameterised
 * so tests can move time without a scheduler and the API can compute status on read even if the
 * background monitor never ran.
 */
public final class SlaClock {

    public SlaStatus responseStatus(SlaWindow window, Instant firstResponseAt, Instant now) {
        if (firstResponseAt != null) {
            return firstResponseAt.isAfter(window.responseDueAt()) ? SlaStatus.BREACHED : SlaStatus.MET;
        }
        if (now.isAfter(window.responseDueAt())) {
            return SlaStatus.BREACHED;
        }
        return now.isAfter(window.responseWarningAt()) ? SlaStatus.WARNING : SlaStatus.ON_TRACK;
    }

    public SlaStatus resolutionStatus(SlaWindow window, Instant resolvedAt, Instant now) {
        if (resolvedAt != null) {
            return resolvedAt.isAfter(window.resolutionDueAt()) ? SlaStatus.BREACHED : SlaStatus.MET;
        }
        if (now.isAfter(window.resolutionDueAt())) {
            return SlaStatus.BREACHED;
        }
        return now.isAfter(window.resolutionWarningAt()) ? SlaStatus.WARNING : SlaStatus.ON_TRACK;
    }

    /** The worse of the two legs; what the dashboard badge shows. */
    public SlaStatus overall(SlaWindow window, Instant firstResponseAt, Instant resolvedAt, Instant now) {
        return worse(
                responseStatus(window, firstResponseAt, now),
                resolutionStatus(window, resolvedAt, now));
    }

    private SlaStatus worse(SlaStatus a, SlaStatus b) {
        return severity(a) >= severity(b) ? a : b;
    }

    private int severity(SlaStatus status) {
        return switch (status) {
            case BREACHED -> 3;
            case WARNING -> 2;
            case ON_TRACK -> 1;
            case MET -> 0;
        };
    }
}
