package com.spotlight.itsm.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** Read-only projection of the core employee table in `public`. The ITSM service never writes here. */
@Entity
@Table(name = "employees", schema = "public")
public class EmployeeEntity {

    @Id
    private UUID id;

    @Column(name = "auth_user_id")
    private UUID authUserId;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    private String email;

    @Column(name = "is_active")
    private boolean active;

    protected EmployeeEntity() {
    }

    public UUID getId() {
        return id;
    }

    public UUID getAuthUserId() {
        return authUserId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getEmail() {
        return email;
    }

    public boolean isActive() {
        return active;
    }

    public String displayName() {
        String name = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
        return name.isEmpty() ? "Unknown employee" : name;
    }
}
