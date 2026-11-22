package com.spotlight.itsm.config;

import com.spotlight.itsm.identity.EmployeePrincipal;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/**
 * Carries the {@link EmployeePrincipal} as the authentication principal, so controllers can take
 * {@code @AuthenticationPrincipal EmployeePrincipal actor} instead of re-reading the token.
 */
public class EmployeeAuthenticationToken extends AbstractAuthenticationToken {

    private final EmployeePrincipal principal;

    public EmployeeAuthenticationToken(EmployeePrincipal principal,
                                       Collection<GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    @Override
    public EmployeePrincipal getPrincipal() {
        return principal;
    }

    @Override
    public String getName() {
        return principal.employeeId().toString();
    }
}
