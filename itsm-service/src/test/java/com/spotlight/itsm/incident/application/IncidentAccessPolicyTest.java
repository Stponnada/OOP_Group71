package com.spotlight.itsm.incident.application;

import com.spotlight.itsm.common.exception.UnauthorizedActionException;
import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.CategoryRef;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentAction;
import com.spotlight.itsm.incident.domain.IncidentId;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.PriorityAssessment;
import com.spotlight.itsm.incident.domain.ServiceRef;
import com.spotlight.itsm.incident.domain.Urgency;
import com.spotlight.itsm.sla.StandardSlaPolicy;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static com.spotlight.itsm.incident.domain.IncidentAction.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Who sees which buttons. The UI renders exactly this set, so each case here is a screen in the
 * two-account demo: the reporter's view and the service desk's view of the same incident.
 */
class IncidentAccessPolicyTest {

    private static final Instant NOW = Instant.parse("2026-11-01T10:00:00Z");

    private final IncidentAccessPolicy policy = new IncidentAccessPolicy();

    private final EmployeePrincipal reporter = person(false, false);
    private final EmployeePrincipal technician = person(true, false);
    private final EmployeePrincipal otherTechnician = person(true, false);
    private final EmployeePrincipal admin = person(true, true);
    private final EmployeePrincipal bystander = person(false, false);

    private static EmployeePrincipal person(boolean technician, boolean admin) {
        return new EmployeePrincipal(UUID.randomUUID(), UUID.randomUUID(), "Someone Else", "x@example.test",
                technician, admin, Set.of());
    }

    private Incident classified() {
        Incident incident = Incident.raise(IncidentId.random(), "INC-2026-000001", reporter.employeeId(),
                UUID.randomUUID(), "VPN keeps dropping", "Disconnects every few minutes.", NOW);
        incident.classify(
                new CategoryRef(UUID.randomUUID(), "network", "Network"),
                new ServiceRef(UUID.randomUUID(), "vpn", "VPN", BusinessCriticality.HIGH, UUID.randomUUID()),
                Impact.MINOR, Urgency.HIGH, 1, PriorityAssessment.of(40, Priority.P3, "matrix"),
                new StandardSlaPolicy().windowFor(Priority.P3, NOW), reporter.employeeId(), NOW);
        return incident;
    }

    private Incident assigned() {
        Incident incident = classified();
        incident.assignTo(technician.employeeId(), admin.employeeId(), NOW);
        return incident;
    }

    private Incident resolved() {
        Incident incident = assigned();
        incident.acknowledge(technician.employeeId(), NOW);
        incident.startWork(technician.employeeId(), NOW);
        incident.resolve("Replaced the VPN profile.", technician.employeeId(), NOW);
        return incident;
    }

    @Test
    void anUnassignedIncident() {
        Incident incident = classified();

        assertThat(policy.actionsFor(incident, reporter, false)).containsExactlyInAnyOrder(CANCEL, RESPOND);
        assertThat(policy.actionsFor(incident, technician, false)).containsExactly(TAKE);
        assertThat(policy.actionsFor(incident, admin, false))
                .containsExactlyInAnyOrder(ASSIGN, TAKE, CANCEL, ADD_NOTE, REQUEST_INFO, LINK);
        assertThat(policy.canRead(incident, technician)).isTrue();
        assertThat(policy.canRead(incident, bystander)).isFalse();
    }

    @Test
    void anAssignedIncident() {
        Incident incident = assigned();

        assertThat(policy.actionsFor(incident, technician, false))
                .contains(ACKNOWLEDGE, ADD_NOTE, REQUEST_INFO)
                .doesNotContain(RESOLVE, CLOSE, ASSIGN, TAKE);
        // Once someone holds it, other technicians can no longer see or take it.
        assertThat(policy.canRead(incident, otherTechnician)).isFalse();
        assertThat(policy.actionsFor(incident, reporter, false)).doesNotContain(ACKNOWLEDGE, ADD_NOTE);
    }

    @Test
    void aResolvedIncidentIsTheReportersToConfirm() {
        Incident incident = resolved();

        assertThat(policy.actionsFor(incident, reporter, false))
                .contains(VERIFY, REJECT_RESOLUTION)
                .doesNotContain(FEEDBACK);
        assertThat(policy.actionsFor(incident, technician, false)).doesNotContain(VERIFY, REJECT_RESOLUTION);
    }

    @Test
    void feedbackOnceConfirmedAndOnlyOnce() {
        Incident incident = resolved();
        incident.verify(reporter.employeeId(), NOW);

        assertThat(policy.actionsFor(incident, reporter, false)).contains(FEEDBACK, CLOSE);
        assertThat(policy.actionsFor(incident, reporter, true)).doesNotContain(FEEDBACK);
        assertThat(policy.actionsFor(incident, admin, false)).contains(CLOSE).doesNotContain(FEEDBACK);
    }

    @Test
    void notesFollowTheirAudience() {
        Incident incident = assigned();

        policy.checkCanNote(incident, technician, "INTERNAL");
        policy.checkCanNote(incident, reporter, "INFO_RESPONSE");
        assertThatThrownBy(() -> policy.checkCanNote(incident, reporter, "INTERNAL"))
                .isInstanceOf(UnauthorizedActionException.class);
        assertThatThrownBy(() -> policy.checkCanNote(incident, otherTechnician, "INVESTIGATION"))
                .isInstanceOf(UnauthorizedActionException.class);
        assertThat(policy.isStaffFor(incident, reporter)).isFalse();
        assertThat(policy.isStaffFor(incident, technician)).isTrue();
    }

    @Test
    void takingIsOnlyForYourselfAndOnlyFromThePool() {
        Incident pool = classified();
        policy.checkCanAssign(pool, technician, technician.employeeId());
        assertThatThrownBy(() -> policy.checkCanAssign(pool, technician, otherTechnician.employeeId()))
                .isInstanceOf(UnauthorizedActionException.class);

        Incident held = assigned();
        assertThatThrownBy(() -> policy.checkCanAssign(held, otherTechnician, otherTechnician.employeeId()))
                .isInstanceOf(UnauthorizedActionException.class);
        policy.checkCanAssign(held, admin, otherTechnician.employeeId());
    }

    @Test
    void aClosedIncidentOffersNothingButFeedback() {
        Incident incident = resolved();
        incident.verify(reporter.employeeId(), NOW);
        incident.close(admin.employeeId(), NOW);

        assertThat(policy.actionsFor(incident, admin, false)).isEmpty();
        assertThat(policy.actionsFor(incident, reporter, false)).containsExactly(IncidentAction.FEEDBACK);
    }
}
