package com.spotlight.itsm.incident.domain;

import java.util.Objects;
import java.util.UUID;

/** A reference to an incident category. The aggregate points at it; it does not own it. */
public record CategoryRef(UUID id, String code, String name) {

    public CategoryRef {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(code, "code");
        code = code.trim().toUpperCase();
    }
}
