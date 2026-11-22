package com.spotlight.itsm.incident.infrastructure;

import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentId;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Transition;
import com.spotlight.itsm.incident.repository.IncidentRepository;
import com.spotlight.itsm.incident.repository.IncidentSearchCriteria;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The only class that knows a database exists. Implements the domain's repository port and
 * keeps the aggregate persistence-ignorant.
 */
@Repository
public class JpaIncidentRepository implements IncidentRepository {

    private static final Set<IncidentStatus> TERMINAL = EnumSet.of(IncidentStatus.CLOSED, IncidentStatus.CANCELLED);

    private final IncidentJpaRepository incidents;
    private final IncidentTransitionJpaRepository transitions;
    private final IncidentMapper mapper;

    public JpaIncidentRepository(IncidentJpaRepository incidents,
                                 IncidentTransitionJpaRepository transitions,
                                 IncidentMapper mapper) {
        this.incidents = incidents;
        this.transitions = transitions;
        this.mapper = mapper;
    }

    @Override
    @Transactional
    public Incident save(Incident incident) {
        var snapshot = incident.snapshot();

        IncidentEntity entity = incidents.findById(snapshot.id().value())
                .orElseGet(IncidentEntity::new);
        mapper.apply(snapshot, entity);
        IncidentEntity saved = incidents.save(entity);

        appendNewTransitions(snapshot.id().value(), snapshot.history());

        return mapper.toDomain(saved, history(snapshot.id().value()));
    }

    /**
     * History is append-only, so the gap between what is stored and what the aggregate holds is
     * exactly the new entries. This avoids rewriting rows and keeps the audit of a transition
     * immutable.
     */
    private void appendNewTransitions(UUID incidentId, List<Transition> history) {
        long stored = transitions.countByIncidentId(incidentId);
        if (history.size() <= stored) {
            return;
        }
        List<IncidentTransitionEntity> fresh = history.subList((int) stored, history.size()).stream()
                .map(t -> new IncidentTransitionEntity(
                        incidentId, t.from(), t.to(), t.actorId(), t.reason(), t.occurredAt()))
                .toList();
        transitions.saveAll(fresh);
    }

    private List<Transition> history(UUID incidentId) {
        return transitions.findByIncidentIdOrderByIdAsc(incidentId).stream()
                .map(t -> new Transition(t.getFromStatus(), t.getToStatus(),
                        t.getActorId(), t.getReason(), t.getOccurredAt()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Incident> findById(IncidentId id) {
        return incidents.findById(id.value())
                .map(e -> mapper.toDomain(e, history(id.value())));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Incident> findByReference(String reference) {
        return incidents.findByReference(reference)
                .map(e -> mapper.toDomain(e, history(e.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Incident> search(IncidentSearchCriteria criteria, int page, int size) {
        return incidents.findAll(
                        IncidentSpecifications.from(criteria),
                        PageRequest.of(page, size, sortFor(criteria.sort())))
                .map(e -> mapper.toDomain(e, history(e.getId())))
                .getContent();
    }

    @Override
    @Transactional(readOnly = true)
    public long count(IncidentSearchCriteria criteria) {
        return incidents.count(IncidentSpecifications.from(criteria));
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveByTechnician(UUID technicianId) {
        return incidents.countByAssignedTechnicianIdAndStatusNotIn(technicianId, TERMINAL);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Incident> findResolvedForService(UUID serviceId, int limit) {
        return incidents.findByServiceIdAndStatusInAndCreatedAtAfterOrderByCreatedAtDesc(
                        serviceId,
                        EnumSet.of(IncidentStatus.RESOLVED, IncidentStatus.VERIFIED, IncidentStatus.CLOSED),
                        Instant.now().minusSeconds(90L * 24 * 3600),
                        PageRequest.of(0, limit))
                .stream()
                .map(e -> mapper.toDomain(e, history(e.getId())))
                .toList();
    }

    /** Used by the SLA monitor; returns rows, not aggregates, because it only needs deadlines. */
    @Transactional(readOnly = true)
    public List<IncidentEntity> openIncidentsWithDeadlines() {
        return incidents.findByStatusNotInOrderByResolutionDueAtAsc(TERMINAL);
    }

    /** Ascending order already puts NULL deadlines last in PostgreSQL; Hibernate's criteria API
     *  refuses an explicit nullsLast. */
    private static Sort sortFor(String sort) {
        return switch (sort) {
            case "due" -> Sort.by(Sort.Order.asc("resolutionDueAt"), Sort.Order.desc("createdAt"));
            case "priority" -> Sort.by(Sort.Order.asc("priority"), Sort.Order.asc("resolutionDueAt"));
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }
}
