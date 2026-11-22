package com.spotlight.itsm.incident.infrastructure;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.Urgency;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "incidents", schema = "itsm")
public class IncidentEntity {

    @Id
    private UUID id;

    private String reference;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "reporter_id")
    private UUID reporterId;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "service_id")
    private UUID serviceId;

    private String title;

    private String description;

    @Enumerated(EnumType.STRING)
    private Impact impact;

    @Enumerated(EnumType.STRING)
    private Urgency urgency;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_criticality")
    private BusinessCriticality businessCriticality;

    @Column(name = "affected_users")
    private int affectedUsers;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    @Column(name = "priority_score")
    private BigDecimal priorityScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "priority_factors")
    private Map<String, Double> priorityFactors;

    @Column(name = "priority_explanation")
    private String priorityExplanation;

    @Enumerated(EnumType.STRING)
    private IncidentStatus status;

    @Column(name = "assigned_technician_id")
    private UUID assignedTechnicianId;

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "first_response_at")
    private Instant firstResponseAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "resolution_note")
    private String resolutionNote;

    @Column(name = "cancellation_reason")
    private String cancellationReason;

    @Column(name = "sla_profile_id")
    private UUID slaProfileId;

    @Column(name = "sla_started_at")
    private Instant slaStartedAt;

    @Column(name = "response_due_at")
    private Instant responseDueAt;

    @Column(name = "resolution_due_at")
    private Instant resolutionDueAt;

    @Column(name = "warning_percent")
    private int warningPercent;

    @Column(name = "response_breached")
    private boolean responseBreached;

    @Column(name = "resolution_breached")
    private boolean resolutionBreached;

    @Column(name = "escalation_level")
    private short escalationLevel;

    @Version
    private Long version;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public UUID getReporterId() { return reporterId; }
    public void setReporterId(UUID reporterId) { this.reporterId = reporterId; }
    public UUID getCategoryId() { return categoryId; }
    public void setCategoryId(UUID categoryId) { this.categoryId = categoryId; }
    public UUID getServiceId() { return serviceId; }
    public void setServiceId(UUID serviceId) { this.serviceId = serviceId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Impact getImpact() { return impact; }
    public void setImpact(Impact impact) { this.impact = impact; }
    public Urgency getUrgency() { return urgency; }
    public void setUrgency(Urgency urgency) { this.urgency = urgency; }
    public BusinessCriticality getBusinessCriticality() { return businessCriticality; }
    public void setBusinessCriticality(BusinessCriticality value) { this.businessCriticality = value; }
    public int getAffectedUsers() { return affectedUsers; }
    public void setAffectedUsers(int affectedUsers) { this.affectedUsers = affectedUsers; }
    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }
    public BigDecimal getPriorityScore() { return priorityScore; }
    public void setPriorityScore(BigDecimal priorityScore) { this.priorityScore = priorityScore; }
    public Map<String, Double> getPriorityFactors() { return priorityFactors; }
    public void setPriorityFactors(Map<String, Double> factors) { this.priorityFactors = factors; }
    public String getPriorityExplanation() { return priorityExplanation; }
    public void setPriorityExplanation(String value) { this.priorityExplanation = value; }
    public IncidentStatus getStatus() { return status; }
    public void setStatus(IncidentStatus status) { this.status = status; }
    public UUID getAssignedTechnicianId() { return assignedTechnicianId; }
    public void setAssignedTechnicianId(UUID value) { this.assignedTechnicianId = value; }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
    public Instant getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(Instant value) { this.acknowledgedAt = value; }
    public Instant getFirstResponseAt() { return firstResponseAt; }
    public void setFirstResponseAt(Instant value) { this.firstResponseAt = value; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Instant verifiedAt) { this.verifiedAt = verifiedAt; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
    public String getResolutionNote() { return resolutionNote; }
    public void setResolutionNote(String value) { this.resolutionNote = value; }
    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String value) { this.cancellationReason = value; }
    public UUID getSlaProfileId() { return slaProfileId; }
    public void setSlaProfileId(UUID slaProfileId) { this.slaProfileId = slaProfileId; }
    public Instant getSlaStartedAt() { return slaStartedAt; }
    public void setSlaStartedAt(Instant slaStartedAt) { this.slaStartedAt = slaStartedAt; }
    public Instant getResponseDueAt() { return responseDueAt; }
    public void setResponseDueAt(Instant value) { this.responseDueAt = value; }
    public Instant getResolutionDueAt() { return resolutionDueAt; }
    public void setResolutionDueAt(Instant value) { this.resolutionDueAt = value; }
    public int getWarningPercent() { return warningPercent; }
    public void setWarningPercent(int warningPercent) { this.warningPercent = warningPercent; }
    public boolean isResponseBreached() { return responseBreached; }
    public void setResponseBreached(boolean value) { this.responseBreached = value; }
    public boolean isResolutionBreached() { return resolutionBreached; }
    public void setResolutionBreached(boolean value) { this.resolutionBreached = value; }
    public short getEscalationLevel() { return escalationLevel; }
    public void setEscalationLevel(short escalationLevel) { this.escalationLevel = escalationLevel; }
    public Long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
