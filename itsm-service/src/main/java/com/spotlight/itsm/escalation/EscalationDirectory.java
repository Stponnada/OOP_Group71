package com.spotlight.itsm.escalation;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Who sits at each rung of the escalation ladder. Implemented over the HR and ITSM tables. */
public interface EscalationDirectory {

    /** The team lead set on the technician's profile, if any. */
    Optional<UUID> teamLeadOf(UUID technicianId);

    /** Admins of the IT department: the people who run the service desk day to day. */
    List<UUID> systemAdministrators();

    /** Superusers: the IT manager tier, last stop on the ladder. */
    List<UUID> itManagers();
}
