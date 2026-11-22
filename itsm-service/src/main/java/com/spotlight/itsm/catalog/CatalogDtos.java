package com.spotlight.itsm.catalog;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.Urgency;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryView(UUID id, String code, String name, int sortOrder, boolean isActive,
                               String description) {
    }

    public record ServiceView(UUID id, String code, String name, UUID categoryId,
                              BusinessCriticality businessCriticality, UUID slaProfileId, boolean isActive,
                              String description, List<UUID> requiredSkillIds) {
    }

    public record SkillView(UUID id, String code, String name) {
    }

    public record SlaTargetView(Priority priority, int responseMinutes, int resolutionMinutes, int warningPercent) {
    }

    public record SlaProfileView(UUID id, String code, String name, boolean isActive, List<SlaTargetView> targets) {
    }

    public record TechnicianView(UUID employeeId, String displayName, boolean isAvailable,
                                 int activeIncidents, int maxActiveIncidents, double utilisationPercent,
                                 int experienceYears, List<SkillProficiency> skills, List<UUID> serviceIds,
                                 UUID teamLeadId, String teamLeadName) {
    }

    public record SkillProficiency(UUID skillId, String name, int proficiency) {
    }

    public record AssignmentSettingsView(String defaultStrategyKey, List<StrategyView> strategies) {
    }

    public record StrategyView(String key, String label) {
    }

    public record CategorisationView(UUID categoryId, String categoryName, UUID serviceId, String serviceName,
                                     Impact impact, Urgency urgency, double confidence, List<String> matchedTerms) {
    }

    // ------------------------------------------------------------------ admin writes

    public record CategoryWrite(String code, @NotBlank @Size(max = 120) String name, String description,
                                Integer sortOrder, Boolean isActive) {
    }

    public record ServiceWrite(String code, @NotBlank @Size(max = 160) String name, String description,
                               @NotNull UUID categoryId, @NotNull BusinessCriticality businessCriticality,
                               UUID slaProfileId, Boolean isActive, List<UUID> requiredSkillIds) {
    }

    public record SkillLevel(@NotNull UUID skillId, @Min(1) @Max(5) int proficiency) {
    }

    public record TechnicianUpdate(Boolean isAvailable, @Min(1) Integer maxActiveIncidents,
                                   @Min(0) Integer experienceYears, List<@Valid SkillLevel> skills,
                                   List<UUID> serviceIds, UUID teamLeadId) {
    }

    public record SlaTargetWrite(@NotNull Priority priority, @Min(1) int responseMinutes,
                                 @Min(1) int resolutionMinutes, Integer warningPercent) {
    }

    public record SlaProfileUpdate(String name, Boolean isActive, List<@Valid SlaTargetWrite> targets) {
    }

    public record AssignmentSettingsUpdate(@NotBlank String defaultStrategyKey) {
    }
}
