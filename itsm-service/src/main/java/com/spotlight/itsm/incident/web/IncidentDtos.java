package com.spotlight.itsm.incident.web;

import com.spotlight.itsm.incident.domain.IncidentAction;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.PriorityAssessment;
import com.spotlight.itsm.incident.domain.Urgency;
import com.spotlight.itsm.sla.SlaStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** The wire shapes. Records, so they are immutable and serialise without surprises. */
public final class IncidentDtos {

    private IncidentDtos() {
    }

    public record IdName(UUID id, String name, String code) {
    }

    public record Person(UUID employeeId, String displayName) {
    }

    public record PriorityView(double score, Priority priority, Map<String, Double> factors, String explanation) {
        public static PriorityView from(PriorityAssessment a) {
            return a == null ? null : new PriorityView(a.score(), a.priority(), a.factors(), a.explanation());
        }
    }

    public record SlaView(
            Instant startedAt,
            Instant responseDueAt,
            Instant resolutionDueAt,
            int warningPercent,
            SlaStatus responseStatus,
            SlaStatus resolutionStatus,
            long resolutionRemainingMinutes
    ) {
    }

    public record IncidentView(
            UUID id,
            String reference,
            String title,
            String description,
            IncidentStatus status,
            Priority priority,
            PriorityView priorityAssessment,
            IdName category,
            IdName service,
            BusinessCriticality businessCriticality,
            Impact impact,
            Urgency urgency,
            int affectedUsers,
            SlaView sla,
            Person reporter,
            Person assignee,
            String resolutionNote,
            int escalationLevel,
            Instant createdAt,
            Instant assignedAt,
            Instant firstResponseAt,
            Instant resolvedAt,
            Instant verifiedAt,
            Instant closedAt,
            long version,
            String cancellationReason,
            List<IncidentAction> actions,
            boolean awaitingReporter,
            String slaRisk,
            FeedbackView feedback,
            List<LinkView> links
    ) {
        public static IncidentView from(Incident incident, Person reporter, Person assignee,
                                        SlaView sla, Extras extras) {
            return new IncidentView(
                    incident.id().value(),
                    incident.reference(),
                    incident.title(),
                    incident.description(),
                    incident.status(),
                    incident.priority().priority(),
                    PriorityView.from(incident.priority()),
                    incident.category() == null ? null
                            : new IdName(incident.category().id(), incident.category().name(), incident.category().code()),
                    incident.service() == null ? null
                            : new IdName(incident.service().id(), incident.service().name(), incident.service().code()),
                    incident.businessCriticality(),
                    incident.impact(),
                    incident.urgency(),
                    incident.affectedUsers(),
                    sla,
                    reporter,
                    assignee,
                    incident.resolutionNote(),
                    extras.escalationLevel(),
                    incident.createdAt(),
                    extras.assignedAt(),
                    incident.firstResponseAt(),
                    incident.resolvedAt(),
                    extras.verifiedAt(),
                    incident.closedAt(),
                    incident.version(),
                    extras.cancellationReason(),
                    extras.actions(),
                    extras.awaitingReporter(),
                    extras.slaRisk(),
                    extras.feedback(),
                    extras.links());
        }
    }

    /** What the view needs beyond the aggregate: per-caller actions and a few side tables. */
    public record Extras(int escalationLevel, Instant assignedAt, Instant verifiedAt, String cancellationReason,
                         List<IncidentAction> actions, boolean awaitingReporter, String slaRisk,
                         FeedbackView feedback, List<LinkView> links) {
    }

    public record FeedbackView(int rating, String comment, Instant submittedAt) {
    }

    public record LinkView(UUID incidentId, String reference, String title, IncidentStatus status,
                           String relation, double similarity) {
    }

    public record IncidentSummary(
            UUID id,
            String reference,
            String title,
            IncidentStatus status,
            Priority priority,
            String serviceName,
            String assigneeName,
            SlaStatus slaStatus,
            Instant dueAt,
            Instant createdAt,
            String reporterName,
            String categoryName,
            String slaRisk,
            boolean awaitingReporter
    ) {
    }

    public record IncidentPage(List<IncidentSummary> content, int page, int size,
                               long totalElements, int totalPages) {
    }

    public record CreateIncidentRequest(
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Size(min = 3, max = 200) String title,
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Size(max = 4000) String description,
            @jakarta.validation.constraints.NotNull UUID categoryId,
            @jakarta.validation.constraints.NotNull UUID serviceId,
            @jakarta.validation.constraints.NotNull Impact impact,
            @jakarta.validation.constraints.NotNull Urgency urgency,
            @jakarta.validation.constraints.PositiveOrZero Integer affectedUsers,
            Boolean securityIncident
    ) {
        public CreateIncidentRequest {
            affectedUsers = affectedUsers == null ? 1 : affectedUsers;
            securityIncident = securityIncident != null && securityIncident;
        }
    }

    public record TransitionRequest(
            @jakarta.validation.constraints.NotNull IncidentStatus to,
            @jakarta.validation.constraints.Size(max = 1000) String reason,
            @jakarta.validation.constraints.Size(max = 4000) String resolutionNote,
            Integer expectedVersion) {
    }

    public record AssignRequest(UUID technicianId, String strategyKey, String reason) {
    }

    public record NoteRequest(
            String kind,
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Size(max = 4000) String body) {
    }

    public record FeedbackRequest(
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.Min(1)
            @jakarta.validation.constraints.Max(5) Integer rating,
            @jakarta.validation.constraints.Size(max = 2000) String comment) {
    }

    public record TimelineEntry(String id, String kind, String actorName, IncidentStatus fromStatus,
                                IncidentStatus toStatus, String body, String noteKind, Instant occurredAt) {
    }

    public record LinkRequest(@jakarta.validation.constraints.NotNull UUID relatedIncidentId,
                              @jakarta.validation.constraints.NotBlank String relation,
                              Boolean cancelAsDuplicate) {
    }

    public record SimilarRequest(@jakarta.validation.constraints.NotNull UUID serviceId,
                                 @jakarta.validation.constraints.Size(max = 200) String title,
                                 @jakarta.validation.constraints.Size(max = 4000) String description) {
    }

    public record Suggestion(UUID incidentId, String reference, String title, double similarity,
                             String relation) {
    }

    public record Suggestions(List<Suggestion> duplicates, List<Suggestion> related,
                              List<Map<String, Object>> priorResolutions) {
    }

    public static SlaView slaView(Incident incident, SlaStatus response, SlaStatus resolution, Instant now) {
        if (incident.slaWindow().isEmpty()) {
            return null;
        }
        var window = incident.slaWindow().get();
        long remaining = Duration.between(now, window.resolutionDueAt()).toMinutes();
        return new SlaView(window.startedAt(), window.responseDueAt(), window.resolutionDueAt(),
                window.warningPercent(), response, resolution, remaining);
    }
}
