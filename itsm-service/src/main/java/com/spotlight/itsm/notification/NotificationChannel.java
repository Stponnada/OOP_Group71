package com.spotlight.itsm.notification;

/**
 * Adapter contract for one delivery mechanism.
 *
 * <p>Two ship: {@link InAppChannel} writes to the existing {@code public.notifications} table so
 * the Spotlight bell keeps working, and {@link EmailChannel} sends through Resend. A future SMS,
 * Slack or push channel is a new class implementing this interface, registered as a bean — the
 * brief's "easy to introduce another notification mechanism later" requirement, satisfied
 * structurally rather than by intention.
 */
public interface NotificationChannel {

    String key();

    boolean supports(NotificationKind kind);

    void deliver(NotificationMessage message);
}
