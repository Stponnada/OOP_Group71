package com.spotlight.itsm.incident.domain;

/** The four priority bands. Lower rank is more severe, so {@code P1.atLeast(P3)} is true. */
public enum Priority {

    P1("Critical", 1),
    P2("High", 2),
    P3("Medium", 3),
    P4("Low", 4);

    private final String label;
    private final int rank;

    Priority(String label, int rank) {
        this.label = label;
        this.rank = rank;
    }

    public String label() {
        return label;
    }

    public int rank() {
        return rank;
    }

    /** True when this priority is at least as severe as {@code other}. */
    public boolean atLeast(Priority other) {
        return this.rank <= other.rank;
    }

    public static Priority moreSevere(Priority a, Priority b) {
        return a.rank <= b.rank ? a : b;
    }
}
