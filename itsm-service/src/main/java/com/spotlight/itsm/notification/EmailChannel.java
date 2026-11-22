package com.spotlight.itsm.notification;

import com.spotlight.itsm.identity.IdentityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Sends through Resend, the same provider the web app uses. Degrades to a log line when no
 * API key is configured, so a local checkout still shows the full in-app flow.
 */
@Component
public class EmailChannel implements NotificationChannel {

    private static final Logger log = LoggerFactory.getLogger(EmailChannel.class);

    private final IdentityService identity;
    private final RestClient http;
    private final String apiKey;
    private final String from;

    public EmailChannel(IdentityService identity,
                        RestClient.Builder builder,
                        @Value("${itsm.resend.api-key:}") String apiKey,
                        @Value("${itsm.resend.from:Spotlight <onboarding@resend.dev>}") String from) {
        this.identity = identity;
        this.http = builder.baseUrl("https://api.resend.com").build();
        this.apiKey = apiKey;
        this.from = from;
    }

    @Override
    public String key() {
        return "email";
    }

    @Override
    public boolean supports(NotificationKind kind) {
        return switch (kind) {
            case SLA_BREACHED, INCIDENT_ASSIGNED, INCIDENT_RESOLVED, INCIDENT_ESCALATED, INCIDENT_CLOSED -> true;
            default -> false;
        };
    }

    @Override
    public void deliver(NotificationMessage message) {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("[email skipped: no RESEND key] {} -> {}", message.title(), message.recipientId());
            return;
        }
        String to = identity.emailOf(message.recipientId()).orElse(null);
        if (to == null || to.isBlank()) {
            log.warn("no email address for recipient {}", message.recipientId());
            return;
        }
        try {
            http.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", from,
                            "to", to,
                            "subject", message.title(),
                            "text", message.body()))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            log.warn("email delivery failed: {}", e.getMessage());
        }
    }
}
