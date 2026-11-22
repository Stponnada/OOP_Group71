package com.spotlight.itsm.escalation;

import com.spotlight.itsm.sla.SlaWindow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The escalation ladder: which rung an incident needs, and who each rung reaches. */
class EscalationChainTest {

    private static final UUID TECH = UUID.randomUUID();
    private static final UUID LEAD = UUID.randomUUID();
    private static final UUID SYSADMIN = UUID.randomUUID();
    private static final UUID MANAGER = UUID.randomUUID();

    private record Directory(UUID lead, List<UUID> admins, List<UUID> managers) implements EscalationDirectory {
        @Override
        public Optional<UUID> teamLeadOf(UUID technicianId) {
            return Optional.ofNullable(lead);
        }

        @Override
        public List<UUID> systemAdministrators() {
            return admins;
        }

        @Override
        public List<UUID> itManagers() {
            return managers;
        }
    }

    private static EscalationRequest climb(int from, int to) {
        return new EscalationRequest(UUID.randomUUID(), TECH, from, to, "test");
    }

    @Nested
    @DisplayName("the chain of handlers")
    class Chain {

        @Test
        void firstRungReachesTheTeamLead() {
            var steps = EscalationHandler.standardChain()
                    .escalate(climb(0, 1), new Directory(LEAD, List.of(SYSADMIN), List.of(MANAGER)));

            assertThat(steps).hasSize(1);
            assertThat(steps.get(0).level()).isEqualTo(1);
            assertThat(steps.get(0).handledBy()).isEqualTo("Team lead");
            assertThat(steps.get(0).recipients()).containsExactly(LEAD);
        }

        @Test
        void withoutATeamLeadTheRequestPassesUp() {
            var steps = EscalationHandler.standardChain()
                    .escalate(climb(0, 1), new Directory(null, List.of(SYSADMIN), List.of(MANAGER)));

            assertThat(steps.get(0).level()).isEqualTo(1);
            assertThat(steps.get(0).handledBy()).isEqualTo("System administrator");
            assertThat(steps.get(0).recipients()).containsExactly(SYSADMIN);
        }

        @Test
        void climbsEveryRungBetweenCurrentAndTarget() {
            var steps = EscalationHandler.standardChain()
                    .escalate(climb(0, 3), new Directory(LEAD, List.of(SYSADMIN), List.of(MANAGER)));

            assertThat(steps).extracting(EscalationStep::level).containsExactly(1, 2, 3);
            assertThat(steps).extracting(EscalationStep::handledBy)
                    .containsExactly("Team lead", "System administrator", "IT manager");
        }

        @Test
        void neverRepeatsARungAlreadyReached() {
            var steps = EscalationHandler.standardChain()
                    .escalate(climb(2, 3), new Directory(LEAD, List.of(SYSADMIN), List.of(MANAGER)));

            assertThat(steps).extracting(EscalationStep::level).containsExactly(3);
            assertThat(steps.get(0).recipients()).containsExactly(MANAGER);
        }

        @Test
        void saysSoWhenNobodyHoldsAnyRole() {
            var steps = EscalationHandler.standardChain()
                    .escalate(climb(2, 3), new Directory(null, List.of(), List.of()));

            assertThat(steps.get(0).recipients()).isEmpty();
            assertThat(steps.get(0).handledBy()).contains("nobody holds this role");
        }
    }

    @Nested
    @DisplayName("the level an incident needs")
    class Policy {

        private final Instant start = Instant.parse("2026-11-01T10:00:00Z");
        // 1 hour to respond, 4 hours to resolve.
        private final SlaWindow window = new SlaWindow(start, start.plus(Duration.ofHours(1)),
                start.plus(Duration.ofHours(4)), 75);

        @Test
        void nothingWhileOnTrack() {
            assertThat(EscalationPolicy.requiredLevel(window, null, null, start.plus(Duration.ofMinutes(30))))
                    .isZero();
        }

        @Test
        void teamLeadWhenNobodyRespondedInTime() {
            assertThat(EscalationPolicy.requiredLevel(window, null, null, start.plus(Duration.ofMinutes(61))))
                    .isEqualTo(EscalationLevel.TEAM_LEAD);
        }

        @Test
        void aResponseInTimeKeepsItOffTheLadder() {
            Instant responded = start.plus(Duration.ofMinutes(20));
            assertThat(EscalationPolicy.requiredLevel(window, responded, null, start.plus(Duration.ofHours(2))))
                    .isZero();
        }

        @Test
        void systemAdministratorOnceTheResolutionDeadlinePasses() {
            Instant responded = start.plus(Duration.ofMinutes(20));
            assertThat(EscalationPolicy.requiredLevel(window, responded, null, start.plus(Duration.ofMinutes(241))))
                    .isEqualTo(EscalationLevel.SYSTEM_ADMINISTRATOR);
        }

        @Test
        void itManagerWhenOverdueByHalfTheWindowAgain() {
            assertThat(EscalationPolicy.requiredLevel(window, null, null, start.plus(Duration.ofMinutes(361))))
                    .isEqualTo(EscalationLevel.IT_MANAGER);
        }

        @Test
        void aResolvedIncidentNeverEscalates() {
            assertThat(EscalationPolicy.requiredLevel(window, null, start.plus(Duration.ofHours(5)),
                    start.plus(Duration.ofHours(9)))).isZero();
        }
    }
}
