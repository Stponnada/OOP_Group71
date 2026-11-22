package com.spotlight.itsm.incident.application;

import com.spotlight.itsm.common.exception.UnauthorizedActionException;
import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentAction;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.state.IncidentState;
import com.spotlight.itsm.incident.domain.state.IncidentStates;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Row-level visibility and command permission, in one place.
 *
 * <p>The aggregate already blocks "only the assignee resolves" and "only the reporter verifies".
 * This class adds the role-level rules that the domain has no business knowing: who may read an
 * incident, who may close or cancel it, who may assign it, and which actions to offer a caller.
 *
 * <p>Three roles, all derived from data:
 * <ul>
 *   <li><b>employee</b> — sees and acts on what they reported;</li>
 *   <li><b>technician</b> — also sees what is assigned to them and the unassigned pool, and can
 *       take an unassigned incident;</li>
 *   <li><b>service-desk admin</b> — sees everything, assigns, links and closes.</li>
 * </ul>
 */
@Component
public class IncidentAccessPolicy {

    public boolean canRead(Incident incident, EmployeePrincipal actor) {
        if (actor.serviceDeskAdmin() || isReporter(incident, actor) || isAssignee(incident, actor)) {
            return true;
        }
        // Technicians browse the unassigned pool so they can pick work up.
        return actor.technician() && incident.assignee().isEmpty() && !incident.isTerminal();
    }

    public void checkRead(Incident incident, EmployeePrincipal actor) {
        if (!canRead(incident, actor)) {
            throw new UnauthorizedActionException("view");
        }
    }

    /** Staff see internal notes; reporters don't. */
    public boolean isStaffFor(Incident incident, EmployeePrincipal actor) {
        return actor.serviceDeskAdmin() || isAssignee(incident, actor) || (actor.technician() && !isReporter(incident, actor));
    }

    public void checkCanCommand(Incident incident, EmployeePrincipal actor, IncidentStatus target) {
        boolean admin = actor.serviceDeskAdmin();
        boolean reporter = isReporter(incident, actor);
        boolean assignee = isAssignee(incident, actor);

        switch (target) {
            case CLOSED, CANCELLED -> {
                if (!admin && !reporter) {
                    throw new UnauthorizedActionException(
                            target == IncidentStatus.CLOSED ? "close" : "cancel");
                }
            }
            case ASSIGNED -> {
                if (!admin && !assignee) {
                    throw new UnauthorizedActionException("reassign");
                }
            }
            default -> {
                if (!admin && !assignee && !reporter) {
                    throw new UnauthorizedActionException("update");
                }
            }
        }
    }

    /**
     * Admins assign anyone. A technician may assign an unassigned incident to themselves (taking
     * it from the pool), and the current assignee may hand it on; nobody else may assign.
     */
    public void checkCanAssign(Incident incident, EmployeePrincipal actor, UUID technicianId) {
        if (actor.serviceDeskAdmin()) {
            return;
        }
        boolean taking = actor.technician()
                && incident.assignee().isEmpty()
                && actor.employeeId().equals(technicianId);
        if (taking || isAssignee(incident, actor)) {
            return;
        }
        throw new UnauthorizedActionException("assign");
    }

    public void checkCanNote(Incident incident, EmployeePrincipal actor, String kind) {
        boolean staff = actor.serviceDeskAdmin() || isAssignee(incident, actor);
        boolean reporter = isReporter(incident, actor);
        boolean allowed = switch (kind) {
            case "INFO_RESPONSE" -> reporter;
            case "INVESTIGATION", "INTERNAL", "INFO_REQUEST" -> staff;
            default -> false;
        };
        if (!allowed) {
            throw new UnauthorizedActionException("add that kind of note to");
        }
    }

    /**
     * What this caller can do now. Mirrors the checks the commands make, so a button the UI
     * shows never fails for permission reasons (state and role are both consulted).
     */
    public Set<IncidentAction> actionsFor(Incident incident, EmployeePrincipal actor, boolean hasFeedback) {
        Set<IncidentAction> actions = EnumSet.noneOf(IncidentAction.class);
        IncidentState state = IncidentStates.of(incident.status());
        IncidentStatus status = incident.status();
        boolean admin = actor.serviceDeskAdmin();
        boolean reporter = isReporter(incident, actor);
        boolean assignee = isAssignee(incident, actor);
        boolean open = !state.isTerminal();

        if (assignee && state.allows(IncidentStatus.ACKNOWLEDGED)) {
            actions.add(IncidentAction.ACKNOWLEDGE);
        }
        if (assignee && status != IncidentStatus.RESOLVED && state.allows(IncidentStatus.IN_PROGRESS)) {
            actions.add(IncidentAction.START_WORK);
        }
        if (assignee && state.allows(IncidentStatus.RESOLVED)) {
            actions.add(IncidentAction.RESOLVE);
        }
        if (reporter && state.allows(IncidentStatus.VERIFIED)) {
            actions.add(IncidentAction.VERIFY);
        }
        if (reporter && status == IncidentStatus.RESOLVED) {
            actions.add(IncidentAction.REJECT_RESOLUTION);
        }
        if ((admin || reporter) && state.allows(IncidentStatus.CLOSED)) {
            actions.add(IncidentAction.CLOSE);
        }
        if ((admin || reporter) && state.allows(IncidentStatus.CANCELLED)) {
            actions.add(IncidentAction.CANCEL);
        }
        if (admin && state.allows(IncidentStatus.ASSIGNED)) {
            actions.add(IncidentAction.ASSIGN);
        }
        if (actor.technician() && !assignee && state.allows(IncidentStatus.ASSIGNED)
                && (admin || incident.assignee().isEmpty())) {
            actions.add(IncidentAction.TAKE);
        }
        if (open && (admin || assignee)) {
            actions.add(IncidentAction.ADD_NOTE);
            if (!reporter) {
                actions.add(IncidentAction.REQUEST_INFO);
            }
        }
        if (open && reporter) {
            actions.add(IncidentAction.RESPOND);
        }
        if (reporter && (status == IncidentStatus.VERIFIED || status == IncidentStatus.CLOSED) && !hasFeedback) {
            actions.add(IncidentAction.FEEDBACK);
        }
        if (admin && open) {
            actions.add(IncidentAction.LINK);
        }
        return actions;
    }

    /** The scope a list query must be restricted to, or empty for "sees everything". */
    public Optional<UUID> listScope(EmployeePrincipal actor) {
        return actor.serviceDeskAdmin() ? Optional.empty() : Optional.of(actor.employeeId());
    }

    public boolean mustRestrictToOwnReports(EmployeePrincipal actor) {
        return !actor.serviceDeskAdmin() && !actor.technician();
    }

    private static boolean isReporter(Incident incident, EmployeePrincipal actor) {
        return incident.reporterId().equals(actor.employeeId());
    }

    private static boolean isAssignee(Incident incident, EmployeePrincipal actor) {
        return incident.assignee().map(actor.employeeId()::equals).orElse(false);
    }
}
