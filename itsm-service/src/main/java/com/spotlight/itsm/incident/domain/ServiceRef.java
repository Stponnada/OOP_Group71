package com.spotlight.itsm.incident.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * A reference to an IT service in the catalog. {@code criticality} is carried here so a
 * classification can be scored without a second lookup, and is snapshotted onto the incident.
 */
public record ServiceRef(
        UUID id,
        String code,
        String name,
        BusinessCriticality criticality,
        UUID ownerDepartmentId
) {

    public ServiceRef {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(criticality, "criticality");
        code = code.trim().toUpperCase();
    }
}
