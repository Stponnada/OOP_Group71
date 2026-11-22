package com.spotlight.itsm.incident.application;

import com.spotlight.itsm.assignment.AssignmentContext;
import com.spotlight.itsm.assignment.AssignmentStrategy;
import com.spotlight.itsm.assignment.AssignmentStrategyRegistry;
import com.spotlight.itsm.assignment.TechnicianCandidate;
import com.spotlight.itsm.assignment.TechnicianDirectory;
import com.spotlight.itsm.audit.AuditEvent;
import com.spotlight.itsm.audit.AuditRecorder;
import com.spotlight.itsm.catalog.CatalogLookup;
import com.spotlight.itsm.common.exception.CapacityExceededException;
import com.spotlight.itsm.common.exception.IncidentNotFoundException;
import com.spotlight.itsm.common.exception.TechnicianUnavailableException;
import com.spotlight.itsm.common.exception.ValidationException;
import com.spotlight.itsm.event.IncidentActivityEvent;
import com.spotlight.itsm.event.IncidentChangedEvent;
import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.identity.IdentityService;
import com.spotlight.itsm.incident.domain.CategoryRef;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentFactory;
import com.spotlight.itsm.incident.domain.IncidentId;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.ServiceRef;
import com.spotlight.itsm.incident.repository.IncidentRepository;
import com.spotlight.itsm.intelligence.DuplicateDetector;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * The application layer: it loads an aggregate, asks the domain to change it, persists, and
 * emits the consequences. No business rule lives here that the aggregate could own instead.
 */
@Service
public class IncidentService {

    private final IncidentRepository repository;
    private final IncidentFactory factory;
    private final IncidentAccessPolicy accessPolicy;
    private final ReferenceGenerator references;
    private final CatalogLookup catalog;
    private final AssignmentStrategyRegistry strategies;
    private final TechnicianDirectory technicians;
    private final IdentityService identity;
    private final AuditRecorder audit;
    private final DuplicateDetector duplicates;
    private final ApplicationEventPublisher events;
    private final JdbcTemplate jdbc;
    private final boolean autoAssign;

    public IncidentService(IncidentRepository repository,
                           IncidentFactory factory,
                           IncidentAccessPolicy accessPolicy,
                           ReferenceGenerator references,
                           CatalogLookup catalog,
                           AssignmentStrategyRegistry strategies,
                           TechnicianDirectory technicians,
                           IdentityService identity,
                           AuditRecorder audit,
                           DuplicateDetector duplicates,
                           ApplicationEventPublisher events,
                           JdbcTemplate jdbc,
                           @org.springframework.beans.factory.annotation.Value("${itsm.assignment.auto-assign:true}")
                           boolean autoAssign) {
        this.repository = repository;
        this.factory = factory;
        this.accessPolicy = accessPolicy;
        this.references = references;
        this.catalog = catalog;
        this.strategies = strategies;
        this.technicians = technicians;
        this.identity = identity;
        this.audit = audit;
        this.duplicates = duplicates;
        this.events = events;
        this.jdbc = jdbc;
        this.autoAssign = autoAssign;
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public Incident create(EmployeePrincipal actor, CreateIncidentCommand command) {
        CategoryRef category = catalog.category(command.categoryId())
                .orElseThrow(() -> new ValidationException("That category does not exist."));
        ServiceRef service = catalog.service(command.serviceId())
                .orElseThrow(() -> new ValidationException("That service does not exist."));
        if (!catalog.isServiceActive(service.id())) {
            throw new ValidationException("That service is no longer offered.");
        }

        Incident incident = factory.intake(
                IncidentId.random(),
                references.next(),
                actor.employeeId(),
                identity.orgId(actor.employeeId()),
                command.title(),
                command.description(),
                category,
                service,
                command.impact(),
                command.urgency(),
                command.affectedUsers(),
                command.securityIncident(),
                actor.employeeId(),
                Instant.now());

        // Workflow 1 of the brief: report -> prioritise -> assign -> notify, in one transaction.
        if (autoAssign) {
            try {
                incident.assignTo(chooseTechnician(incident, null), actor.employeeId(), Instant.now());
            } catch (RuntimeException noOneSuitable) {
                // Nobody available is not a reason to reject the report. It stays CLASSIFIED and
                // appears in the unassigned queue for a manager.
            }
        }

        Incident saved = repository.save(incident);

        Map<String, Object> newValues = new LinkedHashMap<>();
        newValues.put("reference", saved.reference());
        newValues.put("priority", saved.priority().priority().name());
        newValues.put("score", saved.priority().score());
        newValues.put("service", service.code());
        newValues.put("status", saved.status().name());
        audit.record(AuditEvent.created(actor.employeeId(), saved.id().value(), newValues, Instant.now()));
        correlate(saved);

        events.publishEvent(new IncidentChangedEvent(saved, actor.employeeId(),
                IncidentStatus.NEW, saved.status(), "reported"));

        return saved;
    }

    /**
     * Incident correlation: links a new report to recent incidents on the same service that read
     * alike, as DUPLICATE when very close and RELATED otherwise. The service desk confirms or
     * ignores the link; nothing is merged automatically.
     */
    private void correlate(Incident incident) {
        if (incident.service() == null) {
            return;
        }
        for (DuplicateDetector.Candidate c : duplicates.find(incident.id().value(), incident.service().id(),
                incident.title(), incident.description(), 5)) {
            String relation = c.similarity() >= 0.30 ? "DUPLICATE" : "RELATED";
            jdbc.update("""
                            INSERT INTO itsm.incident_links (incident_id, related_incident_id, relation, similarity)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT DO NOTHING
                            """,
                    incident.id().value(), c.id(), relation, Math.min(1.0, Math.round(c.similarity() * 1000) / 1000.0));
        }
    }

    @Transactional
    public Incident transition(EmployeePrincipal actor, UUID incidentId, IncidentStatus target,
                               String reason, String resolutionNote) {
        Incident incident = load(incidentId);
        accessPolicy.checkRead(incident, actor);
        accessPolicy.checkCanCommand(incident, actor, target);

        IncidentStatus from = incident.status();
        Instant now = Instant.now();

        switch (target) {
            case ACKNOWLEDGED -> incident.acknowledge(actor.employeeId(), now);
            case IN_PROGRESS -> {
                if (from == IncidentStatus.RESOLVED) {
                    incident.rejectResolution(actor.employeeId(), reason, now);
                } else {
                    incident.startWork(actor.employeeId(), now);
                }
            }
            case RESOLVED -> incident.resolve(resolutionNote, actor.employeeId(), now);
            case VERIFIED -> incident.verify(actor.employeeId(), now);
            case CLOSED -> incident.close(actor.employeeId(), now);
            case CANCELLED -> incident.cancel(actor.employeeId(), reason, now);
            default -> throw new ValidationException(
                    "Use the assign endpoint to move an incident to " + target + ".");
        }

        Incident saved = repository.save(incident);
        audit.record(AuditEvent.statusChanged(
                actor.employeeId(), saved.id().value(), from.name(), target.name(), now));
        events.publishEvent(new IncidentChangedEvent(saved, actor.employeeId(), from, target, reason));

        return saved;
    }

    @Transactional
    public Incident assign(EmployeePrincipal actor, UUID incidentId, UUID technicianId,
                           String strategyKey, String reason) {
        Incident incident = load(incidentId);
        accessPolicy.checkRead(incident, actor);
        if (technicianId == null && !actor.serviceDeskAdmin()) {
            throw new com.spotlight.itsm.common.exception.UnauthorizedActionException("auto-assign");
        }

        IncidentStatus from = incident.status();
        UUID previous = incident.assignee().orElse(null);
        UUID chosen = technicianId != null
                ? technicianId
                : chooseTechnician(incident, strategyKey);
        accessPolicy.checkCanAssign(incident, actor, chosen);
        if (chosen.equals(previous)) {
            throw new ValidationException("It is already assigned to " + identity.displayName(chosen) + ".");
        }

        Instant now = Instant.now();
        incident.assignTo(chosen, actor.employeeId(), now);
        Incident saved = repository.save(incident);

        audit.record(new AuditEvent(actor.employeeId(), "status_change", AuditEvent.TABLE,
                saved.id().value(),
                Map.of("assignedTechnicianId", String.valueOf(previous)),
                Map.of("assignedTechnicianId", chosen.toString()),
                now));

        events.publishEvent(new IncidentChangedEvent(saved, actor.employeeId(), from, IncidentStatus.ASSIGNED, reason));

        return saved;
    }

    @Transactional
    public void addNote(EmployeePrincipal actor, UUID incidentId, String kind, String body) {
        Incident incident = load(incidentId);
        accessPolicy.checkRead(incident, actor);
        if (body == null || body.isBlank()) {
            throw new ValidationException("Write what to add first.");
        }
        if (!java.util.Set.of("INVESTIGATION", "INTERNAL", "INFO_REQUEST", "INFO_RESPONSE").contains(kind)) {
            throw new ValidationException("Unknown note kind: " + kind + ".");
        }
        if (incident.isTerminal()) {
            throw new ValidationException("This incident is " + incident.status().name().toLowerCase()
                    + "; it no longer takes notes.");
        }
        accessPolicy.checkCanNote(incident, actor, kind);
        jdbc.update("""
                        INSERT INTO itsm.incident_notes (id, incident_id, author_id, kind, body)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                UUID.randomUUID(), incidentId, actor.employeeId(), kind, body.trim());

        audit.record(new AuditEvent(actor.employeeId(), "create", "itsm.incident_notes",
                incidentId, Map.of(), Map.of("kind", kind), Instant.now()));

        switch (kind) {
            case "INFO_REQUEST" -> events.publishEvent(new IncidentActivityEvent(incident, actor.employeeId(),
                    IncidentActivityEvent.Activity.INFO_REQUESTED, body.trim()));
            case "INFO_RESPONSE" -> events.publishEvent(new IncidentActivityEvent(incident, actor.employeeId(),
                    IncidentActivityEvent.Activity.INFO_PROVIDED, body.trim()));
            default -> {
            }
        }
    }

    /**
     * Links two incidents. A confirmed duplicate can be cancelled in the same step, which points
     * its reporter at the original instead of leaving two technicians on one problem.
     */
    @Transactional
    public Incident link(EmployeePrincipal actor, UUID incidentId, UUID relatedId, String relation,
                         boolean cancelAsDuplicate) {
        if (!actor.serviceDeskAdmin()) {
            throw new com.spotlight.itsm.common.exception.UnauthorizedActionException("link");
        }
        if (!"DUPLICATE".equals(relation) && !"RELATED".equals(relation)) {
            throw new ValidationException("A link is DUPLICATE or RELATED.");
        }
        if (incidentId.equals(relatedId)) {
            throw new ValidationException("An incident can't be linked to itself.");
        }
        Incident incident = load(incidentId);
        Incident original = load(relatedId);

        jdbc.update("""
                        DELETE FROM itsm.incident_links
                        WHERE incident_id = ? AND related_incident_id = ? AND relation IN ('DUPLICATE','RELATED')
                        """, incidentId, relatedId);
        jdbc.update("""
                        INSERT INTO itsm.incident_links (incident_id, related_incident_id, relation, similarity)
                        VALUES (?, ?, ?, 1)
                        """, incidentId, relatedId, relation);
        audit.record(new AuditEvent(actor.employeeId(), "status_change", AuditEvent.TABLE, incidentId,
                Map.of(), Map.of("linkedTo", original.reference(), "relation", relation), Instant.now()));

        if ("DUPLICATE".equals(relation) && cancelAsDuplicate) {
            String reason = "Duplicate of " + original.reference() + " (" + original.title() + ")";
            return transition(actor, incidentId, IncidentStatus.CANCELLED, reason, null);
        }
        events.publishEvent(new IncidentActivityEvent(incident, actor.employeeId(),
                IncidentActivityEvent.Activity.LINKED,
                ("DUPLICATE".equals(relation) ? "Looks like the same problem as " : "Related to ")
                        + original.reference() + ": " + original.title() + "."));
        return incident;
    }

    /** Recent incidents on a service that read like a report the user is about to submit. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> similarTo(UUID serviceId, String title, String description) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (DuplicateDetector.Candidate c : duplicates.find(null, serviceId, title,
                description == null ? "" : description, 5)) {
            if (c.similarity() < 0.2) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("incidentId", c.id());
            row.put("reference", c.reference());
            row.put("title", c.title());
            row.put("status", c.status());
            row.put("similarity", Math.round(c.similarity() * 1000) / 1000.0);
            row.put("createdAt", c.createdAt());
            rows.add(row);
        }
        return rows;
    }

    @Transactional
    public void leaveFeedback(EmployeePrincipal actor, UUID incidentId, int rating, String comment) {
        Incident incident = load(incidentId);
        if (!incident.reporterId().equals(actor.employeeId())) {
            throw new com.spotlight.itsm.common.exception.UnauthorizedActionException(
                    "rate this incident");
        }
        if (rating < 1 || rating > 5) {
            throw new ValidationException("A rating is between 1 and 5.");
        }
        if (incident.status() != IncidentStatus.VERIFIED && incident.status() != IncidentStatus.CLOSED) {
            throw new ValidationException("Feedback is collected once you have confirmed the fix.");
        }
        jdbc.update("""
                        INSERT INTO itsm.incident_feedback (incident_id, rating, comment, submitted_by)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT (incident_id) DO UPDATE
                            SET rating = EXCLUDED.rating,
                                comment = EXCLUDED.comment,
                                submitted_by = EXCLUDED.submitted_by
                        """,
                incidentId, rating, comment, actor.employeeId());

        events.publishEvent(new IncidentActivityEvent(incident, actor.employeeId(),
                IncidentActivityEvent.Activity.FEEDBACK, rating + "/5"));
    }

    // -------------------------------------------------------------------- queries

    @Transactional(readOnly = true)
    public Incident load(UUID incidentId) {
        return repository.findById(IncidentId.of(incidentId))
                .orElseThrow(() -> new IncidentNotFoundException(incidentId.toString()));
    }

    @Transactional(readOnly = true)
    public Incident loadFor(EmployeePrincipal actor, UUID incidentId) {
        Incident incident = load(incidentId);
        accessPolicy.checkRead(incident, actor);
        return incident;
    }

    @Transactional(readOnly = true)
    public List<DuplicateDetector.Candidate> duplicatesFor(Incident incident) {
        return duplicates.find(
                incident.id().value(),
                incident.service() == null ? null : incident.service().id(),
                incident.title(),
                incident.description(),
                5);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> priorResolutions(Incident incident, int limit) {
        if (incident.service() == null) {
            return List.of();
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (Incident resolved : repository.findResolvedForService(incident.service().id(), limit)) {
            if (resolved.resolutionNote() == null) {
                continue;
            }
            double score = new com.spotlight.itsm.intelligence.SimilarityScorer()
                    .similarity(incident.title() + " " + incident.description(),
                            resolved.title() + " " + resolved.description());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("incidentId", resolved.id().value());
            row.put("reference", resolved.reference());
            row.put("resolutionNote", resolved.resolutionNote());
            row.put("similarity", Math.round(score * 1000) / 1000.0);
            results.add(row);
        }
        results.sort((a, b) -> Double.compare((double) b.get("similarity"), (double) a.get("similarity")));
        return results;
    }

    /**
     * Every technician ranked for this incident, with the reasons and which strategies would pick
     * them. Service-desk admins only: it exposes everyone's workload.
     */
    @Transactional(readOnly = true)
    public List<com.spotlight.itsm.assignment.TechnicianRecommender.Recommendation> recommendationsFor(
            EmployeePrincipal actor, UUID incidentId) {
        Incident incident = load(incidentId);
        if (!actor.serviceDeskAdmin()) {
            throw new com.spotlight.itsm.common.exception.UnauthorizedActionException("see recommendations");
        }
        UUID serviceId = incident.service() == null ? null : incident.service().id();
        AssignmentContext context = new AssignmentContext(
                incident.priority().priority(),
                serviceId,
                serviceId == null ? java.util.Set.of() : technicians.requiredSkills(serviceId),
                notTheReporter(technicians.candidates(), incident));
        return com.spotlight.itsm.assignment.TechnicianRecommender.rank(context, strategies.all());
    }

    // ------------------------------------------------------------------ internals

    private UUID chooseTechnician(Incident incident, String strategyKey) {
        AssignmentStrategy strategy = strategyKey == null || strategyKey.isBlank()
                ? strategies.defaultStrategy()
                : strategies.byKey(strategyKey);

        UUID serviceId = incident.service() == null ? null : incident.service().id();
        AssignmentContext context = new AssignmentContext(
                incident.priority().priority(),
                serviceId,
                serviceId == null ? java.util.Set.of() : technicians.requiredSkills(serviceId),
                notTheReporter(serviceId == null ? technicians.candidates() : technicians.candidatesForService(serviceId),
                        incident));

        Optional<TechnicianCandidate> chosen = strategy.select(context);
        if (chosen.isEmpty()) {
            throw new TechnicianUnavailableException(
                    "nobody available matches " + incident.priority().priority()
                            + " using the " + strategy.label() + " strategy");
        }
        return chosen.get().employeeId();
    }

    /**
     * Nobody is automatically handed, or recommended for, an incident they reported themselves:
     * a technician who hits a problem is a user like anyone else. An admin can still assign them
     * by hand, and a technician can still take it from the pool.
     */
    private static List<TechnicianCandidate> notTheReporter(List<TechnicianCandidate> candidates, Incident incident) {
        return candidates.stream().filter(c -> !c.employeeId().equals(incident.reporterId())).toList();
    }

    /** Used by the assignment endpoint to give a clear error before touching the aggregate. */
    @Transactional(readOnly = true)
    public TechnicianCandidate requireCapacity(UUID technicianId) {
        TechnicianCandidate candidate = technicians.candidates().stream()
                .filter(c -> c.employeeId().equals(technicianId))
                .findFirst()
                .orElseThrow(() -> new TechnicianUnavailableException("no technician profile exists"));

        if (!candidate.available()) {
            throw new TechnicianUnavailableException("they are marked unavailable");
        }
        if (!candidate.hasCapacity()) {
            throw new CapacityExceededException(candidate.activeIncidents(), candidate.maxActiveIncidents());
        }
        return candidate;
    }

    @Transactional(readOnly = true)
    public Priority priorityOf(Incident incident) {
        return incident.priority().priority();
    }
}
