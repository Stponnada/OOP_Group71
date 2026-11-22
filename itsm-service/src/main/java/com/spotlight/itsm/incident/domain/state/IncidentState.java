package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.Set;

/**
 * One object per lifecycle state. The State pattern's whole point here is that the legal moves
 * live with the state, so {@code NEW -> CLOSED} is impossible by construction rather than by a
 * switch statement somebody can forget to update.
 *
 * <p>This layer answers "is this move structurally legal?". It deliberately says nothing about
 * who is asking or what fields are filled in — {@link com.spotlight.itsm.lifecycle.TransitionGuard}
 * owns contextual checks and {@link com.spotlight.itsm.incident.domain.Incident} owns the
 * invariants it can prove on its own (resolution note present, actor is the assignee).
 */
public sealed interface IncidentState
        permits NewState, ClassifiedState, AssignedState, AcknowledgedState,
                InProgressState, ResolvedState, VerifiedState, ClosedState, CancelledState {

    IncidentStatus status();

    /** Statuses reachable from here in one move. */
    Set<IncidentStatus> successors();

    default boolean allows(IncidentStatus target) {
        return successors().contains(target);
    }

    default boolean isTerminal() {
        return successors().isEmpty();
    }
}
