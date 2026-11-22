package com.spotlight.itsm.incident.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface IncidentTransitionJpaRepository extends JpaRepository<IncidentTransitionEntity, Long> {

    long countByIncidentId(UUID incidentId);

    List<IncidentTransitionEntity> findByIncidentIdOrderByIdAsc(UUID incidentId);
}
