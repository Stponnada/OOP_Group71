package com.spotlight.itsm.intelligence;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Deterministic token-overlap similarity (Jaccard) with stop-word removal.
 *
 * <p>Chosen over an embedding model on purpose: it is explainable, needs no network, costs
 * nothing, and produces the same answer twice. The model can narrate the result; it should not
 * be the only thing standing between a duplicate and a queue.
 */
@Component
public class SimilarityScorer {

    private static final Set<String> STOP_WORDS = Set.of(
            "the", "a", "an", "is", "are", "was", "were", "to", "of", "and", "or", "in", "on",
            "for", "with", "not", "cannot", "cant", "can", "it", "this", "that", "we", "our",
            "users", "user", "keeps", "getting", "when", "while", "from", "but", "has", "have");

    public double similarity(String left, String right) {
        Set<String> a = tokens(left);
        Set<String> b = tokens(right);
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return (double) intersection.size() / union.size();
    }

    public Set<String> tokens(String text) {
        if (text == null) {
            return Set.of();
        }
        return Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
                .filter(t -> t.length() > 2)
                .filter(t -> !STOP_WORDS.contains(t))
                .collect(Collectors.toSet());
    }

    /** Terms that appear in both texts — what the UI shows to justify a match. */
    public Set<String> sharedTerms(String left, String right) {
        Set<String> a = tokens(left);
        a.retainAll(tokens(right));
        return a;
    }
}
