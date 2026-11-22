package com.spotlight.itsm.escalation;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Chain of Responsibility. Each handler owns one rung. When an incident has to climb to a rung,
 * the request starts at that rung's handler; if nobody holds the role (no team lead on the
 * technician's profile, no department admin), the handler passes it to the next one up, so an
 * escalation is never silently dropped.
 */
public abstract class EscalationHandler {

    private EscalationHandler next;

    /** Links the next rung and returns it, so a chain reads top to bottom. */
    public EscalationHandler then(EscalationHandler next) {
        this.next = next;
        return next;
    }

    /** The rung this handler is responsible for. */
    protected abstract int level();

    /** Who this rung is, for the escalation record and the notice. */
    protected abstract String role();

    /** The people at this rung for this request; empty when nobody holds the role. */
    protected abstract List<UUID> recipients(EscalationRequest request, EscalationDirectory directory);

    /**
     * Climbs every rung between the incident's current level and its target, in order. Returns
     * one step per rung climbed.
     */
    public final List<EscalationStep> escalate(EscalationRequest request, EscalationDirectory directory) {
        List<EscalationStep> steps = new ArrayList<>();
        for (int rung = request.currentLevel() + 1; rung <= request.targetLevel(); rung++) {
            steps.add(startAt(rung).handle(rung, request, directory));
        }
        return steps;
    }

    private EscalationHandler startAt(int rung) {
        EscalationHandler handler = this;
        while (handler.level() < rung && handler.next != null) {
            handler = handler.next;
        }
        return handler;
    }

    private EscalationStep handle(int rung, EscalationRequest request, EscalationDirectory directory) {
        List<UUID> people = recipients(request, directory);
        if (!people.isEmpty()) {
            return new EscalationStep(rung, role(), people, request.reason());
        }
        if (next != null) {
            return next.handle(rung, request, directory);
        }
        return new EscalationStep(rung, role() + " (nobody holds this role)", List.of(), request.reason());
    }

    /** The standard ladder: team lead, then system administrators, then IT managers. */
    public static EscalationHandler standardChain() {
        EscalationHandler first = new TeamLeadEscalation();
        first.then(new SystemAdministratorEscalation()).then(new ItManagerEscalation());
        return first;
    }
}
