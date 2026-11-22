package com.spotlight.itsm.common.exception;

/** The actor is authenticated but not permitted to perform this action on this incident. */
public class UnauthorizedActionException extends DomainException {

    public UnauthorizedActionException(String action) {
        super("UNAUTHORIZED_ACTION", "You are not permitted to " + action + " this incident.");
    }
}
