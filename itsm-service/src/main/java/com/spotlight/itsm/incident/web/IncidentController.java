package com.spotlight.itsm.incident.web;

import com.spotlight.itsm.assignment.TechnicianRecommender;
import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.incident.application.CreateIncidentCommand;
import com.spotlight.itsm.incident.application.IncidentAccessPolicy;
import com.spotlight.itsm.incident.application.IncidentService;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.repository.IncidentRepository;
import com.spotlight.itsm.incident.repository.IncidentSearchCriteria;
import com.spotlight.itsm.incident.web.IncidentDtos.AssignRequest;
import com.spotlight.itsm.incident.web.IncidentDtos.CreateIncidentRequest;
import com.spotlight.itsm.incident.web.IncidentDtos.FeedbackRequest;
import com.spotlight.itsm.incident.web.IncidentDtos.IncidentPage;
import com.spotlight.itsm.incident.web.IncidentDtos.IncidentView;
import com.spotlight.itsm.incident.web.IncidentDtos.LinkRequest;
import com.spotlight.itsm.incident.web.IncidentDtos.NoteRequest;
import com.spotlight.itsm.incident.web.IncidentDtos.SimilarRequest;
import com.spotlight.itsm.incident.web.IncidentDtos.Suggestion;
import com.spotlight.itsm.incident.web.IncidentDtos.Suggestions;
import com.spotlight.itsm.incident.web.IncidentDtos.TransitionRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class IncidentController {

    private final IncidentService incidents;
    private final IncidentRepository repository;
    private final IncidentAssembler assembler;
    private final IncidentAccessPolicy accessPolicy;
    private final TimelineQuery timeline;

    public IncidentController(IncidentService incidents,
                              IncidentRepository repository,
                              IncidentAssembler assembler,
                              IncidentAccessPolicy accessPolicy,
                              TimelineQuery timeline) {
        this.incidents = incidents;
        this.repository = repository;
        this.assembler = assembler;
        this.accessPolicy = accessPolicy;
        this.timeline = timeline;
    }

    /**
     * Search with the brief's filters. What a caller can see is decided here, not by the client:
     * employees get what they reported, technicians also get their work and the unassigned pool,
     * service-desk admins get everything.
     */
    @GetMapping("/incidents")
    public IncidentPage search(
            @AuthenticationPrincipal EmployeePrincipal actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) com.spotlight.itsm.incident.domain.Priority priority,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID serviceId,
            @RequestParam(required = false) UUID technicianId,
            @RequestParam(required = false) UUID reporterId,
            @RequestParam(required = false) Instant createdFrom,
            @RequestParam(required = false) Instant createdTo,
            @RequestParam(required = false) Boolean breachedOnly,
            @RequestParam(defaultValue = "false") boolean openOnly,
            @RequestParam(defaultValue = "false") boolean unassignedOnly,
            @RequestParam(defaultValue = "newest") String sort) {

        IncidentSearchCriteria criteria = new IncidentSearchCriteria(
                Optional.ofNullable(q),
                Optional.ofNullable(status),
                Optional.ofNullable(priority),
                Optional.ofNullable(categoryId),
                Optional.ofNullable(serviceId),
                Optional.ofNullable(technicianId),
                Optional.ofNullable(reporterId),
                Optional.ofNullable(createdFrom),
                Optional.ofNullable(createdTo),
                Optional.ofNullable(breachedOnly),
                openOnly,
                Optional.empty(),
                unassignedOnly,
                sort);

        if (!actor.serviceDeskAdmin()) {
            criteria = actor.technician()
                    ? criteria.restrictToTechnicianScope(actor.employeeId())
                    : criteria.restrictToReporter(actor.employeeId());
        }
        return page(criteria, page, size);
    }

    @PostMapping("/incidents")
    public ResponseEntity<IncidentView> create(@AuthenticationPrincipal EmployeePrincipal actor,
                                               @Valid @RequestBody CreateIncidentRequest request) {
        Incident created = incidents.create(actor, new CreateIncidentCommand(
                request.title(), request.description(), request.categoryId(), request.serviceId(),
                request.impact(), request.urgency(), request.affectedUsers(), request.securityIncident()));

        return ResponseEntity
                .created(URI.create("/api/v1/incidents/" + created.id().value()))
                .body(assembler.view(created, Instant.now(), actor));
    }

    /** Duplicate check before a report is submitted. */
    @PostMapping("/incidents/similar")
    public List<Map<String, Object>> similar(@Valid @RequestBody SimilarRequest request) {
        return incidents.similarTo(request.serviceId(), request.title() == null ? "" : request.title(),
                request.description());
    }

    @GetMapping("/incidents/{id}")
    public IncidentView get(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id) {
        return assembler.view(incidents.loadFor(actor, id), Instant.now(), actor);
    }

    @GetMapping("/incidents/{id}/timeline")
    public List<IncidentDtos.TimelineEntry> timeline(@AuthenticationPrincipal EmployeePrincipal actor,
                                                     @PathVariable UUID id) {
        Incident incident = incidents.loadFor(actor, id);
        return timeline.forIncident(id, accessPolicy.isStaffFor(incident, actor));
    }

    @PostMapping("/incidents/{id}/notes")
    public void addNote(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                        @Valid @RequestBody NoteRequest request) {
        incidents.addNote(actor, id, request.kind() == null ? "INVESTIGATION" : request.kind(), request.body());
    }

    /**
     * Assign, reassign or take. With a technician id the caller chooses (admins anyone, a
     * technician themselves from the unassigned pool); without one, an admin lets the strategy
     * choose.
     */
    @PostMapping("/incidents/{id}/assign")
    public IncidentView assign(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                               @RequestBody(required = false) AssignRequest request) {
        AssignRequest safe = request == null ? new AssignRequest(null, null, null) : request;
        if (safe.technicianId() != null) {
            incidents.requireCapacity(safe.technicianId());
        }
        return assembler.view(
                incidents.assign(actor, id, safe.technicianId(), safe.strategyKey(), safe.reason()),
                Instant.now(), actor);
    }

    @GetMapping("/incidents/{id}/recommendations")
    public List<TechnicianRecommender.Recommendation> recommendations(
            @AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id) {
        return incidents.recommendationsFor(actor, id);
    }

    @PostMapping("/incidents/{id}/links")
    public IncidentView link(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                             @Valid @RequestBody LinkRequest request) {
        Incident linked = incidents.link(actor, id, request.relatedIncidentId(), request.relation(),
                Boolean.TRUE.equals(request.cancelAsDuplicate()));
        return assembler.view(incidents.load(linked.id().value()), Instant.now(), actor);
    }

    @PostMapping("/incidents/{id}/transitions")
    public IncidentView transition(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                                   @Valid @RequestBody TransitionRequest request) {
        return assembler.view(
                incidents.transition(actor, id, request.to(), request.reason(), request.resolutionNote()),
                Instant.now(), actor);
    }

    @PostMapping("/incidents/{id}/feedback")
    public void feedback(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                         @Valid @RequestBody FeedbackRequest request) {
        incidents.leaveFeedback(actor, id, request.rating(), request.comment());
    }

    @GetMapping("/incidents/{id}/suggestions")
    public Suggestions suggestions(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id) {
        Incident incident = incidents.loadFor(actor, id);
        var candidates = incidents.duplicatesFor(incident);

        List<Suggestion> duplicates = candidates.stream()
                .filter(c -> c.similarity() >= 0.30)
                .map(c -> new Suggestion(c.id(), c.reference(), c.title(), round(c.similarity()), "DUPLICATE"))
                .toList();
        List<Suggestion> related = candidates.stream()
                .filter(c -> c.similarity() < 0.30)
                .map(c -> new Suggestion(c.id(), c.reference(), c.title(), round(c.similarity()), "RELATED"))
                .toList();

        return new Suggestions(duplicates, related, incidents.priorResolutions(incident, 5));
    }

    /**
     * A technician's queue. {@code mineOnly} with {@code includeUnassigned} (the default) is their
     * work plus the pool; {@code includeUnassigned=false} is only their own; {@code mineOnly=false}
     * is the pool alone. Soonest deadline first unless asked otherwise.
     */
    @GetMapping("/queue")
    public IncidentPage queue(@AuthenticationPrincipal EmployeePrincipal actor,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size,
                              @RequestParam(defaultValue = "true") boolean mineOnly,
                              @RequestParam(defaultValue = "true") boolean includeUnassigned,
                              @RequestParam(defaultValue = "due") String sort) {
        IncidentSearchCriteria open = IncidentSearchCriteria.open();
        IncidentSearchCriteria criteria;
        if (mineOnly && includeUnassigned) {
            criteria = open.restrictToTechnicianScope(actor.employeeId());
        } else if (mineOnly) {
            criteria = withTechnician(open, actor.employeeId());
        } else {
            criteria = unassigned(open);
        }
        criteria = sorted(criteria, sort);
        return page(criteria, page, size);
    }

    private IncidentPage page(IncidentSearchCriteria criteria, int page, int size) {
        Instant now = Instant.now();
        List<Incident> found = repository.search(criteria, page, size);
        long total = repository.count(criteria);
        return new IncidentPage(assembler.summaries(found, now), page, size, total,
                size == 0 ? 0 : (int) Math.ceil((double) total / size));
    }

    private static IncidentSearchCriteria withTechnician(IncidentSearchCriteria c, UUID technician) {
        return new IncidentSearchCriteria(c.query(), c.status(), c.priority(), c.categoryId(), c.serviceId(),
                Optional.of(technician), c.reporterId(), c.createdFrom(), c.createdTo(), c.breachedOnly(),
                c.openOnly(), c.technicianScope(), c.unassignedOnly(), c.sort());
    }

    private static IncidentSearchCriteria unassigned(IncidentSearchCriteria c) {
        return new IncidentSearchCriteria(c.query(), c.status(), c.priority(), c.categoryId(), c.serviceId(),
                c.technicianId(), c.reporterId(), c.createdFrom(), c.createdTo(), c.breachedOnly(),
                c.openOnly(), c.technicianScope(), true, c.sort());
    }

    private static IncidentSearchCriteria sorted(IncidentSearchCriteria c, String sort) {
        return new IncidentSearchCriteria(c.query(), c.status(), c.priority(), c.categoryId(), c.serviceId(),
                c.technicianId(), c.reporterId(), c.createdFrom(), c.createdTo(), c.breachedOnly(),
                c.openOnly(), c.technicianScope(), c.unassignedOnly(), sort);
    }

    private static double round(double value) {
        return Math.round(value * 1000) / 1000.0;
    }
}
