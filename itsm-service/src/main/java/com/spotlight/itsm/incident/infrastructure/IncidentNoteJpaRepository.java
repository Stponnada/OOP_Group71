package com.spotlight.itsm.incident.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface IncidentNoteJpaRepository extends JpaRepository<IncidentNoteEntity, UUID> {

    List<IncidentNoteEntity> findByIncidentIdOrderByCreatedAtAsc(UUID incidentId);
}
