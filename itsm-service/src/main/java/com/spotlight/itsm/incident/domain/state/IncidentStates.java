package com.spotlight.itsm.incident.domain.state;

import com.spotlight.itsm.incident.domain.IncidentStatus;

import java.util.EnumMap;
import java.util.Map;

/** The one lookup from persisted status to behaviour object. */
public final class IncidentStates {

    private static final Map<IncidentStatus, IncidentState> BY_STATUS = new EnumMap<>(IncidentStatus.class);

    static {
        register(NewState.INSTANCE);
        register(ClassifiedState.INSTANCE);
        register(AssignedState.INSTANCE);
        register(AcknowledgedState.INSTANCE);
        register(InProgressState.INSTANCE);
        register(ResolvedState.INSTANCE);
        register(VerifiedState.INSTANCE);
        register(ClosedState.INSTANCE);
        register(CancelledState.INSTANCE);
    }

    private IncidentStates() {
    }

    private static void register(IncidentState state) {
        BY_STATUS.put(state.status(), state);
    }

    public static IncidentState of(IncidentStatus status) {
        IncidentState state = BY_STATUS.get(status);
        if (state == null) {
            throw new IllegalStateException("No state object registered for " + status);
        }
        return state;
    }
}
