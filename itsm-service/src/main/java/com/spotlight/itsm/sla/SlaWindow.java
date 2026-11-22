package com.spotlight.itsm.sla;

import java.time.Duration;
import java.time.Instant;

/**
 * The two deadlines calculated when an incident is classified.
 *
 * <p>Everything derives from {@code startedAt} and the target, so a window is reproducible and
 * can be recalculated for reporting without drifting. Warning thresholds are interpolated rather
 * than stored, so changing the warning percentage does not require a backfill.
 */
public record SlaWindow(
        Instant startedAt,
        Instant responseDueAt,
        Instant resolutionDueAt,
        int warningPercent
) {

    public SlaWindow {
        if (startedAt == null || responseDueAt == null || resolutionDueAt == null) {
            throw new IllegalArgumentException("a SLA window needs a start and two deadlines");
        }
        if (resolutionDueAt.isBefore(responseDueAt)) {
            throw new IllegalArgumentException("resolution deadline cannot precede the response deadline");
        }
    }

    public static SlaWindow of(Instant startedAt, SlaTarget target) {
        return new SlaWindow(
                startedAt,
                startedAt.plus(Duration.ofMinutes(target.responseMinutes())),
                startedAt.plus(Duration.ofMinutes(target.resolutionMinutes())),
                target.warningPercent());
    }

    public Instant responseWarningAt() {
        return interpolate(startedAt, responseDueAt);
    }

    public Instant resolutionWarningAt() {
        return interpolate(startedAt, resolutionDueAt);
    }

    public boolean responseBreached(Instant firstResponseAt, Instant now) {
        Instant observed = firstResponseAt != null ? firstResponseAt : now;
        return observed.isAfter(responseDueAt);
    }

    public boolean resolutionBreached(Instant resolvedAt, Instant now) {
        Instant observed = resolvedAt != null ? resolvedAt : now;
        return observed.isAfter(resolutionDueAt);
    }

    public Duration remaining(Instant now) {
        return Duration.between(now, resolutionDueAt);
    }

    private Instant interpolate(Instant from, Instant to) {
        long span = Duration.between(from, to).toMillis();
        return from.plusMillis(Math.round(span * (warningPercent / 100.0)));
    }
}
