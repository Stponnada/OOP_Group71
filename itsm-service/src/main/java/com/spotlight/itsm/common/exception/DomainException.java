package com.spotlight.itsm.common.exception;

/**
 * Base of the ITSM exception hierarchy. Every subclass carries a stable machine-readable
 * {@code errorCode} that the web layer maps to an RFC 7807 {@code ProblemDetail}.
 *
 * <p>The domain never imports Spring or HTTP types. Mapping to status codes belongs to
 * {@code com.spotlight.itsm.web.GlobalExceptionHandler}, which keeps the model framework-free
 * and unit-testable without a container.
 */
public abstract class DomainException extends RuntimeException {

    private final String errorCode;

    protected DomainException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    protected DomainException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String errorCode() {
        return errorCode;
    }
}
