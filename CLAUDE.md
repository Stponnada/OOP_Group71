# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**Spotlight**, an Intelligent IT Service Management (I-ITSM) system built for the CS F213 OOP course (Group 71). Employees report IT incidents; technicians and service-desk admins triage, assign and resolve them; a Java engine decides priority, assignment, SLA deadlines and escalation. Seed rows describe a hypothetical organisation, **Spotlite Inc**.

| Path | What it is | Its own guide |
|---|---|---|
| `itsm-service/` | Spring Boot 3.4 / Java 17 service, package `com.spotlight.itsm`. Owns the `itsm` schema only. | `itsm-service/CLAUDE.md`, `itsm-service/CONTRACT.md` |
| `spotlight/` | The web app and core database: Next.js 16 app in `website/`, core-table migrations and a local seed in `supabase/`. | `spotlight/CLAUDE.md`, `spotlight/website/AGENTS.md` (Next.js 16 differs from training data) |
| `docs/openapi/itsm-api.yaml` | The REST contract between the two. | — |
| `DEPLOY.md` | Hosting: Java service on Render (Docker, `itsm-service/Dockerfile`), web app on Vercel, the env vars each needs. | — |

Read the sub-project's own guide before changing code in it; this file covers only what spans both.

## How the two halves connect

```
Browser → Next.js (spotlight/website) ──Server Components / Server Actions──► Supabase (core tables, auth)
                     │
                     └─ lib/itsm-api.ts ──Bearer <Supabase access token>──► itsm-service :8081
                                                                              ├─ itsm.*                           (Flyway-owned)
                                                                              ├─ public.employees/roles/departments (read)
                                                                              └─ public.notifications, audit_log  (write)
```

- **All incident reads and writes go through the Java API.** The `/incidents/**` pages never query `itsm.*` from Supabase directly; that is what makes the Java service the real data path rather than decoration.
- `lib/itsm-api.ts` is server-only: it reads the session token via `@/lib/supabase/server` and returns `{ data } | { error, errorCode, status }`, mapping the service's RFC 7807 `ProblemDetail`. An unreachable service yields an error the pages render as an empty state.
- ITSM files on the frontend side: `app/(dashboard)/incidents/**`, `lib/itsm-api.ts`, `lib/itsm-types.ts`, `lib/itsm-roles.ts`, and `lib/agent/capabilities/itsm.ts` (Mariner tools). The pages split by who uses them:
  - **Everyone:** `/incidents` (my incidents), `/incidents/new`, `/incidents/[id]` (one workspace whose buttons come from the incident's `actions`, so the reporter and the desk see the same page with different controls).
  - **Technicians:** `/incidents/queue` (my work and the unassigned pool).
  - **Service-desk admins:** `/incidents/all`, `analytics`, `technicians`, `settings`, `audit`.
- Roles come from the Java service's `GET /api/v1/me` (`lib/itsm-roles.ts`), not from the app access level. Nav items carry `itsmRole` in `lib/nav-items.ts`, the admin pages check it again server-side, and Mariner's desk tools gate on the same `profile.itsm`. The Java side still enforces every rule; the frontend checks only decide what to show.
- The pages and Mariner both read the service URL from `ITSM_API_URL` (default `http://localhost:8081`; not set in the `.env.local*` files).

### Changing the REST contract

`itsm-api.yaml` is frozen. Edit it first, then the Java controllers/DTOs, then `spotlight/website/lib/itsm-types.ts`, which is hand-copied from the YAML, not generated. Nothing will catch drift between them at build time.

### Database boundary

The Supabase migrations in `spotlight/supabase/` and itsm-service's Flyway chain must never overlap. Flyway's history table lives in `itsm`; the Java side never alters `public`. New ITSM tables go in the next Flyway migration (`V4__…` now that `V3__service_desk.sql` exists), never in an edited applied one and never in `spotlight/supabase/migrations/`.

## Running both together

```bash
# 1. Java service (from itsm-service/), serves on :8081
./mvnw spring-boot:run

# 2. Frontend (from spotlight/website/), :3000
bun run dev:remote     # copies .env.local.remote over .env.local, then runs next dev
```

Frontend checks, from `spotlight/website/`: `node node_modules/typescript/bin/tsc --noEmit -p .` (there is no `node_modules/.bin`, and `npx tsc` fetches an unrelated package), `bun run lint`, `bun run test` (node:test files under `scripts/` and `components/`, run by bun), `bun run build`. Java commands and the e2e smoke script are in `itsm-service/CLAUDE.md`.

### The hosted Supabase project

The hosted deployment uses Supabase project `tpbwgfncruggpxujghao`; `spotlight/website/.env.local.remote` (not committed) points at it.

- **DB:** use the session pooler, `jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres` with user `postgres.tpbwgfncruggpxujghao`. The direct host is IPv6-only; the transaction pooler on 6543 breaks Flyway.
- **JWT:** this project signs ES256, so start itsm-service with `SUPABASE_JWKS_URL=https://tpbwgfncruggpxujghao.supabase.co/auth/v1/.well-known/jwks.json`. When it is set, `SecurityConfig` uses it and ignores `SUPABASE_JWT_SECRET`. The HS256 secret path is for local Supabase and for `scripts/e2e-smoke.py`, which mints tokens with a fixed dev secret.
- **Core schema:** the tables in `spotlight/supabase/migrations/` were applied to the hosted project by hand in its SQL editor, so its Supabase migration history doesn't list them. Either order (core tables first or `itsm` first) works.
- The hosted Flyway history has V1 to V3. Never edit an applied migration; add `V4__…`.

## Local machine gotcha

If `next dev` in `spotlight/website` stalls on "Compiling …" with high CPU, delete `spotlight/website/.next` first. A Turbopack dev cache copied from an older checkout stores absolute paths to other project roots; on this Mac it once ran for 10+ minutes and crashed the machine. Don't leave `next dev` running unattended: start it with `scripts/dev-watchdog.sh`, which runs `next dev` on :3000 and stops it past 4.5 GB of memory or 3 hours. The desktop app's preview runner can't read `~/Desktop` (macOS returns "Operation not permitted"), so start the script from a shell and attach the browser pane to http://localhost:3000 (`.claude/launch.json` has that attach entry).
