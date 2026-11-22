# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Java backend for I-ITSM (Intelligent IT Service Management), a Spring Boot 3.4 / Java 17 / PostgreSQL service that powers Spotlight's incident management. It owns the `itsm` schema and nothing else. It reads identity from the core `public` schema (employees, departments, roles) and writes only to `public.notifications` and `public.audit_log`.

The web app (Next.js 16 in `../spotlight/website/`, Supabase migrations in `../spotlight/supabase/`) has its own `CLAUDE.md`. The Next.js `/incidents/**` routes call this service through `spotlight/website/lib/itsm-api.ts`, server-side only. `../docs/openapi/itsm-api.yaml` is the REST contract both sides follow. `CONTRACT.md` explains why the project is shaped this way.

## Commands

```bash
./mvnw test                                   # 74 JUnit tests, no database, ~1s
./mvnw -o test -Dtest=WeightedMatrixCalculatorTest   # one test class (-o = offline, deps are cached)
./mvnw -o test -Dtest=IncidentLifecycleTest#HappyPath  # one nested class or method
./mvnw spring-boot:run                        # serves on :8081, needs DB + JWT secret
python3 scripts/e2e-smoke.py                  # 89 HTTP checks; needs a fresh DB, service on :8081 (ITSM_BASE_URL overrides)
```

Required env for `spring-boot:run` (defaults in `application.yml` point at local Supabase on 54322):

```bash
export ITSM_DB_URL="jdbc:postgresql://127.0.0.1:5432/postgres"   # or 54322 for local Supabase
export ITSM_DB_USER=postgres
export ITSM_DB_PASSWORD=postgres
export SUPABASE_JWT_SECRET="<Supabase dashboard -> Settings -> API -> JWT Secret>"
```

Flyway runs on startup and creates the `itsm` schema, tables, views and seed data. Use port 5432 (direct or session pooler) for the DB, never the transaction pooler on 6543, because Flyway needs a session.

To run against a bare Postgres, load the stub core schema: `psql -d itsm -f src/test/resources/stub-core.sql`. It is for local use only, never production. The smoke script mints HS256 tokens with the hard-coded dev secret `devsecret-devsecret-devsecret-devsecret`, so the service must be started with that same value as `SUPABASE_JWT_SECRET`.

## Architecture

Layering, outside-in: `controller → application service → domain aggregate → repository port → JPA adapter → PostgreSQL`. Domain events are published inside the transaction and handled after commit by the notification dispatcher and the audit recorder.

**The domain is framework-free, and this is the rule to protect.** `incident/domain`, `priority`, `sla`, `escalation`, `event` and `lifecycle` must not import Spring, JPA or HTTP classes; their Spring adapters go in an `infrastructure/` subpackage (`sla/infrastructure` holds `SlaMonitor`). Check with:

```bash
grep -rl "org.springframework\|jakarta.persistence" \
  src/main/java/com/spotlight/itsm/{incident/domain,priority,sla,escalation,event,lifecycle} \
  | grep -v /infrastructure/
# must print nothing
```

Key pieces that span several packages:

- **Lifecycle:** `Incident` is a State-pattern aggregate. Each status is a class under `incident/domain/state/`, so illegal transitions cannot be expressed. `IncidentService` checks legality, then actor authorisation, then mutates, so a rejected move leaves no trace.
- **Priority:** `WeightedMatrixCalculator` (impact × urgency matrix) wrapped by `RuleBasedCalculator`, a decorator whose rules can only raise a priority (executive escalation, regulated-service floor, security override).
- **Roles and actions:** an employee is a *technician* when `itsm.technician_profiles` has a row for them, and a *service-desk admin* when they are a superuser or an admin of the IT department (`GET /api/v1/me`). `IncidentAccessPolicy` turns role + relationship (reporter, assignee) + status into the `actions` list on every incident response; the UI renders only those buttons, so permissions live here, not in the frontend.
- **Assignment:** `AssignmentStrategy` with four implementations (round-robin, load, skill, priority-aware), chosen through `AssignmentStrategyRegistry`; the default is stored in `itsm.settings`. Candidates come from `TechnicianDirectory`, minus the incident's reporter. `TechnicianRecommender` ranks everyone for the assign screen and shows which strategy picks whom.
- **SLA:** `SlaPolicyResolver` picks an `SlaPolicy` per service; `SlaClock` computes response and resolution deadlines; `HistoricalSlaRiskAssessor` forecasts breach risk from past resolution times. `SlaMonitor` (scheduled) sends the warning once, records breaches, and climbs the escalation chain in `escalation/` (team lead → system administrator → IT manager, passing up when nobody holds a role), notifying each rung.
- **Notifications:** `IncidentNotificationListener` decides recipients (reporter, assignee, admins, reporters of linked duplicates); `NotificationDispatcher` fans out to `InAppChannel` (writes `public.notifications` with `reference_table = 'itsm.incidents'`, which the bell links to) and `EmailChannel` (Resend, skipped without `itsm.resend.api-key`). Dispatch is synchronous after commit; there is no outbox worker yet.
- **Identity:** `SupabaseJwtAuthenticationConverter` turns the Supabase `sub` into an `EmployeePrincipal` by looking up `public.employees`. Authorities come from the role assignments in `public.employee_roles`.
- **Errors:** every error is RFC 7807 `ProblemDetail` with a stable `errorCode`, produced by `GlobalExceptionHandler`. Method-security denials must map to 403 explicitly, or the catch-all turns them into 500.

## Frozen contracts

Changing one of these is a deliberate, separate step. Change the contract first, in its own commit, then the code that depends on it.

| Contract | Location | Breaks if changed carelessly |
|---|---|---|
| REST surface | `../docs/openapi/itsm-api.yaml` | the frontend DTOs in `spotlight/website/lib/itsm-types.ts` (hand-copied, not generated) |
| Status vocabulary | `incident/domain/IncidentStatus.java` | DB CHECK constraint, API enum, UI badges |
| Priority maths | `priority/WeightedMatrixCalculator.java` | documented algorithm and its unit tests |
| SLA targets | `sla/*` **and** `V2__itsm_seed.sql` | engine and UI must agree |
| Table shape | `db/migration/V1__itsm_schema.sql` | Flyway checksums. Never edit an applied migration; add the next `V…__` instead |

`hibernate.ddl-auto` is `validate`, so entity fields must match the Flyway schema exactly. A mismatch fails at startup, which is the intended check. Do not switch to `update`.

## Known gaps (do not assume these work)

- `itsm.incident_attachments` has a table but no endpoint.
- `itsm.outbox` exists and nothing writes to it.
- No Testcontainers or `@SpringBootTest` tests yet. Schema and HTTP behaviour are covered by the smoke script and by hand.
- `public.audit_log.action` is a CHECK-constrained enum with no `update`, so configuration edits are recorded as `status_change` (the Audit log page relabels them).
