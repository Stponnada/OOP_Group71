package com.spotlight.itsm.escalation;

import java.util.List;
import java.util.UUID;

/** Rung 1: the assignee's team lead. */
public final class TeamLeadEscalation extends EscalationHandler {

    @Override
    protected int level() {
        return EscalationLevel.TEAM_LEAD;
    }

    @Override
    protected String role() {
        return "Team lead";
    }

    @Override
    protected List<UUID> recipients(EscalationRequest request, EscalationDirectory directory) {
        if (request.assigneeId() == null) {
            return List.of();
        }
        return directory.teamLeadOf(request.assigneeId())
                .filter(lead -> !lead.equals(request.assigneeId()))
                .map(List::of)
                .orElse(List.of());
    }
}
