package com.spotlight.itsm.assignment;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fair rotation over the available, qualified technicians.
 *
 * <p>The cursor is held per service and advanced on every successful pick. Kept in memory on
 * purpose: the rotation only needs to be fair within a running instance, and a restart
 * re-seeding from the least-loaded technician is a sane fallback. Move it to
 * {@code itsm.assignment_cursor} if the service is ever scaled horizontally.
 */
@Component
public class RoundRobinAssignment implements AssignmentStrategy {

    public static final String KEY = "round-robin";

    private final Map<UUID, UUID> lastPicked = new ConcurrentHashMap<>();

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String label() {
        return "Round-robin";
    }

    @Override
    public Optional<TechnicianCandidate> select(AssignmentContext context) {
        Optional<TechnicianCandidate> chosen = preview(context);
        chosen.ifPresent(c -> lastPicked.put(context.serviceId(), c.employeeId()));
        return chosen;
    }

    @Override
    public Optional<TechnicianCandidate> preview(AssignmentContext context) {
        List<TechnicianCandidate> pool = context.candidates().stream()
                .filter(TechnicianCandidate::hasCapacity)
                .filter(c -> context.requiredSkillIds().isEmpty()
                        || context.requiredSkillIds().stream().anyMatch(s -> c.proficiency(s) > 0))
                .sorted(Comparator.comparing(TechnicianCandidate::employeeId))
                .toList();

        if (pool.isEmpty()) {
            return Optional.empty();
        }

        UUID last = lastPicked.get(context.serviceId());
        int start = 0;
        if (last != null) {
            for (int i = 0; i < pool.size(); i++) {
                if (pool.get(i).employeeId().equals(last)) {
                    start = (i + 1) % pool.size();
                    break;
                }
            }
        }

        return Optional.of(pool.get(start));
    }
}
