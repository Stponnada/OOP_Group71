package com.spotlight.itsm.sla;

/** Computed compliance state. {@code MET} and {@code BREACHED} are historical; the rest are live. */
public enum SlaStatus {
    ON_TRACK,
    WARNING,
    BREACHED,
    MET
}
