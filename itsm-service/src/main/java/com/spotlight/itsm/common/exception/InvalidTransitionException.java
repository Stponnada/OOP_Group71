package com.spotlight.itsm.common.exception;

/**
 * Raised when a lifecycle move is not permitted by the state graph, e.g. NEW -> CLOSED.
 * The brief calls this case out explicitly; it is the project's canonical "inappropriate
 * state transition" guard.
 */
public class InvalidTransitionException extends DomainException {

    public InvalidTransitionException(String from, String to) {
        super("INVALID_TRANSITION", "An incident cannot move from " + from + " to " + to + ".");
    }
}
