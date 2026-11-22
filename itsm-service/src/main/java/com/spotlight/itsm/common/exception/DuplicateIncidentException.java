package com.spotlight.itsm.common.exception;

public class DuplicateIncidentException extends DomainException {

    public DuplicateIncidentException(String reference, double similarity) {
        super("DUPLICATE_INCIDENT",
                "This looks like " + reference + " (" + Math.round(similarity * 100) + "% similar). "
                        + "Add to that incident instead of filing a new one.");
    }
}
