package com.spotlight.itsm.reporting;

import com.spotlight.itsm.identity.EmployeePrincipal;
import com.spotlight.itsm.reporting.ReportDtos.AuditEntry;
import com.spotlight.itsm.reporting.ReportDtos.OverviewReport;
import com.spotlight.itsm.reporting.ReportDtos.ServiceReportRow;
import com.spotlight.itsm.reporting.ReportDtos.SlaReportRow;
import com.spotlight.itsm.reporting.ReportDtos.WorkloadRow;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Analytics is restricted to service-desk administrators: operational numbers per technician
 * are not something every employee should see.
 */
@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasRole('SERVICE_DESK_ADMIN')")
public class ReportController {

    private final ReportQueryService reports;

    public ReportController(ReportQueryService reports) {
        this.reports = reports;
    }

    @GetMapping("/reports/overview")
    public OverviewReport overview() {
        return reports.overview();
    }

    @GetMapping("/reports/workload")
    public List<WorkloadRow> workload() {
        return reports.workload();
    }

    @GetMapping("/reports/services")
    public List<ServiceReportRow> services() {
        return reports.services();
    }

    @GetMapping("/reports/sla")
    public List<SlaReportRow> sla() {
        return reports.sla();
    }

    @GetMapping("/reports/trend")
    public List<ReportDtos.TrendPoint> trend(@RequestParam(defaultValue = "14") int days) {
        return reports.trend(Math.max(1, Math.min(days, 90)));
    }

    @GetMapping("/reports/categories")
    public List<ReportDtos.CategoryReportRow> categories() {
        return reports.categories();
    }

    @GetMapping("/reports/escalations")
    public List<ReportDtos.EscalationRow> escalations(@RequestParam(defaultValue = "20") int limit) {
        return reports.escalations(Math.max(1, Math.min(limit, 200)));
    }

    @GetMapping("/audit")
    public List<AuditEntry> audit(@RequestParam(required = false) UUID incidentId,
                                  @RequestParam(defaultValue = "100") int limit) {
        return reports.audit(incidentId, Math.min(limit, 500));
    }
}
