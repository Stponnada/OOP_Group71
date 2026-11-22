package com.spotlight.itsm.incident.repository;

import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Priority;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * The eight filters the brief asks for, as one composable value. Each is optional; the adapter
 * turns the present ones into a JPA Specification. Free text covers reference, title and
 * description.
 */
public record IncidentSearchCriteria(
        Optional<String> query,
        Optional<IncidentStatus> status,
        Optional<Priority> priority,
        Optional<UUID> categoryId,
        Optional<UUID> serviceId,
        Optional<UUID> technicianId,
        Optional<UUID> reporterId,
        Optional<Instant> createdFrom,
        Optional<Instant> createdTo,
        Optional<Boolean> breachedOnly,
        boolean openOnly,
        /** When present, limits results to incidents assigned to this technician, unassigned
         *  incidents, or incidents they reported. This is how a technician's queue is scoped. */
        Optional<UUID> technicianScope,
        /** Only incidents nobody has been assigned yet: the pool technicians pick from. */
        boolean unassignedOnly,
        /** newest (default), due (soonest resolution deadline first) or priority (P1 first). */
        String sort
) {

    public IncidentSearchCriteria {
        query = query == null ? Optional.empty() : query;
        status = status == null ? Optional.empty() : status;
        priority = priority == null ? Optional.empty() : priority;
        categoryId = categoryId == null ? Optional.empty() : categoryId;
        serviceId = serviceId == null ? Optional.empty() : serviceId;
        technicianId = technicianId == null ? Optional.empty() : technicianId;
        reporterId = reporterId == null ? Optional.empty() : reporterId;
        createdFrom = createdFrom == null ? Optional.empty() : createdFrom;
        createdTo = createdTo == null ? Optional.empty() : createdTo;
        breachedOnly = breachedOnly == null ? Optional.empty() : breachedOnly;
        technicianScope = technicianScope == null ? Optional.empty() : technicianScope;
        sort = sort == null || sort.isBlank() ? "newest" : sort;
    }

    public static IncidentSearchCriteria all() {
        return new IncidentSearchCriteria(
                Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty(),
                Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty(),
                Optional.empty(), Optional.empty(), false, Optional.empty(), false, "newest");
    }

    /** Employees see only what they reported. */
    public IncidentSearchCriteria restrictToReporter(UUID reporter) {
        return new IncidentSearchCriteria(query, status, priority, categoryId, serviceId, technicianId,
                Optional.of(reporter), createdFrom, createdTo, breachedOnly, openOnly, technicianScope,
                unassignedOnly, sort);
    }

    /** Technicians see their own work plus the unassigned queue. */
    public IncidentSearchCriteria restrictToTechnicianScope(UUID technician) {
        return new IncidentSearchCriteria(query, status, priority, categoryId, serviceId, technicianId,
                reporterId, createdFrom, createdTo, breachedOnly, openOnly, Optional.of(technician),
                unassignedOnly, sort);
    }

    public static IncidentSearchCriteria open() {
        IncidentSearchCriteria base = all();
        return new IncidentSearchCriteria(
                base.query(), base.status(), base.priority(), base.categoryId(), base.serviceId(),
                base.technicianId(), base.reporterId(), base.createdFrom(), base.createdTo(),
                base.breachedOnly(), true, base.technicianScope(), false, "newest");
    }
}
