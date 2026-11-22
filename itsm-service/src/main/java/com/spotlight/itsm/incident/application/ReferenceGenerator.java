package com.spotlight.itsm.incident.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Hands out the human reference (INC-2026-000123) from a database sequence. */
@Component
public class ReferenceGenerator {

    private final JdbcTemplate jdbc;

    public ReferenceGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String next() {
        return jdbc.queryForObject(
                "SELECT itsm.next_incident_reference(EXTRACT(YEAR FROM now())::int)", String.class);
    }
}
