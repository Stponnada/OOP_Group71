package com.spotlight.itsm.notification;

import java.util.UUID;

/**
 * A channel-agnostic message. Channels translate it; they never decide recipients.
 * {@code referenceTable}/{@code referenceId} are what let the in-app channel deep-link and the
 * bell UI group related notices.
 */
public record NotificationMessage(
        UUID recipientId,
        NotificationKind kind,
        String title,
        String body,
        String referenceTable,
        UUID referenceId
) {

    public NotificationMessage {
        if (recipientId == null) {
            throw new IllegalArgumentException("recipientId is required");
        }
        if (kind == null) {
            throw new IllegalArgumentException("kind is required");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        body = body == null ? "" : body;
    }
}
