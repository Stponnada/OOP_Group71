package com.spotlight.itsm.identity;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Tells the web app who the caller is to the service desk. The roles come from
 * {@link IdentityService}, the same place every permission check gets them, so the pages a
 * person is shown and the calls they're allowed to make can't disagree.
 */
@RestController
@RequestMapping("/api/v1")
public class MeController {

    public record MeView(UUID employeeId, String displayName, boolean technician,
                         boolean serviceDeskAdmin, List<String> departments) {
    }

    @GetMapping("/me")
    public MeView me(@AuthenticationPrincipal EmployeePrincipal actor) {
        return new MeView(actor.employeeId(), actor.displayName(), actor.technician(),
                actor.serviceDeskAdmin(), actor.departments().stream().sorted().toList());
    }
}
