package com.spotlight.itsm.incident.domain;

import com.spotlight.itsm.common.exception.InvalidTransitionException;
import com.spotlight.itsm.common.exception.UnauthorizedActionException;
import com.spotlight.itsm.common.exception.ValidationException;
import com.spotlight.itsm.incident.domain.state.IncidentState;
import com.spotlight.itsm.incident.domain.state.IncidentStates;
import com.spotlight.itsm.sla.SlaWindow;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * The incident aggregate root.
 *
 * <p>Encapsulation rules this class enforces:
 * <ul>
 *   <li>every field is private and only changes through a named intention
 *       ({@code classify}, {@code assignTo}, {@code resolve} …), never a setter;</li>
 *   <li>the lifecycle graph is consulted on every move, so a caller cannot invent a transition;</li>
 *   <li>invariants are checked at the point of change, not by the caller;</li>
 *   <li>history is append-only and exposed as an unmodifiable view.</li>
 * </ul>
 *
 * <p>What it deliberately does <em>not</em> do: check who the actor is beyond the two rules that
 * are intrinsic to the domain (only the assignee resolves, only the reporter verifies), and know
 * anything about persistence, Spring, or HTTP.
 */
public final class Incident {

    public static final int MAX_TITLE = 200;
    public static final int MAX_DESCRIPTION = 4000;

    private final IncidentId id;
    private final String reference;
    private final UUID reporterId;
    private final UUID orgId;
    private final Instant createdAt;
    private final List<Transition> history;

    private CategoryRef category;
    private ServiceRef service;
    private String title;
    private String description;
    private Impact impact;
    private Urgency urgency;
    private BusinessCriticality businessCriticality;
    private int affectedUsers;
    private PriorityAssessment priority;
    private IncidentStatus status;
    private UUID assignedTechnicianId;
    private SlaWindow slaWindow;
    private String resolutionNote;
    private Instant firstResponseAt;
    private Instant acknowledgedAt;
    private Instant resolvedAt;
    private Instant verifiedAt;
    private Instant closedAt;
    private long version;

    private Incident(IncidentSnapshot s) {
        this.id = Objects.requireNonNull(s.id(), "id");
        this.reference = requireText(s.reference(), "reference", 40);
        this.reporterId = Objects.requireNonNull(s.reporterId(), "reporterId");
        this.orgId = Objects.requireNonNull(s.orgId(), "orgId");
        this.createdAt = Objects.requireNonNull(s.createdAt(), "createdAt");
        this.category = s.category();
        this.service = s.service();
        this.title = requireText(s.title(), "title", MAX_TITLE);
        this.description = requireText(s.description(), "description", MAX_DESCRIPTION);
        this.impact = s.impact();
        this.urgency = s.urgency();
        this.businessCriticality = s.businessCriticality();
        this.affectedUsers = s.affectedUsers();
        this.priority = s.priority();
        this.status = Objects.requireNonNull(s.status(), "status");
        this.assignedTechnicianId = s.assignedTechnicianId();
        this.slaWindow = s.slaWindow();
        this.resolutionNote = s.resolutionNote();
        this.firstResponseAt = s.firstResponseAt();
        this.acknowledgedAt = s.acknowledgedAt();
        this.resolvedAt = s.resolvedAt();
        this.verifiedAt = s.verifiedAt();
        this.closedAt = s.closedAt();
        this.version = s.version();
        this.history = new ArrayList<>(s.history() == null ? List.of() : s.history());
    }

    // ---------------------------------------------------------------- creation

    public static Incident raise(
            IncidentId id,
            String reference,
            UUID reporterId,
            UUID orgId,
            String title,
            String description,
            Instant now) {
        IncidentSnapshot snapshot = new IncidentSnapshot(
                id, reference, reporterId, orgId,
                null, null,
                title, description,
                null, null, null, 0, null,
                IncidentStatus.NEW,
                null, null, null,
                null, null, null, null, null,
                now, 0L, List.of());
        return new Incident(snapshot);
    }

    /** Rehydration path for the persistence adapter. Not for business code. */
    public static Incident restore(IncidentSnapshot snapshot) {
        return new Incident(snapshot);
    }

    // ------------------------------------------------------------ classification

    /**
     * Records what the incident is and how severe it is. This is the move NEW -> CLASSIFIED and
     * the only way priority or SLA may be set.
     */
    public void classify(
            CategoryRef category,
            ServiceRef service,
            Impact impact,
            Urgency urgency,
            int affectedUsers,
            PriorityAssessment priority,
            SlaWindow slaWindow,
            UUID actorId,
            Instant now) {

        requireLegalTransition(IncidentStatus.CLASSIFIED);

        CategoryRef nextCategory = Objects.requireNonNull(category, "category");
        ServiceRef nextService = Objects.requireNonNull(service, "service");
        Impact nextImpact = Objects.requireNonNull(impact, "impact");
        Urgency nextUrgency = Objects.requireNonNull(urgency, "urgency");
        PriorityAssessment nextPriority = Objects.requireNonNull(priority, "priority");
        SlaWindow nextWindow = Objects.requireNonNull(slaWindow, "slaWindow");

        applyTransition(IncidentStatus.CLASSIFIED, actorId, "classified", now);
        this.category = nextCategory;
        this.service = nextService;
        this.impact = nextImpact;
        this.urgency = nextUrgency;
        this.businessCriticality = nextService.criticality();
        this.affectedUsers = affectedUsers;
        this.priority = nextPriority;
        this.slaWindow = nextWindow;
    }

    /** Applies a re-assessment without moving the lifecycle. Used when the catalog or inputs change. */
    public void reclassify(PriorityAssessment priority, UUID actorId, Instant now) {
        if (status == IncidentStatus.NEW) {
            throw new ValidationException("Classify the incident before re-assessing its priority.");
        }
        PriorityAssessment next = Objects.requireNonNull(priority, "priority");
        history.add(new Transition(status, status, actorId, "priority re-assessed: " + next.priority(), now));
        this.priority = next;
    }

    // ---------------------------------------------------------------- assignment

    public void assignTo(UUID technicianId, UUID actorId, Instant now) {
        Objects.requireNonNull(technicianId, "technicianId");
        requireLegalTransition(IncidentStatus.ASSIGNED);
        applyTransition(IncidentStatus.ASSIGNED, actorId, "assigned", now);
        this.assignedTechnicianId = technicianId;
    }

    // ------------------------------------------------------------------ working

    public void acknowledge(UUID actorId, Instant now) {
        requireLegalTransition(IncidentStatus.ACKNOWLEDGED);
        requireAssignee(actorId, "acknowledge");
        applyTransition(IncidentStatus.ACKNOWLEDGED, actorId, "acknowledged", now);
        this.acknowledgedAt = now;
        if (firstResponseAt == null) {
            this.firstResponseAt = now;
        }
    }

    public void startWork(UUID actorId, Instant now) {
        requireLegalTransition(IncidentStatus.IN_PROGRESS);
        requireAssignee(actorId, "work on");
        applyTransition(IncidentStatus.IN_PROGRESS, actorId, "started work on", now);
    }

    public void resolve(String resolution, UUID actorId, Instant now) {
        requireLegalTransition(IncidentStatus.RESOLVED);
        requireAssignee(actorId, "resolve");
        String note = requireNote(resolution, "A resolution note is required before an incident can be resolved.");
        applyTransition(IncidentStatus.RESOLVED, actorId, "resolved", now);
        this.resolutionNote = note;
        this.resolvedAt = now;
    }

    /** The reporter did not accept the fix; it goes back to the technician. */
    public void rejectResolution(UUID actorId, String reason, Instant now) {
        requireLegalTransition(IncidentStatus.IN_PROGRESS);
        requireReporter(actorId, "reject the resolution of");
        String why = requireNote(reason, "Say what is still wrong before sending the incident back.");
        applyTransition(IncidentStatus.IN_PROGRESS, actorId, "rejected the resolution", now);
        this.resolvedAt = null;
        history.add(new Transition(IncidentStatus.RESOLVED, IncidentStatus.IN_PROGRESS, actorId, why, now));
    }

    public void verify(UUID actorId, Instant now) {
        requireLegalTransition(IncidentStatus.VERIFIED);
        requireReporter(actorId, "verify");
        applyTransition(IncidentStatus.VERIFIED, actorId, "verified", now);
        this.verifiedAt = now;
    }

    public void close(UUID actorId, Instant now) {
        requireLegalTransition(IncidentStatus.CLOSED);
        applyTransition(IncidentStatus.CLOSED, actorId, "closed", now);
        this.closedAt = now;
    }

    public void cancel(UUID actorId, String reason, Instant now) {
        requireLegalTransition(IncidentStatus.CANCELLED);
        String why = requireNote(reason, "Say why the incident is being cancelled.");
        applyTransition(IncidentStatus.CANCELLED, actorId, why, now);
    }

    // ------------------------------------------------------------------ queries

    public boolean isTerminal() {
        return status.isTerminal();
    }

    public boolean isOverdue(Instant now) {
        return slaWindow != null && slaWindow.resolutionBreached(resolvedAt, now);
    }

    public Optional<UUID> assignee() {
        return Optional.ofNullable(assignedTechnicianId);
    }

    public Optional<SlaWindow> slaWindow() {
        return Optional.ofNullable(slaWindow);
    }

    public List<Transition> history() {
        return List.copyOf(history);
    }

    public IncidentSnapshot snapshot() {
        return new IncidentSnapshot(
                id, reference, reporterId, orgId, category, service, title, description,
                impact, urgency, businessCriticality, affectedUsers, priority, status,
                assignedTechnicianId, slaWindow, resolutionNote, firstResponseAt, acknowledgedAt,
                resolvedAt, verifiedAt, closedAt, createdAt, version, List.copyOf(history));
    }

    public IncidentId id() {
        return id;
    }

    public String reference() {
        return reference;
    }

    public UUID reporterId() {
        return reporterId;
    }

    public UUID orgId() {
        return orgId;
    }

    public IncidentStatus status() {
        return status;
    }

    public PriorityAssessment priority() {
        return priority;
    }

    public CategoryRef category() {
        return category;
    }

    public ServiceRef service() {
        return service;
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }

    public Impact impact() {
        return impact;
    }

    public Urgency urgency() {
        return urgency;
    }

    public BusinessCriticality businessCriticality() {
        return businessCriticality;
    }

    public int affectedUsers() {
        return affectedUsers;
    }

    public String resolutionNote() {
        return resolutionNote;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant firstResponseAt() {
        return firstResponseAt;
    }

    public Instant resolvedAt() {
        return resolvedAt;
    }

    public Instant closedAt() {
        return closedAt;
    }

    public long version() {
        return version;
    }

    // ----------------------------------------------------------------- internals

    /**
     * Pure legality check. Kept separate from {@link #applyTransition} so a rejected move can
     * never leave the aggregate half-mutated: nothing changes until every guard has passed.
     */
    private void requireLegalTransition(IncidentStatus target) {
        IncidentState current = IncidentStates.of(status);
        if (!current.allows(target)) {
            throw new InvalidTransitionException(status.name(), target.name());
        }
    }

    private void applyTransition(IncidentStatus target, UUID actorId, String reason, Instant now) {
        history.add(new Transition(status, target, actorId, reason, now));
        this.status = target;
    }

    private void requireAssignee(UUID actorId, String action) {
        if (assignedTechnicianId == null || !assignedTechnicianId.equals(actorId)) {
            throw new UnauthorizedActionException(action);
        }
    }

    private void requireReporter(UUID actorId, String action) {
        if (!reporterId.equals(actorId)) {
            throw new UnauthorizedActionException(action);
        }
    }

    private static String requireNote(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ValidationException(message);
        }
        return value.trim();
    }

    private static String requireText(String value, String field, int max) {
        if (value == null || value.isBlank()) {
            throw new ValidationException("The " + field + " is required.");
        }
        String trimmed = value.trim();
        if (trimmed.length() > max) {
            throw new ValidationException("The " + field + " must be at most " + max + " characters.");
        }
        return trimmed;
    }
}
