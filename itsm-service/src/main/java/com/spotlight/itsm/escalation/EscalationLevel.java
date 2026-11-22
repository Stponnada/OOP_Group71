package com.spotlight.itsm.escalation;

/** The rungs of the ladder the brief describes: Technician, Team Lead, System Administrator, IT Manager. */
public final class EscalationLevel {

    public static final int TEAM_LEAD = 1;
    public static final int SYSTEM_ADMINISTRATOR = 2;
    public static final int IT_MANAGER = 3;
    public static final int MAX = IT_MANAGER;

    private EscalationLevel() {
    }
}
