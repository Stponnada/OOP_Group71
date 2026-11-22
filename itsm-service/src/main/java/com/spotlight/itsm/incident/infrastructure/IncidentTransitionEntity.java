package com.spotlight.itsm.incident.infrastructure;

import com.spotlight.itsm.incident.domain.IncidentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "incident_transitions", schema = "itsm")
public class IncidentTransitionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "incident_id")
    private UUID incidentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status")
    private IncidentStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status")
    private IncidentStatus toStatus;

    @Column(name = "actor_id")
    private UUID actorId;

    private String reason;

    @Column(name = "occurred_at")
    private Instant occurredAt;

    protected IncidentTransitionEntity() {
    }

    public IncidentTransitionEntity(UUID incidentId, IncidentStatus from, IncidentStatus to,
                                    UUID actorId, String reason, Instant occurredAt) {
        this.incidentId = incidentId;
        this.fromStatus = from;
        this.toStatus = to;
        this.actorId = actorId;
        this.reason = reason;
        this.occurredAt = occurredAt;
    }

    public Long getId() { return id; }
    public UUID getIncidentId() { return incidentId; }
    public IncidentStatus getFromStatus() { return fromStatus; }
    public IncidentStatus getToStatus() { return toStatus; }
    public UUID getActorId() { return actorId; }
    public String getReason() { return reason; }
    public Instant getOccurredAt() { return occurredAt; }
}
