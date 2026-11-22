package com.spotlight.itsm.incident.infrastructure;

import com.spotlight.itsm.incident.repository.IncidentSearchCriteria;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * Turns the composable criteria into a JPA predicate. Specification pattern: each filter is
 * independent, so adding a ninth filter is one more {@code if}, not a new repository method.
 */
public final class IncidentSpecifications {

    private IncidentSpecifications() {
    }

    public static Specification<IncidentEntity> from(IncidentSearchCriteria criteria) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            criteria.query().ifPresent(q -> {
                String like = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("reference")), like),
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("description")), like)));
            });
            criteria.status().ifPresent(s -> predicates.add(cb.equal(root.get("status"), s)));
            criteria.priority().ifPresent(p -> predicates.add(cb.equal(root.get("priority"), p)));
            criteria.categoryId().ifPresent(c -> predicates.add(cb.equal(root.get("categoryId"), c)));
            criteria.serviceId().ifPresent(s -> predicates.add(cb.equal(root.get("serviceId"), s)));
            criteria.technicianId().ifPresent(t -> predicates.add(cb.equal(root.get("assignedTechnicianId"), t)));
            criteria.reporterId().ifPresent(r -> predicates.add(cb.equal(root.get("reporterId"), r)));
            criteria.createdFrom().ifPresent(f -> predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f)));
            criteria.createdTo().ifPresent(t -> predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), t)));

            if (criteria.openOnly()) {
                predicates.add(root.get("status").in(
                        com.spotlight.itsm.incident.domain.IncidentStatus.NEW,
                        com.spotlight.itsm.incident.domain.IncidentStatus.CLASSIFIED,
                        com.spotlight.itsm.incident.domain.IncidentStatus.ASSIGNED,
                        com.spotlight.itsm.incident.domain.IncidentStatus.ACKNOWLEDGED,
                        com.spotlight.itsm.incident.domain.IncidentStatus.IN_PROGRESS,
                        com.spotlight.itsm.incident.domain.IncidentStatus.RESOLVED,
                        com.spotlight.itsm.incident.domain.IncidentStatus.VERIFIED));
            }
            criteria.technicianScope().ifPresent(id -> predicates.add(cb.or(
                    cb.equal(root.get("assignedTechnicianId"), id),
                    cb.isNull(root.get("assignedTechnicianId")),
                    cb.equal(root.get("reporterId"), id))));
            if (criteria.unassignedOnly()) {
                predicates.add(cb.isNull(root.get("assignedTechnicianId")));
            }
            criteria.breachedOnly().ifPresent(breached -> {
                if (breached) {
                    predicates.add(cb.or(
                            cb.isTrue(root.get("responseBreached")),
                            cb.isTrue(root.get("resolutionBreached"))));
                }
            });

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
