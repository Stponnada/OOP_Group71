package com.spotlight.itsm.escalation;

import java.util.List;
import java.util.UUID;

/** Rung 2: the IT department's administrators. */
public final class SystemAdministratorEscalation extends EscalationHandler {

    @Override
    protected int level() {
        return EscalationLevel.SYSTEM_ADMINISTRATOR;
    }

    @Override
    protected String role() {
        return "System administrator";
    }

    @Override
    protected List<UUID> recipients(EscalationRequest request, EscalationDirectory directory) {
        return directory.systemAdministrators();
    }
}
