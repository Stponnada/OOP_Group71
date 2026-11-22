package com.spotlight.itsm.incident.domain;

import com.spotlight.itsm.priority.PriorityCalculator;
import com.spotlight.itsm.priority.PriorityInput;
import com.spotlight.itsm.sla.SlaPolicyResolver;
import com.spotlight.itsm.sla.SlaWindow;

import java.time.Instant;
import java.util.UUID;

/**
 * Factory: assembles a correctly classified incident from raw intake in one step, so no caller
 * can forget to calculate priority or an SLA window before the incident becomes visible.
 *
 * <p>This is the seam the Mariner agent and the report form both use, which is why the ordering
 * lives here rather than being repeated in two controllers. It depends on the
 * {@link SlaPolicyResolver} rather than a concrete policy, so a service with a tighter SLA gets
 * one automatically.
 */
public final class IncidentFactory {

    private final PriorityCalculator priorityCalculator;
    private final SlaPolicyResolver slaPolicyResolver;

    public IncidentFactory(PriorityCalculator priorityCalculator, SlaPolicyResolver slaPolicyResolver) {
        this.priorityCalculator = priorityCalculator;
        this.slaPolicyResolver = slaPolicyResolver;
    }

    public Incident intake(
            IncidentId id,
            String reference,
            UUID reporterId,
            UUID orgId,
            String title,
            String description,
            CategoryRef category,
            ServiceRef service,
            Impact impact,
            Urgency urgency,
            int affectedUsers,
            boolean securityIncident,
            UUID actorId,
            Instant now) {

        Incident incident = Incident.raise(id, reference, reporterId, orgId, title, description, now);

        PriorityInput input = new PriorityInput(
                impact, urgency, service.criticality(), affectedUsers,
                securityIncident, isRegulated(service), false, category.code(), service.code());

        PriorityAssessment assessment = priorityCalculator.assess(input);
        SlaWindow window = slaPolicyResolver
                .resolve(service, assessment.priority())
                .windowFor(assessment.priority(), now);

        incident.classify(category, service, impact, urgency, affectedUsers, assessment, window, actorId, now);
        return incident;
    }

    private static boolean isRegulated(ServiceRef service) {
        return service.criticality() == BusinessCriticality.REVENUE_OR_REGULATED;
    }
}
