package com.spotlight.itsm.priority;

import com.spotlight.itsm.incident.domain.BusinessCriticality;
import com.spotlight.itsm.incident.domain.Impact;
import com.spotlight.itsm.incident.domain.Priority;
import com.spotlight.itsm.incident.domain.PriorityAssessment;
import com.spotlight.itsm.incident.domain.Urgency;
import com.spotlight.itsm.incident.domain.UserScope;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class WeightedMatrixCalculatorTest {

    private final WeightedMatrixCalculator matrix = new WeightedMatrixCalculator();

    private PriorityInput input(Impact impact, Urgency urgency, BusinessCriticality criticality, int users) {
        return new PriorityInput(impact, urgency, criticality, users, false, false, false, "APPLICATION", "PAYMENTS");
    }

    @Test
    @DisplayName("a payment outage for the whole organisation is the maximum score")
    void paymentOutageIsP1() {
        PriorityAssessment result = matrix.assess(input(
                Impact.EXTENSIVE, Urgency.CRITICAL, BusinessCriticality.REVENUE_OR_REGULATED, 2000));

        assertThat(result.score()).isEqualTo(120.0);
        assertThat(result.priority()).isEqualTo(Priority.P1);
    }

    @Test
    void oneUserUnableToPrintIsP4() {
        PriorityAssessment result = matrix.assess(input(
                Impact.MINIMAL, Urgency.MEDIUM, BusinessCriticality.LOW, 1));

        assertThat(result.priority()).isEqualTo(Priority.P4);
    }

    @Test
    void aDepartmentBlockedOnTheDatabaseIsP2() {
        PriorityAssessment result = matrix.assess(input(
                Impact.MAJOR, Urgency.HIGH, BusinessCriticality.HIGH, 20));

        assertThat(result.priority()).isEqualTo(Priority.P2);
    }

    @Test
    void explainsItsReasoning() {
        PriorityAssessment result = matrix.assess(input(
                Impact.EXTENSIVE, Urgency.CRITICAL, BusinessCriticality.REVENUE_OR_REGULATED, 2000));

        assertThat(result.explanation()).contains("Extensive", "Critical", "P1");
        assertThat(result.factors()).containsKeys("impact", "urgency", "criticality", "userMultiplier");
    }

    @ParameterizedTest(name = "{0} users -> x{1}")
    @CsvSource({"1,1.00", "4,1.00", "5,1.15", "50,1.15", "51,1.30", "500,1.30", "501,1.50"})
    void userMultiplierBandsAreInclusiveAtTheTop(int users, double expected) {
        assertThat(UserScope.of(users).multiplier()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "score {0} -> {1}")
    @CsvSource({"60,P1", "59.99,P2", "30,P2", "29.99,P3", "10,P3", "9.99,P4", "0,P4"})
    void bandBoundaries(double score, Priority expected) {
        assertThat(WeightedMatrixCalculator.band(score)).isEqualTo(expected);
    }

    @Test
    void rulesOnlyEverRaise() {
        RuleBasedCalculator calculator = RuleBasedCalculator.withDefaults(matrix);
        PriorityAssessment baseline = matrix.assess(input(
                Impact.MINIMAL, Urgency.LOW, BusinessCriticality.LOW, 1));

        PriorityAssessment ruled = calculator.assess(new PriorityInput(
                Impact.MINIMAL, Urgency.LOW, BusinessCriticality.LOW, 1, false, false, false, "HARDWARE", "PRINT"));

        assertThat(baseline.priority()).isEqualTo(Priority.P4);
        assertThat(ruled.priority()).isEqualTo(Priority.P4);
    }

    @Test
    void securityIncidentsAreFlooredToP1() {
        RuleBasedCalculator calculator = RuleBasedCalculator.withDefaults(matrix);
        PriorityAssessment result = calculator.assess(new PriorityInput(
                Impact.MINIMAL, Urgency.LOW, BusinessCriticality.MEDIUM, 1, true, false, false, "SECURITY", "AUTH"));

        assertThat(result.priority()).isEqualTo(Priority.P1);
        assertThat(result.explanation()).contains("security-incident");
    }
}
