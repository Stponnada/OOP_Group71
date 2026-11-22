# ITSM Service

The graded Java application. Spring Boot 3.4, Java 17, PostgreSQL.

Read this before writing code here.

---

## It runs

```bash
./mvnw test                 # 74 unit tests, no database, ~1s
./mvnw spring-boot:run      # needs a database and a JWT secret
```

Environment:

```bash
export ITSM_DB_URL="jdbc:postgresql://127.0.0.1:5432/postgres"
export ITSM_DB_USER=postgres
export ITSM_DB_PASSWORD=postgres
export SUPABASE_JWT_SECRET="<Supabase dashboard -> Settings -> API -> JWT Secret>"
```

On first start Flyway creates the `itsm` schema, all tables, views and seed data. The service
then serves on `:8081`; `/actuator/health` and `/swagger-ui.html` are open, everything else needs
a Supabase bearer token.

**Supabase pooler:** use port **5432** (direct or session mode). Flyway cannot migrate through
the transaction-mode pooler on 6543.

### Running against a bare Postgres

`src/test/resources/stub-core.sql` creates a minimal `public` schema (organisations, departments,
roles, employees, employee_roles, notifications, audit_log) with three people and an Engineering
department. It is for local runs and Testcontainers only — never production.

```bash
createdb itsm
psql -d itsm -f src/test/resources/stub-core.sql
```

Nobody is a technician until an admin adds them (`PUT /api/v1/technicians/{employeeId}`, or the
Technicians page). The smoke script does that itself, so a fresh database is all it needs.

### End-to-end smoke test

`scripts/e2e-smoke.py` drives the real HTTP API with signed JWTs and checks 89 behaviours:
roles and the per-caller `actions`, the three demo workflows, illegal transitions, info
requests and replies, internal notes, verify and feedback, duplicate correlation and linking,
the unassigned pool, recommendations, catalog/SLA/strategy administration, analytics, the audit
trail, and that nobody is auto-assigned their own report.

```bash
python3 scripts/e2e-smoke.py        # service must be running on :8081 (ITSM_BASE_URL overrides)
```

It needs a fresh database (it counts today's reports) and exits non-zero on any failure.
Useful as the pre-demo check.

---

## What is proven

| Claim | Evidence |
|---|---|
| The domain has no framework dependencies | 110 source files compile with plain `javac` and an empty classpath |
| The lifecycle is correct | 74 JUnit tests: happy path, every illegal move, actor rules, required content, access actions, escalation chain, recommendations, SLA risk |
| The priority maths is correct | matrix, band boundaries, user-multiplier boundaries, rule floors |
| The SLA clock is correct | deadlines, 75% warning, breach, met, response vs resolution legs |
| The schema enforces the same invariants | verified against real PostgreSQL 14 |
| It boots | Spring context starts, Hibernate `validate` passes against the migrated schema |
| It serves | 89/89 end-to-end checks pass over HTTP with real HS256 tokens |
| It notifies | 5 rows in `public.notifications` from one worked incident |
| It audits | 8 rows in `public.audit_log`, written in the same transaction |
| Method security returns 403, not 500 | verified — this was a real bug, see below |

### Bugs found and fixed during construction

1. **Half-applied transitions.** The aggregate wrote the new status before checking the actor, so
   a rejected `verify()` left the incident in `VERIFIED`. Now legality is checked, then
   authorisation, then mutation — a rejected move leaves no trace. Test:
   `leavesNoTraceOfARejectedMove`.
2. **`escalation_level` type mismatch.** `smallint` in SQL, `int` in Java. Caught by
   `ddl-auto: validate` at startup, not at 2am in the demo.
3. **403 became 500.** `@PreAuthorize` throws inside the dispatcher, so the catch-all handler
   swallowed it. Added an explicit `AccessDeniedException` handler.
4. **Wrong SLA test expectation.** The test assumed P1 warned at 20 minutes; the policy warns at
   22.5. The code was right, the test was wrong.

---

## Architecture

```
Controller  ->  Application service  ->  Domain aggregate  ->  Repository port
                     |                                             |
                     |                                             v
                     +-> Spring events (after commit)        JPA adapter
                              |                                   |
                     NotificationDispatcher                  PostgreSQL
                     InAppChannel / EmailChannel
```

The rule that keeps the design honest: **no Spring, JPA or HTTP import inside
`incident/domain`, `priority`, `sla`, `escalation`, `event` or `lifecycle`.** Spring adapters
for those live in an `infrastructure/` subpackage (`sla/infrastructure` holds the scheduled
`SlaMonitor`). If an import leaks, the class diagram stops describing the code. Check with:

```bash
grep -rl "org.springframework\|jakarta.persistence" \
  src/main/java/com/spotlight/itsm/{incident/domain,priority,sla,escalation,event,lifecycle} \
  | grep -v /infrastructure/
# must print nothing
```

---

## Layout

| Package | Contents |
|---|---|
| `incident/domain` | `Incident` aggregate, statuses, value objects, `IncidentFactory`, `IncidentSnapshot` |
| `incident/domain/state` | nine state classes — the State pattern |
| `incident/application` | `IncidentService`, `IncidentAccessPolicy`, `ReferenceGenerator`, `CreateIncidentCommand` |
| `incident/infrastructure` | JPA entity, repositories, Specifications, mapper, adapter |
| `incident/web` | controller, DTOs, assembler, timeline query |
| `priority` | `PriorityCalculator`, weighted matrix, rule-based decorator, three rules |
| `assignment` | `AssignmentStrategy` + four implementations, registry, technician directory |
| `sla` | policies, window, clock, resolver, historical risk assessor; `sla/infrastructure`: the scheduled monitor |
| `escalation` | the escalation chain: team lead → system administrator → IT manager |
| `notification` | channel interface, in-app and email adapters, dispatcher, event listener |
| `audit` | event, port, JPA recorder into `public.audit_log` |
| `intelligence` | similarity scorer, duplicate detector, categorisation suggester |
| `reporting` | reporting views and controller |
| `catalog` | catalog lookups and queries, admin writes (`CatalogAdminService`), controller |
| `identity` | Supabase subject → `EmployeePrincipal`, authority derivation |
| `config` | security, JWT converter, domain bean wiring |
| `web` | `ProblemDetail` exception handling |

---

## Design patterns, and where to point at them

| Pattern | Class | One-line defence |
|---|---|---|
| State | `IncidentState` + 9 states | `NEW → CLOSED` is impossible by construction, not by an `if` |
| Strategy | `PriorityCalculator`, `AssignmentStrategy`, `NotificationChannel` | three axes of behaviour swapped without touching the caller |
| Factory | `IncidentFactory` | nobody can create an unclassified, unprioritised incident |
| Observer | `IncidentChangedEvent` → listeners | audit, notification and SLA react without the service knowing them |
| Repository | `IncidentRepository` ↔ `JpaIncidentRepository` | the aggregate never sees a table |
| Adapter | `InAppChannel`, `EmailChannel` | Resend and the in-app bell behind one interface |
| Chain of Responsibility | `EscalationHandler` → `TeamLeadEscalation` → `SystemAdministratorEscalation` → `ItManagerEscalation` | each rung handles it or passes it up when nobody holds the role |
| Specification | `IncidentSpecifications` | eight filters compose |
| Template Method | `SlaPolicy.windowFor` | shared arithmetic, per-type targets |
| Decorator | `RuleBasedCalculator` | rules wrap the matrix and can only raise |

---

## Frozen contracts

| Contract | File | Breaks if changed carelessly |
|---|---|---|
| Lifecycle vocabulary | `incident/domain/IncidentStatus.java` | DB CHECK, API enum, UI badges |
| Legal transitions | `incident/domain/state/*` | the class diagram and the transition table |
| Priority maths | `priority/WeightedMatrixCalculator.java` | documented algorithm |
| SLA targets | `sla/*` **and** `V2__itsm_seed.sql` | must agree or engine and UI disagree |
| REST surface | `../docs/openapi/itsm-api.yaml` | the frontend types in `lib/itsm-types.ts`, hand-copied from it |
| Table shape | `db/migration/V1__itsm_schema.sql` | Flyway checksums — never edit an applied migration |

Change a contract first, in its own commit, then the two or three places that depend on it.

---

## Not built yet

Honest list. Do not assume any of this works:

- **Attachments** (`itsm.incident_attachments`) have a table but no endpoint. Screenshots are P3.
- **Outbox** table exists and is written to by nothing; notification dispatch is after-commit and
  synchronous. Converting to a polled outbox is the reliability upgrade, not a correctness fix.
- **Testcontainers** integration tests are not written; the schema is verified by hand and by the
  smoke script.
- **Email** goes out only when `itsm.resend.api-key` is set; otherwise the channel logs and skips.

Built since the first cut (V3 adds `sla_warning_sent_at` and `itsm.settings`): SLA warnings are
sent once per incident; escalation notifies each rung (team lead, system administrator, IT
manager); the three admin `PUT` endpoints and `DELETE /technicians/{id}` exist; risk comes from
`HistoricalSlaRiskAssessor`; new reports are correlated (DUPLICATE or RELATED links), and
reporters of linked duplicates hear when the original is resolved; the Next.js pages exist.

---

## Next steps, in order

1. Add `@SpringBootTest` + Testcontainers against `stub-core.sql`.
2. Attachments endpoint over the existing Supabase `mariner-uploads` bucket.
3. A polled outbox for notifications.
