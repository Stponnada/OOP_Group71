package com.spotlight.itsm.common.exception;

public class IncidentNotFoundException extends DomainException {

    public IncidentNotFoundException(String incidentId) {
        super("INCIDENT_NOT_FOUND", "No incident exists with id " + incidentId + ".");
    }
}
