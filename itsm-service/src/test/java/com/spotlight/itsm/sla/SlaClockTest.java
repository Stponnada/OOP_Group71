package com.spotlight.itsm.sla;

import com.spotlight.itsm.incident.domain.Priority;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SlaClockTest {

    private static final Instant START = Instant.parse("2026-10-28T10:00:00Z");
    private final SlaClock clock = new SlaClock();
    private final SlaWindow p1 = new StandardSlaPolicy().windowFor(Priority.P1, START);

    @Test
    void p1DeadlinesMatchTheAgreedTargets() {
        assertThat(p1.responseDueAt()).isEqualTo(START.plusSeconds(5 * 60));
        assertThat(p1.resolutionDueAt()).isEqualTo(START.plusSeconds(30 * 60));
    }

    @Test
    void warningFiresAtSeventyFivePercent() {
        assertThat(p1.resolutionWarningAt()).isEqualTo(START.plusSeconds((long) (30 * 60 * 0.75)));
    }

    @Test
    void onTrackBeforeTheWarning() {
        assertThat(clock.resolutionStatus(p1, null, START.plusSeconds(60)))
                .isEqualTo(SlaStatus.ON_TRACK);
    }

    @Test
    void warningBetweenWarningAndDeadline() {
        assertThat(clock.resolutionStatus(p1, null, START.plusSeconds(23 * 60)))
                .isEqualTo(SlaStatus.WARNING);
    }

    @Test
    void breachedAfterTheDeadline() {
        assertThat(clock.resolutionStatus(p1, null, START.plusSeconds(31 * 60)))
                .isEqualTo(SlaStatus.BREACHED);
    }

    @Test
    void metWhenResolvedInTime() {
        assertThat(clock.resolutionStatus(p1, START.plusSeconds(10 * 60), START.plusSeconds(90 * 60)))
                .isEqualTo(SlaStatus.MET);
    }

    @Test
    void breachedWhenResolvedLateEvenIfTheClockHasMovedOn() {
        assertThat(clock.resolutionStatus(p1, START.plusSeconds(40 * 60), START.plusSeconds(50 * 60)))
                .isEqualTo(SlaStatus.BREACHED);
    }

    @Test
    void responseAndResolutionLegsAreIndependent() {
        assertThat(clock.responseStatus(p1, START.plusSeconds(30), START.plusSeconds(20 * 60)))
                .isEqualTo(SlaStatus.MET);
        assertThat(clock.resolutionStatus(p1, null, START.plusSeconds(25 * 60)))
                .isEqualTo(SlaStatus.WARNING);
    }

    @Test
    void overallReportsTheWorseLeg() {
        assertThat(clock.overall(p1, START.plusSeconds(10), null, START.plusSeconds(31 * 60)))
                .isEqualTo(SlaStatus.BREACHED);
    }

    @ParameterizedTest(name = "{0} -> response {1}m / resolution {2}m")
    @CsvSource({"P1,5,30", "P2,15,120", "P3,60,480", "P4,240,1440"})
    void standardTargetsMatchTheBlueprint(Priority priority, int response, int resolution) {
        SlaTarget target = new StandardSlaPolicy().targetFor(priority);
        assertThat(target.responseMinutes()).isEqualTo(response);
        assertThat(target.resolutionMinutes()).isEqualTo(resolution);
    }
}
