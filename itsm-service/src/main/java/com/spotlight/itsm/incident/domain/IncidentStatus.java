package com.spotlight.itsm.incident.domain;

/**
 * The persisted lifecycle vocabulary. This is the only place status strings are defined;
 * the database CHECK constraint, the API enum and the UI badge all read from it.
 *
 * <pre>
 * NEW -> CLASSIFIED -> ASSIGNED -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED
 *                          ^             |                                        |
 *                          +-- reassign  +------------- reopen ------------------+
 * any non-terminal -> CANCELLED
 * </pre>
 */
public enum IncidentStatus {
    NEW,
    CLASSIFIED,
    ASSIGNED,
    ACKNOWLEDGED,
    IN_PROGRESS,
    RESOLVED,
    VERIFIED,
    CLOSED,
    CANCELLED;

    /** A closed or cancelled incident is immutable; nothing may move out of it. */
    public boolean isTerminal() {
        return this == CLOSED || this == CANCELLED;
    }

    public boolean isOpen() {
        return !isTerminal();
    }
}
