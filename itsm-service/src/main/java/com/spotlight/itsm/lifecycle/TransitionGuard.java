package com.spotlight.itsm.lifecycle;

import com.spotlight.itsm.common.exception.UnauthorizedActionException;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.UUID;

/**
 * Contextual authorisation, kept out of the aggregate on purpose.
 *
 * <p>Two layers, two reasons:
 * <ul>
 *   <li>{@code IncidentState} answers "is this move structurally legal?"</li>
 *   <li>{@code TransitionGuard} answers "is <em>this person</em> allowed to make it?"</li>
 * </ul>
 * Splitting them means the state graph stays a pure, exhaustively-tested truth table, and the
 * role rules can change without touching the lifecycle model.
 */
public final class TransitionGuard {

    /**
     * Rules that need to know the actor's authority rather than just their identity.
     *
     * @param serviceDeskAdmin a manager/superuser in the IT department
     */
    public void checkCanClose(Incident incident, UUID actorId, boolean serviceDeskAdmin) {
        if (incident.status() != IncidentStatus.VERIFIED) {
            throw new UnauthorizedActionException("close an unverified incident");
        }
        if (!serviceDeskAdmin && !incident.reporterId().equals(actorId)) {
            throw new UnauthorizedActionException("close this incident");
        }
    }

    public void checkCanCancel(Incident incident, UUID actorId, boolean serviceDeskAdmin) {
        if (!serviceDeskAdmin && !incident.reporterId().equals(actorId)) {
            throw new UnauthorizedActionException("cancel this incident");
        }
    }

    public void checkCanReassign(Incident incident, UUID actorId, boolean serviceDeskAdmin) {
        boolean isCurrentAssignee = incident.assignee().map(actorId::equals).orElse(false);
        if (!serviceDeskAdmin && !isCurrentAssignee) {
            throw new UnauthorizedActionException("reassign this incident");
        }
    }

    public void checkCanRead(Incident incident, UUID actorId, boolean technician, boolean serviceDeskAdmin) {
        if (serviceDeskAdmin) {
            return;
        }
        if (incident.reporterId().equals(actorId)) {
            return;
        }
        if (technician && incident.assignee().map(actorId::equals).orElse(false)) {
            return;
        }
        throw new UnauthorizedActionException("view this incident");
    }
}
