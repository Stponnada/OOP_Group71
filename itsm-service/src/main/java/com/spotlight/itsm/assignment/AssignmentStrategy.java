package com.spotlight.itsm.assignment;

import java.util.Optional;

/**
 * Strategy contract for choosing a technician. The incident service never knows which
 * implementation is active, so the default can be changed per category from the settings screen
 * without touching the lifecycle code.
 *
 * <p>Returning {@link Optional#empty()} means "nobody suitable" — the caller escalates to the
 * team lead rather than force-assigning.
 */
public interface AssignmentStrategy {

    String key();

    String label();

    Optional<TechnicianCandidate> select(AssignmentContext context);

    /**
     * Who this strategy would pick, without recording the pick. Used to explain a recommendation;
     * strategies that keep state (round-robin's rotation) override it so a look doesn't count.
     */
    default Optional<TechnicianCandidate> preview(AssignmentContext context) {
        return select(context);
    }
}
