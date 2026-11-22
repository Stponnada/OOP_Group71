package com.spotlight.itsm.incident.infrastructure;

import com.spotlight.itsm.incident.domain.IncidentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface IncidentJpaRepository
        extends JpaRepository<IncidentEntity, UUID>, JpaSpecificationExecutor<IncidentEntity> {

    Optional<IncidentEntity> findByReference(String reference);

    long countByAssignedTechnicianIdAndStatusNotIn(UUID technicianId, Collection<IncidentStatus> terminal);

    List<IncidentEntity> findByServiceIdAndStatusInAndCreatedAtAfterOrderByCreatedAtDesc(
            UUID serviceId, Collection<IncidentStatus> statuses, Instant after, org.springframework.data.domain.Pageable page);

    List<IncidentEntity> findByStatusNotInOrderByResolutionDueAtAsc(Collection<IncidentStatus> terminal);
}
