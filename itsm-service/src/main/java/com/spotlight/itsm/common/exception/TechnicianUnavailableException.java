package com.spotlight.itsm.common.exception;

public class TechnicianUnavailableException extends DomainException {

    public TechnicianUnavailableException(String detail) {
        super("TECHNICIAN_UNAVAILABLE", "That technician cannot take this incident: " + detail + ".");
    }
}
