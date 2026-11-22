package com.spotlight.itsm.sla;

import java.time.Duration;
import java.time.Instant;

/**
 * Forecasts a breach from how long similar incidents have actually taken.
 *
 * <p>With history: the work still expected is the median resolution time minus what has already
 * elapsed (never less than a quarter of the median, since a long-running incident isn't nearly
 * done just because the median has passed). Compared with the time left on the clock, that gives
 * HIGH when the expected work doesn't fit, MEDIUM when it fills most of what's left, LOW
 * otherwise. Without history (a new service, or the first incidents of a priority) the forecast
 * falls back to how much of the window has gone.
 */
public final class HistoricalSlaRiskAssessor implements SlaRiskAssessor {

    private static final double HIGH_RATIO = 1.0;
    private static final double MEDIUM_RATIO = 0.6;

    @Override
    public RiskBand assess(SlaWindow window, Duration medianResolutionForService, Instant now) {
        Duration remaining = Duration.between(now, window.resolutionDueAt());
        if (remaining.isNegative() || remaining.isZero()) {
            return RiskBand.BREACHED;
        }
        Duration elapsed = Duration.between(window.startedAt(), now);
        if (elapsed.isNegative()) {
            elapsed = Duration.ZERO;
        }

        if (medianResolutionForService == null || medianResolutionForService.isZero()) {
            Duration total = Duration.between(window.startedAt(), window.resolutionDueAt());
            double used = total.isZero() ? 1.0 : (double) elapsed.toSeconds() / total.toSeconds();
            if (used >= window.warningPercent() / 100.0) {
                return RiskBand.HIGH;
            }
            return used >= 0.5 ? RiskBand.MEDIUM : RiskBand.LOW;
        }

        long median = medianResolutionForService.toSeconds();
        long expectedLeft = Math.max(median - elapsed.toSeconds(), median / 4);
        double ratio = (double) expectedLeft / remaining.toSeconds();
        if (ratio >= HIGH_RATIO) {
            return RiskBand.HIGH;
        }
        return ratio >= MEDIUM_RATIO ? RiskBand.MEDIUM : RiskBand.LOW;
    }
}
