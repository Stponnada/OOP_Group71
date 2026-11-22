package com.spotlight.itsm.incident.domain;

import com.spotlight.itsm.common.exception.InvalidTransitionException;
import com.spotlight.itsm.common.exception.UnauthorizedActionException;
import com.spotlight.itsm.common.exception.ValidationException;
import com.spotlight.itsm.sla.SlaWindow;
import com.spotlight.itsm.sla.StandardSlaPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The lifecycle truth table. No Spring, no database — these run in milliseconds and are the
 * first line of defence for the project's most-marked domain rule.
 */
class IncidentLifecycleTest {

    private static final Instant NOW = Instant.parse("2026-10-28T10:00:00Z");

    private UUID reporter;
    private UUID technician;
    private UUID admin;
    private CategoryRef category;
    private ServiceRef service;
    private SlaWindow window;

    @BeforeEach
    void setUp() {
        reporter = UUID.randomUUID();
        technician = UUID.randomUUID();
        admin = UUID.randomUUID();
        category = new CategoryRef(UUID.randomUUID(), "application", "Application");
        service = new ServiceRef(UUID.randomUUID(), "payments", "Payments",
                BusinessCriticality.REVENUE_OR_REGULATED, UUID.randomUUID());
        window = new StandardSlaPolicy().windowFor(Priority.P1, NOW);
    }

    private Incident newIncident() {
        return Incident.raise(IncidentId.random(), "INC-2026-000001", reporter, UUID.randomUUID(),
                "Payment app unavailable", "Users cannot complete transactions.", NOW);
    }

    private Incident classified() {
        Incident incident = newIncident();
        incident.classify(category, service, Impact.EXTENSIVE, Urgency.CRITICAL, 2000,
                PriorityAssessment.of(120, Priority.P1, "matrix"), window, reporter, NOW);
        return incident;
    }

    private Incident inProgress() {
        Incident incident = classified();
        incident.assignTo(technician, admin, NOW);
        incident.acknowledge(technician, NOW);
        incident.startWork(technician, NOW);
        return incident;
    }

    @Nested
    @DisplayName("the happy path")
    class HappyPath {

        @Test
        void walksTheFullLifecycle() {
            Incident incident = newIncident();
            assertThat(incident.status()).isEqualTo(IncidentStatus.NEW);

            incident.classify(category, service, Impact.EXTENSIVE, Urgency.CRITICAL, 2000,
                    PriorityAssessment.of(120, Priority.P1, "matrix"), window, reporter, NOW);
            assertThat(incident.status()).isEqualTo(IncidentStatus.CLASSIFIED);

            incident.assignTo(technician, admin, NOW);
            assertThat(incident.status()).isEqualTo(IncidentStatus.ASSIGNED);

            incident.acknowledge(technician, NOW);
            assertThat(incident.status()).isEqualTo(IncidentStatus.ACKNOWLEDGED);
            assertThat(incident.firstResponseAt()).isEqualTo(NOW);

            incident.startWork(technician, NOW);
            incident.resolve("Restarted the gateway and drained the queue.", technician, NOW);
            assertThat(incident.status()).isEqualTo(IncidentStatus.RESOLVED);

            incident.verify(reporter, NOW);
            incident.close(admin, NOW);
            assertThat(incident.status()).isEqualTo(IncidentStatus.CLOSED);
            assertThat(incident.isTerminal()).isTrue();
            assertThat(incident.closedAt()).isEqualTo(NOW);
        }

        @Test
        void recordsEveryTransitionInOrder() {
            Incident incident = inProgress();
            assertThat(incident.history()).extracting(Transition::to).containsExactly(
                    IncidentStatus.CLASSIFIED,
                    IncidentStatus.ASSIGNED,
                    IncidentStatus.ACKNOWLEDGED,
                    IncidentStatus.IN_PROGRESS);
        }
    }

    @Nested
    @DisplayName("illegal moves")
    class IllegalMoves {

        @Test
        void rejectsNewToClosed() {
            Incident incident = newIncident();
            assertThatThrownBy(() -> incident.close(admin, NOW))
                    .isInstanceOf(InvalidTransitionException.class)
                    .hasMessageContaining("NEW")
                    .hasMessageContaining("CLOSED");
            assertThat(incident.status()).isEqualTo(IncidentStatus.NEW);
        }

        @Test
        void rejectsResolvingBeforeAssignment() {
            Incident incident = classified();
            assertThatThrownBy(() -> incident.resolve("fixed", technician, NOW))
                    .isInstanceOf(InvalidTransitionException.class);
        }

        @Test
        void rejectsClosingBeforeVerification() {
            Incident incident = inProgress();
            incident.resolve("done", technician, NOW);
            assertThatThrownBy(() -> incident.close(admin, NOW))
                    .isInstanceOf(InvalidTransitionException.class);
        }

        @Test
        void rejectsAnyMoveOutOfATerminalState() {
            Incident incident = inProgress();
            incident.resolve("done", technician, NOW);
            incident.verify(reporter, NOW);
            incident.close(admin, NOW);

            assertThatThrownBy(() -> incident.cancel(admin, "changed my mind", NOW))
                    .isInstanceOf(InvalidTransitionException.class);
        }

        @Test
        void leavesNoTraceOfARejectedMove() {
            Incident incident = newIncident();
            int before = incident.history().size();
            assertThatThrownBy(() -> incident.verify(reporter, NOW))
                    .isInstanceOf(InvalidTransitionException.class);
            assertThat(incident.history()).hasSize(before);
            assertThat(incident.status()).isEqualTo(IncidentStatus.NEW);
        }
    }

    @Nested
    @DisplayName("who may act")
    class Authorization {

        @Test
        void onlyTheAssigneeAcknowledges() {
            Incident incident = classified();
            incident.assignTo(technician, admin, NOW);
            assertThatThrownBy(() -> incident.acknowledge(admin, NOW))
                    .isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        void onlyTheAssigneeResolves() {
            Incident incident = inProgress();
            assertThatThrownBy(() -> incident.resolve("done", admin, NOW))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThat(incident.status()).isEqualTo(IncidentStatus.IN_PROGRESS);
        }

        @Test
        void onlyTheReporterVerifies() {
            Incident incident = inProgress();
            incident.resolve("done", technician, NOW);
            assertThatThrownBy(() -> incident.verify(technician, NOW))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThat(incident.status()).isEqualTo(IncidentStatus.RESOLVED);
        }
    }

    @Nested
    @DisplayName("required content")
    class RequiredContent {

        @Test
        void rejectsResolutionWithoutANote() {
            Incident incident = inProgress();
            assertThatThrownBy(() -> incident.resolve("   ", technician, NOW))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("resolution note");
        }

        @Test
        void rejectsCancellationWithoutAReason() {
            Incident incident = classified();
            assertThatThrownBy(() -> incident.cancel(reporter, null, NOW))
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        void rejectsAnOverlongTitle() {
            assertThatThrownBy(() -> Incident.raise(IncidentId.random(), "INC-1", reporter,
                    UUID.randomUUID(), "x".repeat(201), "body", NOW))
                    .isInstanceOf(ValidationException.class);
        }
    }

    @Nested
    @DisplayName("reassignment and reopening")
    class Reassignment {

        @Test
        void reassignmentKeepsTheLifecycleAndTheSlaClock() {
            Incident incident = classified();
            incident.assignTo(technician, admin, NOW);
            UUID second = UUID.randomUUID();
            incident.assignTo(second, admin, NOW);

            assertThat(incident.status()).isEqualTo(IncidentStatus.ASSIGNED);
            assertThat(incident.assignee()).contains(second);
        }

        @Test
        void rejectionSendsItBackToTheTechnician() {
            Incident incident = inProgress();
            incident.resolve("done", technician, NOW);
            incident.rejectResolution(reporter, "Still failing for finance.", NOW);

            assertThat(incident.status()).isEqualTo(IncidentStatus.IN_PROGRESS);
            assertThat(incident.resolvedAt()).isNull();
        }
    }
}
