package com.spotlight.itsm.incident.domain;

/**
 * How much the affected service matters to the business. Sourced from the service catalog
 * and snapshotted onto the incident, so later catalog edits cannot rewrite history.
 */
public enum BusinessCriticality {

    LOW(1, "Low"),
    MEDIUM(2, "Medium"),
    HIGH(3, "High"),
    CRITICAL(4, "Critical"),
    REVENUE_OR_REGULATED(5, "Revenue / regulated");

    private final int weight;
    private final String label;

    BusinessCriticality(int weight, String label) {
        this.weight = weight;
        this.label = label;
    }

    public int weight() {
        return weight;
    }

    public String label() {
        return label;
    }

    /** True when this criticality is at least as high as {@code other}. */
    public boolean atLeast(BusinessCriticality other) {
        return this.weight >= other.weight;
    }
}
