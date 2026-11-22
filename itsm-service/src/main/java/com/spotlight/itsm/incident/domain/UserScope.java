package com.spotlight.itsm.incident.domain;

/**
 * The reach of an incident expressed as a bounded multiplier. Kept as a value object rather
 * than a loose int so the banding rule lives in one place and is unit-tested directly.
 */
public record UserScope(int affectedUsers) {

    public UserScope {
        if (affectedUsers < 0) {
            throw new IllegalArgumentException("affectedUsers cannot be negative");
        }
    }

    public static UserScope of(int affectedUsers) {
        return new UserScope(affectedUsers);
    }

    public double multiplier() {
        if (affectedUsers < 5) {
            return 1.00;
        }
        if (affectedUsers <= 50) {
            return 1.15;
        }
        if (affectedUsers <= 500) {
            return 1.30;
        }
        return 1.50;
    }

    public String band() {
        if (affectedUsers < 5) {
            return "single/team";
        }
        if (affectedUsers <= 50) {
            return "department";
        }
        if (affectedUsers <= 500) {
            return "site";
        }
        return "organisation";
    }
}
