package com.spotlight.itsm.incident.domain;

import java.util.Objects;
import java.util.UUID;

/** Typed identifier: passing the wrong UUID to the wrong method is a compile error. */
public record IncidentId(UUID value) {

    public IncidentId {
        Objects.requireNonNull(value, "value");
    }

    public static IncidentId of(UUID value) {
        return new IncidentId(value);
    }

    public static IncidentId random() {
        return new IncidentId(UUID.randomUUID());
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
