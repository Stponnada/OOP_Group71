package com.spotlight.itsm.incident.domain;

/** How much of the business is affected. Weight feeds the priority matrix. */
public enum Impact {

    MINIMAL(1, "Minimal", "A single user, with a workaround."),
    MINOR(2, "Minor", "A team or small group is affected."),
    MAJOR(3, "Major", "A whole department or a core workflow is affected."),
    EXTENSIVE(4, "Extensive", "The organisation, or external customers, are affected.");

    private final int weight;
    private final String label;
    private final String description;

    Impact(int weight, String label, String description) {
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
