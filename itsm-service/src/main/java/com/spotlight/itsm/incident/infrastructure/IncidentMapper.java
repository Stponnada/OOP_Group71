package com.spotlight.itsm.incident.infrastructure;

import com.spotlight.itsm.catalog.CatalogLookup;
import com.spotlight.itsm.incident.domain.CategoryRef;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentId;
import com.spotlight.itsm.incident.domain.IncidentSnapshot;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.PriorityAssessment;
import com.spotlight.itsm.incident.domain.ServiceRef;
import com.spotlight.itsm.incident.domain.Transition;
import com.spotlight.itsm.sla.SlaClock;
import com.spotlight.itsm.sla.SlaStatus;
import com.spotlight.itsm.sla.SlaWindow;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Translates between the aggregate and its row.
 *
 * <p>Two directions, deliberately asymmetric:
 * <ul>
 *   <li><b>toDomain</b> rebuilds the aggregate through {@code Incident.restore}, so the only
 *       way in is a complete, validated snapshot;</li>
 *   <li><b>apply</b> writes the snapshot onto the entity and recomputes the denormalised
 *       breach flags, which exist purely so filtering and reporting do not have to read every
 *       row through the SLA clock.</li>
 * </ul>
 */
@Component
public class IncidentMapper {

    private final CatalogLookup catalog;
    private final SlaClock slaClock = new SlaClock();

    public IncidentMapper(CatalogLookup catalog) {
        this.catalog = catalog;
    }

    public Incident toDomain(IncidentEntity e, List<Transition> history) {
        ServiceRef service = catalog.service(e.getServiceId()).orElse(null);
        CategoryRef category = catalog.category(e.getCategoryId()).orElse(null);

        SlaWindow window = null;
        if (e.getSlaStartedAt() != null && e.getResponseDueAt() != null && e.getResolutionDueAt() != null) {
            window = new SlaWindow(e.getSlaStartedAt(), e.getResponseDueAt(),
                    e.getResolutionDueAt(), e.getWarningPercent());
        }

        PriorityAssessment priority = e.getPriority() == null ? null : new PriorityAssessment(
                e.getPriorityScore() == null ? 0 : e.getPriorityScore().doubleValue(),
                e.getPriority(),
                e.getPriorityFactors() == null ? Map.of() : e.getPriorityFactors(),
                e.getPriorityExplanation());

        IncidentSnapshot snapshot = new IncidentSnapshot(
                IncidentId.of(e.getId()),
                e.getReference(),
                e.getReporterId(),
                e.getOrgId(),
                category,
                service,
                e.getTitle(),
                e.getDescription(),
                e.getImpact(),
                e.getUrgency(),
                e.getBusinessCriticality(),
                e.getAffectedUsers(),
                priority,
                e.getStatus(),
                e.getAssignedTechnicianId(),
                window,
                e.getResolutionNote(),
                e.getFirstResponseAt(),
                e.getAcknowledgedAt(),
                e.getResolvedAt(),
                e.getVerifiedAt(),
                e.getClosedAt(),
                e.getCreatedAt(),
                e.getVersion() == null ? 0L : e.getVersion(),
                history);

        return Incident.restore(snapshot);
    }

    public void apply(IncidentSnapshot s, IncidentEntity e) {
        Instant now = Instant.now();

        e.setId(s.id().value());
        e.setReference(s.reference());
        e.setOrgId(s.orgId());
        e.setReporterId(s.reporterId());
        e.setCategoryId(s.category() == null ? null : s.category().id());
        e.setServiceId(s.service() == null ? null : s.service().id());
        e.setTitle(s.title());
        e.setDescription(s.description());
        e.setImpact(s.impact());
        e.setUrgency(s.urgency());
        e.setBusinessCriticality(s.businessCriticality());
        e.setAffectedUsers(s.affectedUsers());
        e.setStatus(s.status());

        if (s.priority() != null) {
            e.setPriority(s.priority().priority());
            e.setPriorityScore(BigDecimal.valueOf(s.priority().score()));
            e.setPriorityFactors(s.priority().factors());
            e.setPriorityExplanation(s.priority().explanation());
        }

        e.setAssignedTechnicianId(s.assignedTechnicianId());
        if (s.assignedTechnicianId() != null && e.getAssignedAt() == null) {
            e.setAssignedAt(now);
        }

        // The deadlines below are the authoritative SLA snapshot. The profile id is
        // informational only: an administrator editing the catalog later must not move a
        // deadline that has already been promised.
        e.setSlaProfileId(catalog.defaultSlaProfileFor(
                s.service() == null ? null : s.service().id(), null).orElse(null));

        if (s.slaWindow() != null) {
            e.setSlaStartedAt(s.slaWindow().startedAt());
            e.setResponseDueAt(s.slaWindow().responseDueAt());
            e.setResolutionDueAt(s.slaWindow().resolutionDueAt());
            e.setWarningPercent(s.slaWindow().warningPercent());
            e.setResponseBreached(s.slaWindow().responseBreached(s.firstResponseAt(), now));
            e.setResolutionBreached(s.slaWindow().resolutionBreached(s.resolvedAt(), now));
        }

        e.setFirstResponseAt(s.firstResponseAt());
        e.setAcknowledgedAt(s.acknowledgedAt());
        e.setResolvedAt(s.resolvedAt());
        e.setVerifiedAt(s.verifiedAt());
        e.setClosedAt(s.closedAt());
        e.setResolutionNote(s.resolutionNote());

        if (s.status() == IncidentStatus.CANCELLED) {
            s.history().stream()
                    .filter(t -> t.to() == IncidentStatus.CANCELLED)
                    .reduce((first, second) -> second)
                    .ifPresent(last -> {
                        e.setCancelledAt(last.occurredAt());
                        e.setCancellationReason(last.reason());
                    });
        }

        e.setCreatedAt(s.createdAt());
        e.setUpdatedAt(now);
    }

    /** Convenience for reporting: the live SLA band without rebuilding the aggregate. */
    public SlaStatus slaStatus(IncidentEntity e, Instant now) {
        if (e.getSlaStartedAt() == null || e.getResolutionDueAt() == null) {
            return null;
        }
        SlaWindow window = new SlaWindow(e.getSlaStartedAt(), e.getResponseDueAt(),
                e.getResolutionDueAt(), e.getWarningPercent());
        return slaClock.overall(window, e.getFirstResponseAt(), e.getResolvedAt(), now);
    }
}
