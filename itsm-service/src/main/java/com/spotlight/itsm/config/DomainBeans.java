package com.spotlight.itsm.config;

import com.spotlight.itsm.assignment.AssignmentStrategy;
import com.spotlight.itsm.assignment.AssignmentStrategyRegistry;
import com.spotlight.itsm.incident.domain.IncidentFactory;
import com.spotlight.itsm.priority.PriorityCalculator;
import com.spotlight.itsm.priority.RuleBasedCalculator;
import com.spotlight.itsm.priority.WeightedMatrixCalculator;
import com.spotlight.itsm.sla.SlaClock;
import com.spotlight.itsm.sla.SlaPolicyResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import com.spotlight.itsm.sla.infrastructure.ConfiguredSlaPolicyResolver;

import java.util.List;

/**
 * Wires the framework-free domain to the container. This is the only file that decides which
 * strategy is the default; everything else asks the registry.
 */
@Configuration
public class DomainBeans {

    @Bean
    PriorityCalculator priorityCalculator() {
        // The matrix produces the baseline, the rules can only raise it.
        return RuleBasedCalculator.withDefaults(new WeightedMatrixCalculator());
    }

    @Bean
    SlaPolicyResolver slaPolicyResolver(JdbcTemplate jdbc) {
        // The service's configured profile first, then the rule-based policies (tightest first),
        // all with the targets administrators set on the SLA screen.
        return new ConfiguredSlaPolicyResolver(jdbc);
    }

    @Bean
    IncidentFactory incidentFactory(PriorityCalculator priorityCalculator,
                                    SlaPolicyResolver slaPolicyResolver) {
        return new IncidentFactory(priorityCalculator, slaPolicyResolver);
    }

    @Bean
    SlaClock slaClock() {
        return new SlaClock();
    }

    @Bean
    AssignmentStrategyRegistry assignmentStrategyRegistry(
            List<AssignmentStrategy> strategies,
            @Value("${itsm.assignment.default-strategy:load-based}") String defaultStrategy,
            JdbcTemplate jdbc) {
        // An administrator's choice on the settings screen outlives a restart; the property is
        // only the starting point.
        String saved = jdbc.query("SELECT value FROM itsm.settings WHERE key = 'assignment.default-strategy'",
                rs -> rs.next() ? rs.getString(1) : null);
        AssignmentStrategyRegistry registry = new AssignmentStrategyRegistry(strategies, defaultStrategy);
        if (saved != null && registry.has(saved)) {
            registry.useAsDefault(saved);
        }
        return registry;
    }
}
