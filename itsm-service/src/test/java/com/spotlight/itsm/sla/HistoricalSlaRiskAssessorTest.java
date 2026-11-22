package com.spotlight.itsm.sla;

import com.spotlight.itsm.sla.SlaRiskAssessor.RiskBand;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class HistoricalSlaRiskAssessorTest {

    private static final Instant START = Instant.parse("2026-11-01T10:00:00Z");
    // Four hours to resolve, warning at 75%.
    private static final SlaWindow WINDOW = new SlaWindow(START, START.plus(Duration.ofHours(1)),
            START.plus(Duration.ofHours(4)), 75);

    private final HistoricalSlaRiskAssessor assessor = new HistoricalSlaRiskAssessor();

    private RiskBand at(Duration elapsed, Duration median) {
        return assessor.assess(WINDOW, median, START.plus(elapsed));
    }

    @Test
    void lowWhenSimilarIncidentsFinishWellInside() {
        assertThat(at(Duration.ofMinutes(30), Duration.ofHours(1))).isEqualTo(RiskBand.LOW);
    }

    @Test
    void highWhenTheUsualTimeNoLongerFits() {
        // Typically takes 5h; 1h gone, 3h left: 4h of expected work won't fit.
        assertThat(at(Duration.ofHours(1), Duration.ofHours(5))).isEqualTo(RiskBand.HIGH);
    }

    @Test
    void mediumWhenTheExpectedWorkFillsMostOfWhatIsLeft() {
        // Typically 3h; 1h gone leaves 2h of work against 3h on the clock.
        assertThat(at(Duration.ofHours(1), Duration.ofHours(3))).isEqualTo(RiskBand.MEDIUM);
    }

    @Test
    void fallsBackToTheClockWithoutHistory() {
        assertThat(at(Duration.ofMinutes(30), null)).isEqualTo(RiskBand.LOW);
        assertThat(at(Duration.ofMinutes(150), null)).isEqualTo(RiskBand.MEDIUM);
        assertThat(at(Duration.ofMinutes(190), null)).isEqualTo(RiskBand.HIGH);
    }

    @Test
    void breachedOncePastTheDeadline() {
        assertThat(at(Duration.ofHours(5), Duration.ofHours(1))).isEqualTo(RiskBand.BREACHED);
    }
}
