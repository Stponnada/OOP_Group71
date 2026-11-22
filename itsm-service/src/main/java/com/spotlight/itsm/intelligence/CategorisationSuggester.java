package com.spotlight.itsm.intelligence;

import com.spotlight.itsm.catalog.CatalogDtos.CategorisationView;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Urgency;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Rule-based categorisation from free text.
 *
 * <p>Deliberately not an LLM: it is instant, free, explainable, and returns the terms that
 * matched so the reporter can see why. The model (Mariner) may suggest a different category on
 * top, but the product works with the network unplugged.
 */
@Component
public class CategorisationSuggester {

    private static final Map<String, List<String>> CATEGORY_TERMS = new LinkedHashMap<>();
    private static final Map<String, List<String>> SERVICE_TERMS = new LinkedHashMap<>();

    static {
        CATEGORY_TERMS.put("AUTHENTICATION", List.of("login", "log in", "password", "sso", "mfa", "locked out", "sign in", "credentials"));
        CATEGORY_TERMS.put("NETWORK", List.of("network", "vpn", "wifi", "internet", "latency", "dns", "connection", "timeout"));
        CATEGORY_TERMS.put("DATABASE", List.of("database", "sql", "query", "deadlock", "replication", "table", "postgres"));
        CATEGORY_TERMS.put("SECURITY", List.of("phishing", "breach", "malware", "suspicious", "security", "unauthorised", "unauthorized"));
        CATEGORY_TERMS.put("STORAGE", List.of("storage", "disk", "full", "backup", "drive", "quota"));
        CATEGORY_TERMS.put("CLOUD", List.of("cloud", "aws", "azure", "region", "bucket", "instance"));
        CATEGORY_TERMS.put("HARDWARE", List.of("laptop", "monitor", "keyboard", "printer", "battery", "screen", "hardware"));
        CATEGORY_TERMS.put("APPLICATION", List.of("application", "app", "page", "error", "crash", "bug", "slow", "loading"));
        CATEGORY_TERMS.put("SOFTWARE", List.of("software", "install", "update", "license", "licence", "outlook", "excel"));

        SERVICE_TERMS.put("PAYMENTS", List.of("payment", "transaction", "checkout", "billing", "invoice", "refund"));
        SERVICE_TERMS.put("AUTH", List.of("login", "password", "sso", "sign in", "mfa", "credentials"));
        SERVICE_TERMS.put("ERP-DB", List.of("database", "sql", "erp"));
        SERVICE_TERMS.put("EMAIL", List.of("email", "outlook", "mailbox", "smtp"));
        SERVICE_TERMS.put("VPN", List.of("vpn", "remote access", "tunnel"));
        SERVICE_TERMS.put("CLOUD-STORAGE", List.of("storage", "drive", "sharepoint", "bucket", "quota"));
        SERVICE_TERMS.put("PRINT", List.of("print", "printer", "toner", "scan"));
        SERVICE_TERMS.put("LAPTOP", List.of("laptop", "desktop", "monitor", "keyboard", "battery"));
        SERVICE_TERMS.put("INTRANET", List.of("intranet", "portal", "homepage"));
    }

    private final JdbcTemplate jdbc;
    private final SimilarityScorer tokens = new SimilarityScorer();

    public CategorisationSuggester(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public CategorisationView suggest(String description) {
        String text = description == null ? "" : description.toLowerCase(Locale.ROOT);

        Map.Entry<String, List<String>> bestCategory = bestMatch(text, CATEGORY_TERMS);
        Map.Entry<String, List<String>> bestService = bestMatch(text, SERVICE_TERMS);

        List<String> matched = new ArrayList<>();
        if (bestCategory != null) {
            matched.addAll(matchedTerms(text, bestCategory.getValue()));
        }

        double confidence = 0;
        if (bestCategory != null && !bestCategory.getValue().isEmpty()) {
            confidence = Math.min(1.0, (double) matchedTerms(text, bestCategory.getValue()).size()
                    / Math.max(1, bestCategory.getValue().size()) * 3);
        }

        UUID categoryId = bestCategory == null ? null : lookup("itsm.service_categories", bestCategory.getKey());
        String categoryName = bestCategory == null ? null : displayName("itsm.service_categories", bestCategory.getKey());
        UUID serviceId = bestService == null ? null : lookup("itsm.service_catalog", bestService.getKey());
        String serviceName = bestService == null ? null : displayName("itsm.service_catalog", bestService.getKey());

        Impact impact = containsAny(text, List.of("everyone", "all users", "organisation", "organization", "company-wide", "nobody"))
                ? Impact.EXTENSIVE
                : containsAny(text, List.of("team", "department", "several users", "multiple users"))
                ? Impact.MAJOR
                : Impact.MINOR;

        Urgency urgency = containsAny(text, List.of("down", "unavailable", "cannot", "can't", "stopped", "blocked", "outage", "critical"))
                ? Urgency.CRITICAL
                : containsAny(text, List.of("slow", "intermittent", "sometimes", "delay"))
                ? Urgency.MEDIUM
                : Urgency.LOW;

        return new CategorisationView(categoryId, categoryName, serviceId, serviceName,
                impact, urgency, Math.round(confidence * 100) / 100.0, matched);
    }

    private Map.Entry<String, List<String>> bestMatch(String text, Map<String, List<String>> table) {
        return table.entrySet().stream()
                .max(Map.Entry.comparingByValue(java.util.Comparator.comparingInt(list -> matchedTerms(text, list).size())))
                .filter(e -> !matchedTerms(text, e.getValue()).isEmpty())
                .orElse(null);
    }

    private List<String> matchedTerms(String text, List<String> terms) {
        return terms.stream().filter(text::contains).toList();
    }

    private boolean containsAny(String text, List<String> terms) {
        return terms.stream().anyMatch(text::contains);
    }

    private UUID lookup(String table, String code) {
        List<UUID> ids = jdbc.queryForList(
                "SELECT id FROM " + table + " WHERE code = ?", UUID.class, code);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private String displayName(String table, String code) {
        List<String> names = jdbc.queryForList(
                "SELECT name FROM " + table + " WHERE code = ?", String.class, code);
        return names.isEmpty() ? null : names.get(0);
    }

    public Optional<String> categoryCodeFor(String text) {
        return Optional.ofNullable(bestMatch(text == null ? "" : text.toLowerCase(Locale.ROOT), CATEGORY_TERMS))
                .map(Map.Entry::getKey);
    }
}
