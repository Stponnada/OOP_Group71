package com.spotlight.itsm.notification;

import com.spotlight.itsm.event.IncidentActivityEvent;
import com.spotlight.itsm.event.IncidentChangedEvent;
import com.spotlight.itsm.event.SlaAlertEvent;
import com.spotlight.itsm.identity.IdentityService;
import com.spotlight.itsm.identity.ServiceDeskDirectory;
import com.spotlight.itsm.incident.domain.Incident;
import com.spotlight.itsm.incident.domain.IncidentStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/**
 * Turns committed changes into notices (Observer). Recipients are decided here, never by the
 * channels and never from hard-coded lists: the reporter hears about progress, the assignee
 * hears about work, service-desk admins hear about work nobody has, and the SLA monitor names
 * the people on each escalation rung. Nobody is told about their own action.
 */
@Component
public class IncidentNotificationListener {

    private static final String TABLE = "itsm.incidents";
    private static final DateTimeFormatter WHEN =
            DateTimeFormatter.ofPattern("d MMM, HH:mm").withZone(ZoneId.of("Asia/Kolkata"));

    private final NotificationDispatcher dispatcher;
    private final IdentityService identity;
    private final ServiceDeskDirectory directory;
    private final JdbcTemplate jdbc;

    public IncidentNotificationListener(NotificationDispatcher dispatcher, IdentityService identity,
                                        ServiceDeskDirectory directory, JdbcTemplate jdbc) {
        this.dispatcher = dispatcher;
        this.identity = identity;
        this.directory = directory;
        this.jdbc = jdbc;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onIncidentChanged(IncidentChangedEvent event) {
        Incident incident = event.incident();
        List<NotificationMessage> messages = new ArrayList<>();
        String ref = incident.reference();

        if (event.isCreation()) {
            // The reporter's receipt goes out even though they are the actor: it is their record
            // of the reference, the priority and who has it.
            dispatcher.dispatch(List.of(message(incident.reporterId(), NotificationKind.INCIDENT_CREATED,
                    ref + " logged as " + incident.priority().priority(),
                    "We have logged your incident as " + incident.priority().priority()
                            + " (" + incident.priority().priority().label() + "). "
                            + incident.assignee().map(a -> nameOf(a) + " is on it. ")
                                    .orElse("The service desk is finding a technician. ")
                            + "Target resolution: " + describeTarget(incident) + ".", incident)));
            if (incident.assignee().isPresent()) {
                messages.add(message(incident.assignee().get(), NotificationKind.INCIDENT_ASSIGNED,
                        ref + " assigned to you",
                        incident.priority().priority() + " - " + incident.title()
                                + ". Due " + describeTarget(incident) + ".", incident));
            } else {
                for (UUID admin : directory.serviceDeskAdmins()) {
                    messages.add(message(admin, NotificationKind.INCIDENT_NEEDS_ASSIGNMENT,
                            ref + " needs a technician",
                            "No technician was free to take " + incident.priority().priority()
                                    + " - " + incident.title() + ". Assign it from the queue.", incident));
                }
            }
        } else {
            switch (event.to()) {
                case ASSIGNED -> {
                    incident.assignee().ifPresent(tech -> messages.add(message(tech,
                            NotificationKind.INCIDENT_ASSIGNED,
                            ref + " assigned to you",
                            incident.priority().priority() + " - " + incident.title()
                                    + ". Due " + describeTarget(incident) + ".", incident)));
                    messages.add(message(incident.reporterId(), NotificationKind.INCIDENT_ASSIGNED,
                            ref + " is with " + nameOf(incident.assignee().orElse(null)),
                            "A technician has picked up your incident.", incident));
                }
                case ACKNOWLEDGED -> messages.add(message(incident.reporterId(),
                        NotificationKind.INCIDENT_ACKNOWLEDGED,
                        ref + " acknowledged", nameOf(event.actorId()) + " is looking into it.", incident));
                case RESOLVED -> {
                    messages.add(message(incident.reporterId(),
                            NotificationKind.INCIDENT_RESOLVED,
                            ref + " resolved: please confirm",
                            nullSafe(incident.resolutionNote()) + " Confirm the fix, or tell us it's still broken.",
                            incident));
                    messages.addAll(duplicateReporters(incident));
                }
                case VERIFIED -> {
                    incident.assignee().ifPresent(tech -> messages.add(message(tech,
                            NotificationKind.INCIDENT_RESOLVED,
                            ref + " fix confirmed",
                            nameOf(incident.reporterId()) + " confirmed the fix works.", incident)));
                    for (UUID admin : directory.serviceDeskAdmins()) {
                        messages.add(message(admin, NotificationKind.INCIDENT_RESOLVED,
                                ref + " ready to close", "The reporter verified the fix.", incident));
                    }
                }
                case CLOSED -> messages.add(message(incident.reporterId(),
                        NotificationKind.INCIDENT_CLOSED, ref + " closed",
                        "Thank you. You can rate the resolution from the incident page.", incident));
                case IN_PROGRESS -> {
                    if (event.from() == IncidentStatus.RESOLVED) {
                        incident.assignee().ifPresent(tech -> messages.add(message(tech,
                                NotificationKind.INCIDENT_REOPENED,
                                ref + " reopened",
                                "The reporter says it is still not right: " + nullSafe(event.note()),
                                incident)));
                    }
                }
                case CANCELLED -> {
                    messages.add(message(incident.reporterId(),
                            NotificationKind.INCIDENT_CLOSED, ref + " cancelled",
                            nullSafe(event.note()), incident));
                    incident.assignee().ifPresent(tech -> messages.add(message(tech,
                            NotificationKind.INCIDENT_CLOSED, ref + " cancelled",
                            nullSafe(event.note()), incident)));
                }
                default -> {
                }
            }
        }

        send(messages, event.actorId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onActivity(IncidentActivityEvent event) {
        Incident incident = event.incident();
        String ref = incident.reference();
        List<NotificationMessage> messages = new ArrayList<>();

        switch (event.activity()) {
            case INFO_REQUESTED -> messages.add(message(incident.reporterId(),
                    NotificationKind.INCIDENT_INFO_REQUESTED,
                    ref + ": " + nameOf(event.actorId()) + " needs more information",
                    nullSafe(event.detail()), incident));
            case INFO_PROVIDED -> {
                List<UUID> to = incident.assignee().map(List::of).orElseGet(directory::serviceDeskAdmins);
                for (UUID person : to) {
                    messages.add(message(person, NotificationKind.INCIDENT_INFO_PROVIDED,
                            ref + ": " + nameOf(incident.reporterId()) + " replied",
                            nullSafe(event.detail()), incident));
                }
            }
            case FEEDBACK -> incident.assignee().ifPresent(tech -> messages.add(message(tech,
                    NotificationKind.FEEDBACK_RECEIVED, ref + " rated " + nullSafe(event.detail()),
                    nameOf(incident.reporterId()) + " left feedback on your resolution.", incident)));
            case LINKED -> messages.add(message(incident.reporterId(),
                    NotificationKind.INCIDENT_MARKED_DUPLICATE, ref + " linked to another report",
                    nullSafe(event.detail()), incident));
        }

        send(messages, event.actorId());
    }

    /** Runs after the monitor's sweep commits; with no transaction (tests) it runs at once. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSlaAlert(SlaAlertEvent event) {
        NotificationKind kind = switch (event.alert()) {
            case WARNING -> NotificationKind.SLA_WARNING;
            case BREACHED -> NotificationKind.SLA_BREACHED;
            case ESCALATED -> NotificationKind.INCIDENT_ESCALATED;
        };
        String title = switch (event.alert()) {
            case WARNING -> event.reference() + " is close to its SLA deadline";
            case BREACHED -> event.reference() + " missed its SLA";
            case ESCALATED -> event.reference() + " escalated to you";
        };
        List<NotificationMessage> messages = new ArrayList<>();
        for (UUID recipient : new LinkedHashSet<>(event.recipients())) {
            messages.add(new NotificationMessage(recipient, kind, title,
                    event.priority() + " - " + event.title() + ". " + nullSafe(event.detail()),
                    TABLE, event.incidentId()));
        }
        dispatcher.dispatch(messages);
    }

    /**
     * People who reported the same problem separately: every incident linked to this one as a
     * DUPLICATE (open, or cancelled as a duplicate) by someone other than its reporter. Each hears
     * on their own incident, the one they are allowed to open.
     */
    private List<NotificationMessage> duplicateReporters(Incident incident) {
        UUID id = incident.id().value();
        return jdbc.query("""
                        SELECT DISTINCT i.id, i.reference, i.reporter_id
                        FROM itsm.incident_links l
                        JOIN itsm.incidents i
                          ON i.id = CASE WHEN l.incident_id = ? THEN l.related_incident_id ELSE l.incident_id END
                        WHERE (l.incident_id = ? OR l.related_incident_id = ?)
                          AND l.relation = 'DUPLICATE'
                          AND i.status <> 'CLOSED'
                          AND i.reporter_id <> ?
                        """,
                (rs, n) -> new NotificationMessage(rs.getObject("reporter_id", UUID.class),
                        NotificationKind.INCIDENT_RESOLVED,
                        rs.getString("reference") + ": the same problem has been fixed",
                        "Your report matched " + incident.reference() + ", which is now resolved. "
                                + nullSafe(incident.resolutionNote()),
                        TABLE, rs.getObject("id", UUID.class)),
                id, id, id, incident.reporterId());
    }

    private void send(List<NotificationMessage> messages, UUID actor) {
        messages.removeIf(m -> m.recipientId().equals(actor));
        dispatcher.dispatch(messages);
    }

    private NotificationMessage message(UUID recipient, NotificationKind kind, String title,
                                        String body, Incident incident) {
        return new NotificationMessage(recipient, kind, title, body, TABLE, incident.id().value());
    }

    private String nameOf(UUID employeeId) {
        return employeeId == null ? "The service desk" : identity.displayName(employeeId);
    }

    private String describeTarget(Incident incident) {
        return incident.slaWindow()
                .map(w -> WHEN.format(w.resolutionDueAt()))
                .orElse("to be confirmed");
    }

    static String formatWhen(Instant instant) {
        return WHEN.format(instant);
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }
}
