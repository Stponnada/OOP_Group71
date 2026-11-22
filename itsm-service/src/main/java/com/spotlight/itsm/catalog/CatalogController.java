package com.spotlight.itsm.catalog;

import com.spotlight.itsm.assignment.AssignmentStrategyRegistry;
import com.spotlight.itsm.catalog.CatalogDtos.AssignmentSettingsUpdate;
import com.spotlight.itsm.catalog.CatalogDtos.AssignmentSettingsView;
import com.spotlight.itsm.catalog.CatalogDtos.CategoryView;
import com.spotlight.itsm.catalog.CatalogDtos.CategoryWrite;
import com.spotlight.itsm.catalog.CatalogDtos.ServiceView;
import com.spotlight.itsm.catalog.CatalogDtos.ServiceWrite;
import com.spotlight.itsm.catalog.CatalogDtos.SkillView;
import com.spotlight.itsm.catalog.CatalogDtos.SlaProfileUpdate;
import com.spotlight.itsm.catalog.CatalogDtos.SlaProfileView;
import com.spotlight.itsm.catalog.CatalogDtos.StrategyView;
import com.spotlight.itsm.catalog.CatalogDtos.TechnicianUpdate;
import com.spotlight.itsm.catalog.CatalogDtos.TechnicianView;
import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.intelligence.CategorisationSuggester;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The catalog and service-desk configuration. Anyone signed in can read the active catalog (the
 * report form needs it); every write, and reading retired entries, is for service-desk admins.
 */
@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private static final String ADMIN = "hasRole('SERVICE_DESK_ADMIN')";

    private final CatalogQueryService catalog;
    private final CatalogAdminService admin;
    private final AssignmentStrategyRegistry strategies;
    private final CategorisationSuggester suggester;

    public CatalogController(CatalogQueryService catalog,
                             CatalogAdminService admin,
                             AssignmentStrategyRegistry strategies,
                             CategorisationSuggester suggester) {
        this.catalog = catalog;
        this.admin = admin;
        this.strategies = strategies;
        this.suggester = suggester;
    }

    // --------------------------------------------------------------------- reads

    @GetMapping("/catalog/services")
    public List<ServiceView> services(@AuthenticationPrincipal EmployeePrincipal actor,
                                      @RequestParam(defaultValue = "false") boolean includeInactive) {
        return catalog.services(includeInactive && actor.serviceDeskAdmin());
    }

    @GetMapping("/catalog/categories")
    public List<CategoryView> categories(@AuthenticationPrincipal EmployeePrincipal actor,
                                         @RequestParam(defaultValue = "false") boolean includeInactive) {
        return catalog.categories(includeInactive && actor.serviceDeskAdmin());
    }

    @GetMapping("/catalog/skills")
    public List<SkillView> skills() {
        return catalog.skills();
    }

    @GetMapping("/technicians")
    public List<TechnicianView> technicians(@RequestParam(defaultValue = "false") boolean availableOnly,
                                            @RequestParam(required = false) UUID serviceId) {
        return catalog.technicians().stream()
                .filter(t -> !availableOnly || (t.isAvailable() && t.activeIncidents() < t.maxActiveIncidents()))
                .filter(t -> serviceId == null || t.serviceIds().contains(serviceId))
                .toList();
    }

    @GetMapping("/sla/profiles")
    public List<SlaProfileView> slaProfiles() {
        return catalog.slaProfiles();
    }

    @GetMapping("/settings/assignment")
    public AssignmentSettingsView assignmentSettings() {
        return new AssignmentSettingsView(
                strategies.defaultStrategy().key(),
                strategies.all().stream().map(s -> new StrategyView(s.key(), s.label())).toList());
    }

    @PostMapping("/catalog/categorise")
    public CatalogDtos.CategorisationView categorise(@RequestBody Map<String, String> body) {
        return suggester.suggest(body.getOrDefault("description", ""));
    }

    // -------------------------------------------------------------- admin writes

    @PostMapping("/catalog/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ADMIN)
    public CategoryView createCategory(@AuthenticationPrincipal EmployeePrincipal actor,
                                       @Valid @RequestBody CategoryWrite body) {
        return admin.createCategory(actor, body);
    }

    @PutMapping("/catalog/categories/{id}")
    @PreAuthorize(ADMIN)
    public CategoryView updateCategory(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                                       @Valid @RequestBody CategoryWrite body) {
        return admin.updateCategory(actor, id, body);
    }

    @PostMapping("/catalog/services")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(ADMIN)
    public ServiceView createService(@AuthenticationPrincipal EmployeePrincipal actor,
                                     @Valid @RequestBody ServiceWrite body) {
        return admin.createService(actor, body);
    }

    @PutMapping("/catalog/services/{id}")
    @PreAuthorize(ADMIN)
    public ServiceView updateService(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                                     @Valid @RequestBody ServiceWrite body) {
        return admin.updateService(actor, id, body);
    }

    @PutMapping("/technicians/{employeeId}")
    @PreAuthorize(ADMIN)
    public TechnicianView upsertTechnician(@AuthenticationPrincipal EmployeePrincipal actor,
                                           @PathVariable UUID employeeId,
                                           @Valid @RequestBody TechnicianUpdate body) {
        return admin.upsertTechnician(actor, employeeId, body);
    }

    @DeleteMapping("/technicians/{employeeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(ADMIN)
    public void removeTechnician(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID employeeId) {
        admin.removeTechnician(actor, employeeId);
    }

    @PutMapping("/sla/profiles/{id}")
    @PreAuthorize(ADMIN)
    public SlaProfileView updateSlaProfile(@AuthenticationPrincipal EmployeePrincipal actor, @PathVariable UUID id,
                                           @Valid @RequestBody SlaProfileUpdate body) {
        return admin.updateSlaProfile(actor, id, body);
    }

    @PutMapping("/settings/assignment")
    @PreAuthorize(ADMIN)
    public AssignmentSettingsView updateAssignmentSettings(@AuthenticationPrincipal EmployeePrincipal actor,
                                                           @Valid @RequestBody AssignmentSettingsUpdate body) {
        return admin.setDefaultStrategy(actor, body.defaultStrategyKey());
    }
}
