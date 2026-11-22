package com.spotlight.itsm.incident.domain;

/**
 * Something a person can do to an incident. The service works out, per caller, which of these
 * are open right now (the lifecycle state allows it and the caller's role permits it) and sends
 * the list with the incident, so every screen shows exactly the buttons that will succeed.
 */
public enum IncidentAction {
    /** Assignee: accept the work. */
    ACKNOWLEDGE,
    /** Assignee: start investigating. */
    START_WORK,
    /** Assignee: mark fixed, with a resolution note. */
    RESOLVE,
    /** Reporter: confirm the fix worked. */
    VERIFY,
    /** Reporter: say the fix didn't work, which sends the incident back to the assignee. */
    REJECT_RESOLUTION,
    /** Reporter or service-desk admin, once verified. */
    CLOSE,
    /** Reporter or service-desk admin, while the incident is open. */
    CANCEL,
    /** Service-desk admin: choose or change the technician. */
    ASSIGN,
    /** Technician: assign the incident to themselves. */
    TAKE,
    /** Assignee or admin: record investigation work or an internal note. */
    ADD_NOTE,
    /** Assignee or admin: ask the reporter a question. */
    REQUEST_INFO,
    /** Reporter: answer a question or add details. */
    RESPOND,
    /** Reporter: rate the resolution once closed. */
    FEEDBACK,
    /** Service-desk admin: link as a duplicate of, or related to, another incident. */
    LINK
}
