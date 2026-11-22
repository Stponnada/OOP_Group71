package com.spotlight.itsm.incident.domain;

/** How quickly the business needs this resolved, independent of how wide it is. */
public enum Urgency {

    LOW(1, "Low", "No deadline pressure; a workaround exists."),
    MEDIUM(2, "Medium", "Slows people down but they can continue."),
    HIGH(3, "High", "Blocks work that must be done today."),
    CRITICAL(4, "Critical", "Work has stopped and there is no workaround.");

    private final int weight;
    private final String label;
    private final String description;

    Urgency(int weight, String label, String description) {
        this.weight = weight;
        this.label = label;
        this.description = description;
    }

    public int weight() {
        return weight;
    }

    public String label() {
        return label;
    }

    public String description() {
        return description;
    }
}
