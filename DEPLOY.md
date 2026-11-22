# Deploying Spotlight

Spotlight runs in three places:

| Part | Where | What it is |
|---|---|---|
| Database and sign-in | Supabase (project `tpbwgfncruggpxujghao`) | Already set up |
| Java service (`itsm-service/`) | Render, free web service | Docker container |
| Web app (`spotlight/website/`) | Vercel | Next.js |

Deploy the Java service first: the web app needs its address.

## 1. Java service on Render

1. Sign in at render.com with GitHub and choose **New → Web Service**.
2. Pick the `OOP_Group71` repository, branch `main`.
3. Settings:
   - **Root Directory:** `itsm-service`
   - **Language / Runtime:** Docker (Render finds `itsm-service/Dockerfile`)
   - **Instance type:** Free
   - **Health Check Path** (under Advanced): `/actuator/health`
4. Environment variables:

   | Key | Value |
   |---|---|
   | `ITSM_DB_URL` | `jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres` |
   | `ITSM_DB_USER` | `postgres.tpbwgfncruggpxujghao` |
   | `ITSM_DB_PASSWORD` | the database password (Supabase → Project Settings → Database) |
   | `SUPABASE_JWKS_URL` | `https://tpbwgfncruggpxujghao.supabase.co/auth/v1/.well-known/jwks.json` |
   | `ITSM_RESEND_APIKEY` | optional: a Resend API key, for email. Without it, notifications are in-app only |

   Use the **session pooler on port 5432**. The transaction pooler on 6543 breaks Flyway, and the direct host is IPv6-only.

5. **Create Web Service.** The first build takes a few minutes; it runs the 74 unit tests and fails if any fail. When it is live, open `https://<name>.onrender.com/actuator/health`: it should say `{"status":"UP"}`. Flyway finds V1 to V3 already applied and changes nothing.

### Keeping it awake

The free plan sleeps after about 15 minutes without traffic. Waking takes up to a minute, and while asleep the SLA monitor does not run, so no warnings or escalations fire.

Create a free monitor at cron-job.org or UptimeRobot that calls `https://<name>.onrender.com/actuator/health` every 10 minutes. One service running all month fits inside the free hours.

## 2. Web app on Vercel

1. **New Project** → import `OOP_Group71`.
2. **Root Directory:** `spotlight/website`. **Framework preset:** Next.js. Leave the build settings as they are.
3. Environment variables: **Import .env** and choose `spotlight/website/.env.local.remote` on your machine (press Cmd+Shift+. in the file picker to see dotfiles). It holds the Supabase URL and keys and the Mariner model settings. Then add one more:

   | Key | Value |
   |---|---|
   | `ITSM_API_URL` | `https://<name>.onrender.com` (no trailing slash) |

4. **Deploy.**

## 3. Supabase sign-in links

In Supabase → Authentication → URL Configuration, set **Site URL** to the Vercel address (`https://<project>.vercel.app`) and add it under **Redirect URLs**. Otherwise password-reset and invite emails link to localhost.

## Checking it works

1. Sign in on the Vercel site. The sidebar shows Service Desk items only for technicians and admins.
2. Open **Incidents → Report an incident**. If the page says the service is unavailable, check `ITSM_API_URL` on Vercel and that the Render service is awake.
3. Report one; it should get a reference like `INC-2026-000002` and a priority.

## If something goes wrong

| Symptom | Likely cause |
|---|---|
| Render build fails at `mvn package` | A unit test failed; the log names it |
| Render deploy crashes on start with a Flyway or connection error | Wrong `ITSM_DB_*` value, or the 6543 pooler |
| Every API call returns 401 | `SUPABASE_JWKS_URL` missing or misspelled |
| Incident pages say unavailable | `ITSM_API_URL` wrong, or the service is asleep |
| Out-of-memory restarts on Render | Lower `-Xmx` in `JAVA_OPTS` (Render env var overrides the Dockerfile) |
