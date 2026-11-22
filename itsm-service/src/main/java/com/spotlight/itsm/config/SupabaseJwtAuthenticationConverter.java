package com.spotlight.itsm.config;

import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.identity.IdentityService;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Maps a Supabase JWT to an authenticated employee.
 *
 * <p>A valid token with no active employee row is rejected: authentication without an
 * authorisable identity is not useful and would let a deleted user through.
 */
@Component
public class SupabaseJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final IdentityService identityService;

    public SupabaseJwtAuthenticationConverter(IdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        UUID authUserId = UUID.fromString(jwt.getSubject());
        Optional<EmployeePrincipal> resolved = identityService.resolve(authUserId);

        if (resolved.isEmpty()) {
            throw new org.springframework.security.oauth2.server.resource.InvalidBearerTokenException(
                    "No active employee is linked to this account.");
        }

        EmployeePrincipal principal = resolved.get();
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_EMPLOYEE"));
        if (principal.technician()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_TECHNICIAN"));
        }
        if (principal.serviceDeskAdmin()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_SERVICE_DESK_ADMIN"));
        }

        return new EmployeeAuthenticationToken(principal, authorities);
    }
}
