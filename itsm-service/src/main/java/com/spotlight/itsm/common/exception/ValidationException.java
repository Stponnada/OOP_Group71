package com.spotlight.itsm.common.exception;

/** A business rule rejected otherwise well-formed input, e.g. a resolution with no note. */
public class ValidationException extends DomainException {

    public ValidationException(String message) {
        super("VALIDATION_FAILED", message);
    }
}
