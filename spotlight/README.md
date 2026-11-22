# Spotlight

Spotlight is an IT service desk. Employees report IT incidents and follow them to resolution;
technicians and IT admins triage, assign and work them; the incident engine decides priority,
assignment and SLA deadlines. Mariner, an in-app assistant, can report and look up incidents in
plain language.

This repository holds the web app and the database it runs on. The incident engine itself is a
separate Java service (`itsm-service/`, Spring Boot), which the web app calls over REST.

## Layout

- `website/` — the Next.js 16 app (App Router, TypeScript, Tailwind CSS v4).
  - `app/(dashboard)/incidents/` — report, list and work incidents, through the Java service.
  - `app/(dashboard)/issues/` — bugs people report about Spotlight itself (separate from IT incidents).
  - `app/api/agent/` and `lib/agent/` — Mariner: one route, and a registry of tools gated per user.
  - `lib/itsm-api.ts`, `lib/itsm-types.ts` — the typed client for the Java service.
- `supabase/` — the core database: migrations for employees, departments, roles, notifications,
  audit log and Mariner's tables, plus a local seed. The `itsm` schema is owned by the Java
  service's Flyway migrations, not by these files.

## Running it locally

```bash
cd website
bun install
bun run dev:remote   # against the hosted Supabase project (copies .env.local.remote to .env.local)
bun run dev:local    # against a local Supabase stack (copies .env.local.local)
```

Start the Java service as well (see `itsm-service/`), or the incident pages show that it is
unreachable.

Checks: `bun run lint`, `bun run test`, `bun run build`.

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; privileged writes such as inviting employees |
| `ITSM_API_URL` | The Java service (default `http://localhost:8081`) |
| `OPENCODE_API_KEY` | Model access for Mariner |
| `SPOTLIGHT_AGENT_PROVIDER`, `SPOTLIGHT_AGENT_MODEL` | Optional: Mariner's provider (`opencode` or `google`) and model |

## Security

Sign-in is Supabase Auth. The Java service validates the same Supabase JWT and enforces its own
role checks; the web app never calls it with the service-role key. Row-Level Security protects
the core tables, and pages check access level before rendering admin views.
