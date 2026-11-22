package com.spotlight.itsm.reporting;

import com.spotlight.itsm.incident.domain.Priority;

import java.time.Instant;
import java.util.UUID;

public final class ReportDtos {

    private ReportDtos() {
    }

    public record OverviewReport(long totalIncidents, long openIncidents, long criticalIncidents,
                                 long resolvedIncidents, long slaViolations, double slaCompliancePercent,
                                 double averageResolutionMinutes) {
    }

    public record WorkloadRow(UUID employeeId, String displayName, long activeIncidents,
                              long resolvedIncidents, double utilisationPercent, boolean isAvailable) {
    }

    public record ServiceReportRow(UUID serviceId, String name, String businessCriticality,
                                   long incidents, long p1Incidents, long slaViolations,
                                   double averageResolutionMinutes) {
    }

    public record SlaReportRow(Priority priority, long incidents, long responseMet,
                               long resolutionMet, double compliancePercent) {
    }

    public record AuditEntry(String id, UUID incidentId, String incidentReference, String subject,
                             String actorName, String action, Object oldValues, Object newValues,
                             Instant occurredAt) {
    }

    public record TrendPoint(java.time.LocalDate day, long created, long resolved, long breached) {
    }

    public record CategoryReportRow(UUID categoryId, String name, long incidents, long openIncidents,
                                    long slaViolations) {
    }

    public record EscalationRow(UUID id, UUID incidentId, String reference, String title, Priority priority,
                                int level, String reason, String fromName, String toName, Instant createdAt) {
    }
}
