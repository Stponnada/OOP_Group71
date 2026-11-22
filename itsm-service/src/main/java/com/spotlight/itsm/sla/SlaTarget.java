package com.spotlight.itsm.sla;

/**
 * The agreed targets for one priority. Minutes rather than {@link java.time.Duration} because
 * this is configuration data an administrator types into a form and reads back.
 */
public record SlaTarget(int responseMinutes, int resolutionMinutes, int warningPercent) {

    public SlaTarget {
        if (responseMinutes <= 0) {
            throw new IllegalArgumentException("responseMinutes must be positive");
        }
        if (resolutionMinutes < responseMinutes) {
            throw new IllegalArgumentException("resolution target cannot be shorter than the response target");
        }
        if (warningPercent < 1 || warningPercent > 100) {
            throw new IllegalArgumentException("warningPercent must be between 1 and 100");
        }
    }
}
