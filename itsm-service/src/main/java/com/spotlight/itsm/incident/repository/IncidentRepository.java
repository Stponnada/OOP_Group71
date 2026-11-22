package com.spotlight.itsm.incident.repository;

import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentId;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository port. The domain and application layers depend on this; the JPA adapter lives in
 * {@code infrastructure} and is the only thing that knows about tables.
 *
 * <p>Deliberately small — no generic CRUD. If the application needs it, it is a named method here.
 */
public interface IncidentRepository {

    Incident save(Incident incident);

    Optional<Incident> findById(IncidentId id);

    Optional<Incident> findByReference(String reference);

    List<Incident> search(IncidentSearchCriteria criteria, int page, int size);

    long count(IncidentSearchCriteria criteria);

    /** Active incidents per technician, for the load-based strategy and the workload report. */
    long countActiveByTechnician(UUID technicianId);

    /** Resolved incidents for a service, used by duplicate and resolution suggestions. */
    List<Incident> findResolvedForService(UUID serviceId, int limit);
}
