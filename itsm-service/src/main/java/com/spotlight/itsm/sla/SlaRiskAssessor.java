package com.spotlight.itsm.sla;

import java.time.Duration;
import java.time.Instant;

/**
 * Predicts whether an incident is heading for a breach, using how long this service has
 * historically taken. A pure forecast — the SLA clock remains the source of truth.
 */
public interface SlaRiskAssessor {

    RiskBand assess(SlaWindow window, Duration medianResolutionForService, Instant now);

    enum RiskBand {
        LOW,
        MEDIUM,
        HIGH,
        BREACHED
    }
}
