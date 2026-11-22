package com.spotlight.itsm.incident.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "incident_notes", schema = "itsm")
public class IncidentNoteEntity {

    @Id
    private UUID id;

    @Column(name = "incident_id")
    private UUID incidentId;

    @Column(name = "author_id")
    private UUID authorId;

    private String kind;

    private String body;

    @Column(name = "created_at")
    private Instant createdAt;

    protected IncidentNoteEntity() {
    }

    public IncidentNoteEntity(UUID id, UUID incidentId, UUID authorId, String kind, String body, Instant createdAt) {
        this.id = id;
        this.incidentId = incidentId;
        this.authorId = authorId;
        this.kind = kind;
        this.body = body;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getIncidentId() { return incidentId; }
    public UUID getAuthorId() { return authorId; }
    public String getKind() { return kind; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
