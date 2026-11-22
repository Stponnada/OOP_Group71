package com.spotlight.itsm.notification;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Writes to the shared {@code public.notifications} table, which means the Spotlight
 * bell, unread counts and notification page all work with no frontend work at all.
 */
@Component
public class InAppChannel implements NotificationChannel {

    private final JdbcTemplate jdbc;

    public InAppChannel(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public String key() {
        return "in-app";
    }

    @Override
    public boolean supports(NotificationKind kind) {
        return true;
    }

    @Override
    public void deliver(NotificationMessage message) {
        jdbc.update("""
                        INSERT INTO public.notifications
                            (recipient_id, sender_id, notification_type, title, body,
                             reference_table, reference_id)
                        VALUES (?, NULL, ?, ?, ?, ?, ?)
                        """,
                message.recipientId(),
                message.kind().name(),
                message.title(),
                message.body(),
                message.referenceTable(),
                message.referenceId());
    }
}
