package com.spotlight.itsm.assignment;

import com.spotlight.itsm.common.exception.ValidationException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves a strategy by key. Spring populates this with every {@link AssignmentStrategy} bean,
 * so a new strategy is one class and one configuration value — never a change to the caller.
 */
public final class AssignmentStrategyRegistry {

    private final Map<String, AssignmentStrategy> byKey = new LinkedHashMap<>();
    private volatile String defaultKey;

    public AssignmentStrategyRegistry(List<AssignmentStrategy> strategies, String defaultKey) {
        if (strategies == null || strategies.isEmpty()) {
            throw new IllegalArgumentException("at least one assignment strategy is required");
        }
        strategies.forEach(strategy -> byKey.put(strategy.key(), strategy));
        if (!byKey.containsKey(defaultKey)) {
            throw new IllegalArgumentException("Unknown default assignment strategy: " + defaultKey);
        }
        this.defaultKey = defaultKey;
    }

    public AssignmentStrategy byKey(String key) {
        AssignmentStrategy strategy = byKey.get(key);
        if (strategy == null) {
            throw new ValidationException("Unknown assignment strategy: " + key);
        }
        return strategy;
    }

    public AssignmentStrategy defaultStrategy() {
        return byKey.get(defaultKey);
    }

    public boolean has(String key) {
        return byKey.containsKey(key);
    }

    /** Switches the default at run time: the next incident is assigned with this strategy. */
    public void useAsDefault(String key) {
        byKey(key);
        this.defaultKey = key;
    }

    public List<AssignmentStrategy> all() {
        return List.copyOf(byKey.values());
    }
}
