package com.spotlight.itsm.audit;

/** Port for writing the audit trail. Implemented over {@code public.audit_log}. */
public interface AuditRecorder {

    void record(AuditEvent event);
}
