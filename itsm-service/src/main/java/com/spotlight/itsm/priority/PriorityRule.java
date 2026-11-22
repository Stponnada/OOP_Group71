package com.spotlight.itsm.priority;

import com.spotlight.itsm.incident.domain.Priority;

import java.util.Optional;

/**
 * A named override that can raise (never lower) a priority. Returning a priority means "this
 * incident must be at least this severe"; the calculator keeps the most severe floor.
 *
 * <p>Rules are separate objects so the report can list them as a table and each gets its own test.
 */
public interface PriorityRule {

    String name();

    Optional<Priority> floorFor(PriorityInput input);
}
