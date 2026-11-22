package com.spotlight.itsm.assignment;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Smart technician recommendation: ranks every technician for one incident and says why, so the
 * person assigning can see the trade-off rather than trust a single answer.
 *
 * <p>The score (0-100) weighs skill coverage of the service's required skills (40), spare
 * capacity (30), having worked on this service before (15) and experience (15, capped at ten
 * years). Unavailable or full technicians score zero. Alongside the score, each configured
 * assignment strategy is asked who it would pick (via {@link AssignmentStrategy#preview}, which
 * records nothing), so the ranking and the automatic assignment can be compared side by side.
 */
public final class TechnicianRecommender {

    public record Recommendation(UUID employeeId, String displayName, double score, boolean isAvailable,
                                 int activeIncidents, int maxActiveIncidents, int experienceYears,
                                 double skillMatch, boolean knowsService, List<String> pickedBy,
                                 List<String> reasons) {
    }

    private TechnicianRecommender() {
    }

    public static List<Recommendation> rank(AssignmentContext context, List<AssignmentStrategy> strategies) {
        List<Recommendation> ranked = new ArrayList<>();
        for (TechnicianCandidate c : context.candidates()) {
            List<String> pickedBy = new ArrayList<>();
            for (AssignmentStrategy strategy : strategies) {
                strategy.preview(context)
                        .filter(pick -> pick.employeeId().equals(c.employeeId()))
                        .ifPresent(pick -> pickedBy.add(strategy.label()));
            }
            ranked.add(score(c, context, pickedBy));
        }
        ranked.sort(Comparator.comparingDouble(Recommendation::score).reversed()
                .thenComparing(Recommendation::activeIncidents));
        return ranked;
    }

    static Recommendation score(TechnicianCandidate c, AssignmentContext context, List<String> pickedBy) {
        List<String> reasons = new ArrayList<>();

        double skillMatch;
        if (context.requiredSkillIds().isEmpty()) {
            skillMatch = 1.0;
        } else {
            double sum = 0;
            for (UUID skill : context.requiredSkillIds()) {
                sum += Math.min(5, c.proficiency(skill)) / 5.0;
            }
            skillMatch = sum / context.requiredSkillIds().size();
        }
        boolean knows = context.serviceId() != null && c.hasWorkedOn(context.serviceId());
        double headroom = Math.max(0, 1.0 - c.utilisation());

        if (!c.available()) {
            reasons.add("Marked unavailable");
        } else if (!c.hasCapacity()) {
            reasons.add("At capacity (" + c.activeIncidents() + "/" + c.maxActiveIncidents() + ")");
        }
        if (context.requiredSkillIds().isEmpty()) {
            reasons.add("No specific skills required");
        } else if (skillMatch >= 0.8) {
            reasons.add("Strong match on the required skills");
        } else if (skillMatch > 0) {
            reasons.add("Partial match on the required skills");
        } else {
            reasons.add("None of the required skills");
        }
        reasons.add(c.activeIncidents() + " of " + c.maxActiveIncidents() + " active incidents");
        if (knows) {
            reasons.add("Has worked on this service before");
        }
        if (c.experienceYears() > 0) {
            reasons.add(c.experienceYears() + (c.experienceYears() == 1 ? " year" : " years") + " of experience");
        }

        double score = c.hasCapacity()
                ? 40 * skillMatch + 30 * headroom + (knows ? 15 : 0) + 15 * Math.min(10, c.experienceYears()) / 10.0
                : 0;

        return new Recommendation(c.employeeId(), c.displayName(), Math.round(score * 10) / 10.0, c.available(),
                c.activeIncidents(), c.maxActiveIncidents(), c.experienceYears(),
                Math.round(skillMatch * 100) / 100.0, knows, List.copyOf(pickedBy), List.copyOf(reasons));
    }
}
