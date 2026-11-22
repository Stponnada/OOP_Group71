package com.spotlight.itsm.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Fans one message out to every channel that claims it.
 *
 * <p>Failures are isolated per channel: a bounced email must not stop the in-app notice, and one
 * broken channel must not break the others.
 */
@Component
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final List<NotificationChannel> channels;

    public NotificationDispatcher(List<NotificationChannel> channels) {
        this.channels = List.copyOf(channels);
    }

    public void dispatch(List<NotificationMessage> messages) {
        for (NotificationMessage message : messages) {
            for (NotificationChannel channel : channels) {
                if (!channel.supports(message.kind())) {
                    continue;
                }
                try {
                    channel.deliver(message);
                } catch (RuntimeException e) {
                    log.warn("channel {} failed for {}: {}", channel.key(), message.kind(), e.getMessage());
                }
            }
        }
    }
}
