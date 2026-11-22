package com.spotlight.itsm.assignment;

import com.spotlight.itsm.incident.domain.Priority;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TechnicianRecommenderTest {

    private final UUID service = UUID.randomUUID();
    private final UUID network = UUID.randomUUID();

    private TechnicianCandidate tech(String name, boolean available, int active, int max, int years,
                                     int networkLevel, boolean knowsService) {
        return new TechnicianCandidate(UUID.randomUUID(), name, available, active, max, years,
                networkLevel == 0 ? Map.of() : Map.of(network, networkLevel),
                knowsService ? Set.of(service) : Set.of());
    }

    private static AssignmentStrategy picks(String key, TechnicianCandidate who) {
        return new AssignmentStrategy() {
            @Override
            public String key() {
                return key;
            }

            @Override
            public String label() {
                return key;
            }

            @Override
            public java.util.Optional<TechnicianCandidate> select(AssignmentContext context) {
                return java.util.Optional.of(who);
            }
        };
    }

    @Test
    void ranksSkillCapacityAndExperienceAndSaysWhy() {
        TechnicianCandidate expert = tech("Expert", true, 1, 5, 8, 5, true);
        TechnicianCandidate junior = tech("Junior", true, 0, 5, 1, 1, false);
        AssignmentContext context = new AssignmentContext(Priority.P2, service, Set.of(network),
                List.of(junior, expert));

        var ranked = TechnicianRecommender.rank(context, List.of(picks("skill", expert)));

        assertThat(ranked).extracting(TechnicianRecommender.Recommendation::displayName)
                .containsExactly("Expert", "Junior");
        assertThat(ranked.get(0).pickedBy()).containsExactly("skill");
        assertThat(ranked.get(0).reasons()).contains("Strong match on the required skills",
                "Has worked on this service before");
        assertThat(ranked.get(1).pickedBy()).isEmpty();
    }

    @Test
    void someoneAtCapacityOrAwayScoresZero() {
        TechnicianCandidate full = tech("Full", true, 5, 5, 10, 5, true);
        TechnicianCandidate away = tech("Away", false, 0, 5, 10, 5, true);
        AssignmentContext context = new AssignmentContext(Priority.P1, service, Set.of(network),
                List.of(full, away));

        var ranked = TechnicianRecommender.rank(context, List.of());

        assertThat(ranked).allSatisfy(r -> assertThat(r.score()).isZero());
        assertThat(ranked).anySatisfy(r -> assertThat(r.reasons()).contains("At capacity (5/5)"));
        assertThat(ranked).anySatisfy(r -> assertThat(r.reasons()).contains("Marked unavailable"));
    }

    @Test
    void previewDoesNotAdvanceRoundRobin() {
        TechnicianCandidate a = tech("A", true, 0, 5, 1, 0, false);
        TechnicianCandidate b = tech("B", true, 0, 5, 1, 0, false);
        AssignmentContext context = new AssignmentContext(Priority.P3, service, Set.of(), List.of(a, b));
        RoundRobinAssignment roundRobin = new RoundRobinAssignment();

        var first = roundRobin.preview(context);
        var second = roundRobin.preview(context);

        assertThat(first).isEqualTo(second);
    }
}
