package com.spotlight.itsm.web;

import com.spotlight.itsm.common.exception.CapacityExceededException;
import com.spotlight.itsm.common.exception.DomainException;
import com.spotlight.itsm.common.exception.DuplicateIncidentException;
import com.spotlight.itsm.common.exception.IncidentNotFoundException;
import com.spotlight.itsm.common.exception.InvalidTransitionException;
import com.spotlight.itsm.common.exception.SlaPolicyMissingException;
import com.spotlight.itsm.common.exception.TechnicianUnavailableException;
import com.spotlight.itsm.common.exception.UnauthorizedActionException;
import com.spotlight.itsm.common.exception.ValidationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The one place domain failures become HTTP. The mapping is deliberate:
 *
 * <ul>
 *   <li>404 — the incident does not exist;</li>
 *   <li>403 — it exists but you may not touch it;</li>
 *   <li>409 — the request conflicts with the current state (illegal transition, capacity,
 *       duplicate); the client may retry after changing something;</li>
 *   <li>422 — the request is well-formed but a business rule rejects it;</li>
 *   <li>400 — the request itself is malformed.</li>
 * </ul>
 *
 * <p>{@code errorCode} is stable and is what the UI branches on; messages are for humans.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IncidentNotFoundException.class)
    public ProblemDetail notFound(IncidentNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, e);
    }

    @ExceptionHandler(UnauthorizedActionException.class)
    public ProblemDetail forbidden(UnauthorizedActionException e) {
        return problem(HttpStatus.FORBIDDEN, e);
    }

    @ExceptionHandler({InvalidTransitionException.class, DuplicateIncidentException.class,
            CapacityExceededException.class, TechnicianUnavailableException.class})
    public ProblemDetail conflict(DomainException e) {
        return problem(HttpStatus.CONFLICT, e);
    }

    @ExceptionHandler({ValidationException.class, SlaPolicyMissingException.class})
    public ProblemDetail unprocessable(DomainException e) {
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, e);
    }

    /**
     * Method security ({@code @PreAuthorize}) throws inside the dispatcher, so without this
     * handler the catch-all below would turn a clean 403 into a 500.
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ProblemDetail accessDenied(org.springframework.security.access.AccessDeniedException e) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, "You do not have permission to do that.");
        detail.setTitle("Forbidden");
        detail.setProperty("errorCode", "UNAUTHORIZED_ACTION");
        return detail;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail invalidBody(MethodArgumentNotValidException e) {
        ProblemDetail detail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        detail.setTitle("Bad request");
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(error -> fields.put(error.getField(), error.getDefaultMessage()));
        detail.setProperty("errors", fields);
        detail.setProperty("errorCode", "VALIDATION_FAILED");
        detail.setType(URI.create("about:blank"));
        return detail;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail illegalArgument(IllegalArgumentException e) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        detail.setTitle("Bad request");
        detail.setProperty("errorCode", "VALIDATION_FAILED");
        return detail;
    }

    /** A unique code taken, or a row that still has dependants: the request clashes with data. */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ProblemDetail conflictingData(org.springframework.dao.DataIntegrityViolationException e) {
        log.info("rejected by a database constraint: {}", e.getMostSpecificCause().getMessage());
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "That clashes with existing data, for example a code that is already in use.");
        detail.setTitle("Conflict");
        detail.setProperty("errorCode", "DATA_CONFLICT");
        return detail;
    }

    /** Request parameters of the wrong type, such as an unknown status in a filter. */
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ProblemDetail badParameter(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException e) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "'" + e.getValue() + "' is not a valid value for " + e.getName() + ".");
        detail.setTitle("Bad request");
        detail.setProperty("errorCode", "VALIDATION_FAILED");
        return detail;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail unexpected(Exception e) {
        log.error("unhandled failure", e);
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. It has been logged.");
        detail.setTitle("Internal error");
        detail.setProperty("errorCode", "INTERNAL_ERROR");
        return detail;
    }

    private ProblemDetail problem(HttpStatus status, DomainException e) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, e.getMessage());
        detail.setTitle(status.getReasonPhrase());
        detail.setType(URI.create("about:blank"));
        detail.setProperty("errorCode", e.errorCode());
        return detail;
    }
}
