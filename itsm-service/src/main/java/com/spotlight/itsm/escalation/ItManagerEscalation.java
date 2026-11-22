package com.spotlight.itsm.escalation;

import java.util.List;
import java.util.UUID;

/** Rung 3: the IT manager tier. The end of the chain. */
public final class ItManagerEscalation extends EscalationHandler {

    @Override
    protected int level() {
        return EscalationLevel.IT_MANAGER;
    }

    @Override
    protected String role() {
        return "IT manager";
    }

    @Override
    protected List<UUID> recipients(EscalationRequest request, EscalationDirectory directory) {
        return directory.itManagers();
    }
}
