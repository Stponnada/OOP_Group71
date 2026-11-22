package com.spotlight.itsm.intelligence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Finds incidents that probably describe the same underlying problem.
 *
 * <p>Scope is deliberately narrow: same service, last 30 days, open or recently closed. That
 * keeps the comparison meaningful (a payment outage is not a duplicate of a printer fault) and
 * the work bounded.
 */
@Component
public class DuplicateDetector {

    public record Candidate(UUID id, String reference, String title, double similarity,
                            String status, java.time.Instant createdAt) {
    }

    private static final double DUPLICATE_THRESHOLD = 0.30;

    private final JdbcTemplate jdbc;
    private final SimilarityScorer scorer;

    public DuplicateDetector(JdbcTemplate jdbc, SimilarityScorer scorer) {
        this.jdbc = jdbc;
        this.scorer = scorer;
    }

    /**
     * Ranks the service's recent incidents by how closely they match the given text.
     * {@code excludeId} leaves out the incident being compared, which would otherwise match itself
     * perfectly; pass null for a report that hasn't been saved yet.
     */
    public List<Candidate> find(UUID excludeId, UUID serviceId, String title, String description, int limit) {
        if (serviceId == null) {
            return List.of();
        }
        String probe = title + " " + description;

        List<Candidate> scored = new ArrayList<>(jdbc.query("""
                        SELECT id, reference, title, description, status, created_at
                        FROM itsm.incidents
                        WHERE service_id = ?
                          AND id IS DISTINCT FROM ?::uuid
                          AND created_at > now() - interval '30 days'
                          AND status <> 'CANCELLED'
                        ORDER BY created_at DESC
                        LIMIT 200
                        """,
                (rs, rowNum) -> {
                    String text = rs.getString("title") + " " + rs.getString("description");
                    return new Candidate(
                            rs.getObject("id", UUID.class),
                            rs.getString("reference"),
                            rs.getString("title"),
                            scorer.similarity(probe, text),
                            rs.getString("status"),
                            rs.getTimestamp("created_at").toInstant());
                },
                serviceId, excludeId));

        return scored.stream()
                .filter(c -> c.similarity() >= 0.15)
                .sorted(Comparator.comparingDouble(Candidate::similarity).reversed())
                .limit(limit)
                .toList();
    }

    public boolean looksLikeDuplicate(List<Candidate> candidates) {
        return candidates.stream().anyMatch(c -> c.similarity() >= DUPLICATE_THRESHOLD);
    }
}
