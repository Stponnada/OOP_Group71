import base64, hashlib, hmac, json, os, time, urllib.request, urllib.error

BASE = os.environ.get("ITSM_BASE_URL", "http://localhost:8081")
SECRET = b"devsecret-devsecret-devsecret-devsecret"

def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

def token(sub: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": sub, "aud": "authenticated", "role": "authenticated",
               "iat": int(time.time()), "exp": int(time.time()) + 3600}
    signing = b64(json.dumps(header).encode()) + "." + b64(json.dumps(payload).encode())
    sig = hmac.new(SECRET, signing.encode(), hashlib.sha256).digest()
    return signing + "." + b64(sig)

ASHA  = token("00000000-0000-0000-0000-00000000a001")
OMAR  = token("00000000-0000-0000-0000-00000000a002")
LEELA = token("00000000-0000-0000-0000-00000000a003")

def call(method, path, tok, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + tok)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

passed = failed = 0
def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1; print("  PASS  " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("  <- " + str(detail) if detail else ""))

print("\n== auth ==")
s, body = call("GET", "/api/v1/catalog/services", "garbage")
check("a bad token is rejected with 401", s == 401, s)

s, body = call("GET", "/api/v1/incidents", token("99999999-9999-9999-9999-999999999999"))
check("an unknown subject is rejected", s == 401, (s, body))

s, services = call("GET", "/api/v1/catalog/services", ASHA)
check("catalog is readable by an ordinary employee", s == 200 and len(services) == 9, (s, len(services) if isinstance(services, list) else services))
payment = next(x for x in services if x["code"] == "PAYMENTS")
s, cats = call("GET", "/api/v1/catalog/categories", ASHA)
application = next(x for x in cats if x["code"] == "APPLICATION")


ASHA_ID  = "00000000-0000-0000-0000-0000000000e1"
OMAR_ID  = "00000000-0000-0000-0000-0000000000e2"
LEELA_ID = "00000000-0000-0000-0000-0000000000e3"

print("\n== roles and service-desk setup ==")
s, me = call("GET", "/api/v1/me", ASHA)
check("an ordinary employee is neither technician nor admin",
      s == 200 and not me["technician"] and not me["serviceDeskAdmin"], (s, me))
s, me = call("GET", "/api/v1/me", LEELA)
check("the Engineering lead is a service-desk admin", s == 200 and me["serviceDeskAdmin"], (s, me))
s, skills = call("GET", "/api/v1/catalog/skills", LEELA)
s, denied = call("PUT", f"/api/v1/technicians/{OMAR_ID}", ASHA, {"maxActiveIncidents": 5})
check("an employee cannot make someone a technician", s == 403, (s, denied))
s, omar = call("PUT", f"/api/v1/technicians/{OMAR_ID}", LEELA, {
    "maxActiveIncidents": 5, "experienceYears": 4,
    "skills": [{"skillId": k["id"], "proficiency": 4} for k in skills],
    "serviceIds": [], "teamLeadId": LEELA_ID,
})
check("an admin adds Omar to the service desk", s == 200 and omar["maxActiveIncidents"] == 5, (s, omar))
check("his team lead is recorded", omar.get("teamLeadName") == "Leela Nair", omar)
s, me = call("GET", "/api/v1/me", OMAR)
check("Omar is now a technician", s == 200 and me["technician"] and not me["serviceDeskAdmin"], (s, me))

print("\n== workflow 1: report -> prioritise -> assign -> notify ==")
s, inc = call("POST", "/api/v1/incidents", ASHA, {
    "title": "Payment application unavailable",
    "description": "Users cannot complete transactions. The checkout page returns a 500 for everyone.",
    "categoryId": application["id"],
    "serviceId": payment["id"],
    "impact": "EXTENSIVE",
    "urgency": "CRITICAL",
    "affectedUsers": 2000,
})
check("incident created (201)", s == 201, (s, inc))
check("reference looks like INC-YYYY-NNNNNN", isinstance(inc, dict) and inc.get("reference", "").startswith("INC-"), inc)
check("priority auto-calculated as P1", inc.get("priority") == "P1", inc.get("priority"))
check("score is the maximum 120", inc.get("priorityAssessment", {}).get("score") == 120.0, inc.get("priorityAssessment"))
check("explanation is human-readable", "Extensive" in inc.get("priorityAssessment", {}).get("explanation", ""), inc.get("priorityAssessment"))
check("SLA window computed", inc.get("sla", {}).get("resolutionDueAt") is not None, inc.get("sla"))
check("auto-assigned to the only technician", inc.get("status") == "ASSIGNED", inc.get("status"))
check("assignee is Omar", inc.get("assignee", {}).get("displayName") == "Omar Sheikh", inc.get("assignee"))
iid = inc["id"]
check("the reporter's view offers cancel, not technician moves",
      "CANCEL" in inc.get("actions", []) and "ACKNOWLEDGE" not in inc.get("actions", []), inc.get("actions"))
s, as_omar = call("GET", "/api/v1/incidents/" + iid, OMAR)
check("the assignee's view offers acknowledge", "ACKNOWLEDGE" in as_omar.get("actions", []), as_omar.get("actions"))

s, notifs = call("GET", "/api/v1/incidents/" + iid, ASHA)
check("the reporter can read their own incident", s == 200, s)
s, other = call("GET", "/api/v1/incidents", OMAR)
check("the technician sees it in their queue", s == 200 and any(i["id"] == iid for i in other["content"]), other)

print("\n== workflow 2: technician works it, SLA tracked, resolved, notified ==")
s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", OMAR, {"to": "ACKNOWLEDGED"})
check("technician acknowledges", s == 200 and inc["status"] == "ACKNOWLEDGED", (s, inc))
check("first response recorded", inc.get("firstResponseAt") is not None, inc.get("firstResponseAt"))
s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", OMAR, {"to": "IN_PROGRESS"})
check("work starts", s == 200 and inc["status"] == "IN_PROGRESS", s)

s, inc = call("POST", f"/api/v1/incidents/{iid}/notes", OMAR,
              {"kind": "INVESTIGATION", "body": "Gateway health check failing; draining the queue."})
check("investigation note added", s == 200, (s, inc))

s, _ = call("POST", f"/api/v1/incidents/{iid}/notes", OMAR,
            {"kind": "INFO_REQUEST", "body": "Which browser were you using when checkout failed?"})
check("the technician asks the reporter for information", s == 200, s)
s, seen = call("GET", "/api/v1/incidents/" + iid, ASHA)
check("the incident shows it is waiting on the reporter", seen.get("awaitingReporter") is True, seen.get("awaitingReporter"))
s, denied = call("POST", f"/api/v1/incidents/{iid}/notes", ASHA, {"kind": "INTERNAL", "body": "sneaky"})
check("a reporter cannot write internal notes", s == 403, (s, denied))
s, _ = call("POST", f"/api/v1/incidents/{iid}/notes", ASHA, {"kind": "INFO_RESPONSE", "body": "Chrome, on the office network."})
check("the reporter answers", s == 200, s)
s, seen = call("GET", "/api/v1/incidents/" + iid, ASHA)
check("no longer waiting once answered", seen.get("awaitingReporter") is False, seen.get("awaitingReporter"))
s, _ = call("POST", f"/api/v1/incidents/{iid}/notes", OMAR, {"kind": "INTERNAL", "body": "Gateway vendor ticket 4471."})
check("the technician adds an internal note", s == 200, s)
s, tl = call("GET", f"/api/v1/incidents/{iid}/timeline", ASHA)
check("the reporter's timeline hides internal notes", not any(e.get("noteKind") == "INTERNAL" for e in tl), tl)
s, tl = call("GET", f"/api/v1/incidents/{iid}/timeline", OMAR)
check("the technician's timeline shows them", any(e.get("noteKind") == "INTERNAL" for e in tl), tl)

s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", OMAR, {"to": "RESOLVED"})
check("resolution without a note is rejected", s == 422, (s, inc))
check("errorCode is stable", inc.get("errorCode") == "VALIDATION_FAILED", inc)

s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", OMAR,
              {"to": "RESOLVED", "resolutionNote": "Restarted the gateway and drained the stuck queue."})
check("resolves with a note", s == 200 and inc["status"] == "RESOLVED", (s, inc))

s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", OMAR, {"to": "VERIFIED"})
check("a technician cannot verify their own fix", s == 403, (s, inc))

s, seen = call("GET", "/api/v1/incidents/" + iid, ASHA)
check("the reporter is offered confirm and still-broken",
      {"VERIFY", "REJECT_RESOLUTION"} <= set(seen.get("actions", [])), seen.get("actions"))
s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", ASHA, {"to": "VERIFIED"})
check("the reporter verifies", s == 200 and inc["status"] == "VERIFIED", (s, inc))

s, inc = call("POST", f"/api/v1/incidents/{iid}/transitions", LEELA, {"to": "CLOSED"})
check("an admin closes", s == 200 and inc["status"] == "CLOSED", (s, inc))

s, fb = call("POST", f"/api/v1/incidents/{iid}/feedback", ASHA, {"rating": 5, "comment": "Fast."})
check("the reporter leaves feedback", s == 200, (s, fb))

print("\n== workflow 3: illegal transitions and intelligence ==")
s, second = call("POST", "/api/v1/incidents", ASHA, {
    "title": "Payment transaction failing at checkout",
    "description": "Checkout returns a 500 and users cannot complete transactions with payment.",
    "categoryId": application["id"],
    "serviceId": payment["id"],
    "impact": "MAJOR", "urgency": "HIGH", "affectedUsers": 30,
})
check("second incident created", s == 201, (s, second))
sid = second["id"]

s, err = call("POST", f"/api/v1/incidents/{sid}/transitions", ASHA, {"to": "CLOSED"})
check("NEW -> CLOSED is refused with 409", s == 409, (s, err))
check("the error names both states",
      isinstance(err, dict) and "ASSIGNED" in err.get("detail", "") or "CLOSED" in str(err.get("detail")), err)
check("errorCode is INVALID_TRANSITION", isinstance(err, dict) and err.get("errorCode") == "INVALID_TRANSITION", err)

s, sug = call("GET", f"/api/v1/incidents/{sid}/suggestions", ASHA)
check("duplicate detection finds the first incident", s == 200 and len(sug.get("duplicates", [])) >= 1, sug)
check("similarity score is shown", sug["duplicates"][0]["similarity"] > 0.3 if sug.get("duplicates") else False, sug)
check("a prior resolution is suggested", len(sug.get("priorResolutions", [])) >= 1, sug)

s, seen = call("GET", "/api/v1/incidents/" + sid, LEELA)
check("the new report was correlated with the first", any(l["incidentId"] == iid for l in seen.get("links", [])), seen.get("links"))
s, similar = call("POST", "/api/v1/incidents/similar", ASHA, {
    "serviceId": payment["id"], "title": "Payment checkout failing", "description": "Checkout returns a 500"})
check("similar reports are found before submitting", s == 200 and len(similar) >= 1, (s, similar))
s, denied = call("POST", f"/api/v1/incidents/{sid}/links", OMAR, {"relatedIncidentId": iid, "relation": "DUPLICATE"})
check("only the service desk confirms duplicates", s == 403, (s, denied))
s, dup = call("POST", f"/api/v1/incidents/{sid}/links", LEELA,
              {"relatedIncidentId": iid, "relation": "DUPLICATE", "cancelAsDuplicate": True})
check("an admin confirms the duplicate and it is cancelled", s == 200 and dup["status"] == "CANCELLED", (s, dup))
check("the cancellation names the original", inc["reference"] in (dup.get("cancellationReason") or ""), dup.get("cancellationReason"))

s, cat = call("POST", "/api/v1/catalog/categorise", ASHA, {"description": "Nobody can log in, password reset is failing"})
check("auto-categorisation suggests authentication", cat.get("categoryName") == "Authentication", cat)
check("confidence is reported", cat.get("confidence", 0) > 0, cat)

print("\n== reporting and access control ==")
s, overview = call("GET", "/api/v1/reports/overview", LEELA)
check("admin reads the overview", s == 200 and overview["totalIncidents"] == 2, (s, overview))
s, denied = call("GET", "/api/v1/reports/overview", ASHA)
check("an employee cannot read analytics", s == 403, (s, denied))
s, workload = call("GET", "/api/v1/reports/workload", LEELA)
check("workload is reported", s == 200 and len(workload) == 1, (s, workload))
s, svc = call("GET", "/api/v1/reports/services", LEELA)
check("service analysis is reported", s == 200 and any(r["incidents"] == 2 for r in svc), svc)
s, audit = call("GET", "/api/v1/audit", LEELA)
check("audit trail has entries", s == 200 and len(audit) >= 8, len(audit) if isinstance(audit, list) else audit)

s, timeline = call("GET", f"/api/v1/incidents/{iid}/timeline", ASHA)
kinds = {e["kind"] for e in timeline} if isinstance(timeline, list) else set()
check("timeline merges transitions, notes and feedback",
      {"TRANSITION", "NOTE", "FEEDBACK"} <= kinds, kinds)

print("\n== the unassigned pool, recommendations and taking work ==")
s, omar = call("PUT", f"/api/v1/technicians/{OMAR_ID}", LEELA, {"isAvailable": False, "teamLeadId": LEELA_ID})
check("an admin marks Omar unavailable", s == 200 and omar["isAvailable"] is False, (s, omar))
s, third = call("POST", "/api/v1/incidents", ASHA, {
    "title": "Laptop cannot reach the VPN", "description": "VPN client times out from home.",
    "categoryId": application["id"], "serviceId": payment["id"],
    "impact": "MINOR", "urgency": "MEDIUM", "affectedUsers": 1})
tid = third["id"]
check("with nobody available it waits unassigned", s == 201 and third["status"] == "CLASSIFIED", (s, third.get("status")))
s, pool = call("GET", "/api/v1/incidents?unassignedOnly=true", LEELA)
check("it appears in the unassigned list", any(i["id"] == tid for i in pool["content"]), pool)
s, recs = call("GET", f"/api/v1/incidents/{tid}/recommendations", LEELA)
check("recommendations rank Omar and explain why he scores zero",
      s == 200 and recs and recs[0]["score"] == 0 and "Marked unavailable" in recs[0]["reasons"], (s, recs))
s, denied = call("GET", f"/api/v1/incidents/{tid}/recommendations", ASHA)
check("employees cannot see recommendations", s == 403, (s, denied))
call("PUT", f"/api/v1/technicians/{OMAR_ID}", LEELA, {"isAvailable": True, "teamLeadId": LEELA_ID})
s, q = call("GET", "/api/v1/queue", OMAR)
check("the technician's queue includes the pool", any(i["id"] == tid for i in q["content"]), q)
s, seen = call("GET", "/api/v1/incidents/" + tid, OMAR)
check("the technician is offered TAKE", "TAKE" in seen.get("actions", []), seen.get("actions"))
s, denied = call("POST", f"/api/v1/incidents/{tid}/assign", ASHA, {"technicianId": ASHA_ID})
check("an employee cannot assign", s in (403, 409), (s, denied))
s, taken = call("POST", f"/api/v1/incidents/{tid}/assign", OMAR, {"technicianId": OMAR_ID})
check("the technician takes it", s == 200 and taken["status"] == "ASSIGNED", (s, taken))

print("\n== service-desk configuration ==")
s, denied = call("POST", "/api/v1/catalog/categories", ASHA, {"name": "Nope"})
check("employees cannot change the catalog", s == 403, (s, denied))
s, newcat = call("POST", "/api/v1/catalog/categories", LEELA, {"name": "Smoke test category"})
check("an admin adds a category", s == 201 and newcat["code"] == "SMOKE-TEST-CATEGORY", (s, newcat))
s, newsvc = call("POST", "/api/v1/catalog/services", LEELA, {
    "name": "Smoke test service", "categoryId": newcat["id"], "businessCriticality": "LOW",
    "requiredSkillIds": [skills[0]["id"]]})
check("an admin adds a service with required skills",
      s == 201 and newsvc["requiredSkillIds"] == [skills[0]["id"]], (s, newsvc))
s, newsvc = call("PUT", f"/api/v1/catalog/services/{newsvc['id']}", LEELA, {
    "name": "Smoke test service", "categoryId": newcat["id"], "businessCriticality": "LOW", "isActive": False})
check("and retires it", s == 200 and newsvc["isActive"] is False, (s, newsvc))
s, visible = call("GET", "/api/v1/catalog/services", ASHA)
check("retired services leave the report form", all(x["id"] != newsvc["id"] for x in visible), len(visible))
s, everything = call("GET", "/api/v1/catalog/services?includeInactive=true", LEELA)
check("admins still see them", any(x["id"] == newsvc["id"] for x in everything), len(everything))

s, profiles = call("GET", "/api/v1/sla/profiles", LEELA)
std = next(p for p in profiles if p["code"] == "STANDARD")
s, bad = call("PUT", f"/api/v1/sla/profiles/{std['id']}", LEELA,
              {"targets": [{"priority": "P4", "responseMinutes": 600, "resolutionMinutes": 60}]})
check("an SLA target that resolves before it responds is refused", s == 422, (s, bad))
p4 = next(t for t in std["targets"] if t["priority"] == "P4")
s, upd = call("PUT", f"/api/v1/sla/profiles/{std['id']}", LEELA, {"targets": [
    {"priority": "P4", "responseMinutes": p4["responseMinutes"], "resolutionMinutes": p4["resolutionMinutes"],
     "warningPercent": 80}]})
check("an admin tunes an SLA target", s == 200 and any(t["priority"] == "P4" and t["warningPercent"] == 80 for t in upd["targets"]), (s, upd))

s, settings = call("GET", "/api/v1/settings/assignment", LEELA)
original = settings["defaultStrategyKey"]
s, bad = call("PUT", "/api/v1/settings/assignment", LEELA, {"defaultStrategyKey": "coin-toss"})
check("an unknown strategy is refused", s == 422, (s, bad))
s, changed = call("PUT", "/api/v1/settings/assignment", LEELA, {"defaultStrategyKey": "skill-based"})
check("an admin switches the assignment strategy", s == 200 and changed["defaultStrategyKey"] == "skill-based", (s, changed))
call("PUT", "/api/v1/settings/assignment", LEELA, {"defaultStrategyKey": original})

print("\n== analytics ==")
s, trend = call("GET", "/api/v1/reports/trend?days=7", LEELA)
check("a 7-day trend with every day present", s == 200 and len(trend) == 7, (s, trend))
check("today's reports are counted", sum(p["created"] for p in trend) == 3, trend)
s, cats = call("GET", "/api/v1/reports/categories", LEELA)
check("incidents by category", s == 200 and any(c["incidents"] >= 3 for c in cats), (s, cats))
s, esc = call("GET", "/api/v1/reports/escalations", LEELA)
check("escalations are listed", s == 200 and isinstance(esc, list), (s, esc))
s, audit = call("GET", "/api/v1/audit", LEELA)
check("configuration changes are in the audit trail",
      any((a.get("subject") or "").startswith("Category: Smoke test") for a in audit), [a.get("subject") for a in audit[:10]])
check("incident rows carry their reference",
      any(a.get("incidentReference") == inc["reference"] for a in audit), [a.get("incidentReference") for a in audit[:10]])

print("\n== assignment never hands people their own reports ==")
# Runs after analytics, which counts today's reports. Omar is the only technician here.
s, own = call("POST", "/api/v1/incidents", OMAR, {
    "title": "My own laptop will not boot", "description": "Black screen after the update.",
    "serviceId": payment["id"], "categoryId": application["id"], "impact": "MINIMAL", "urgency": "LOW"})
check("a technician's own report is not auto-assigned to them",
      s == 201 and (own.get("assignee") or {}).get("employeeId") != OMAR_ID, (s, own.get("assignee") if isinstance(own, dict) else own))
s, recs = call("GET", f"/api/v1/incidents/{own['id']}/recommendations", LEELA)
check("nor recommended for it", s == 200 and all(r["employeeId"] != OMAR_ID for r in recs), (s, recs))
s, listed = call("GET", "/api/v1/incidents?q=" + own["reference"], LEELA)
row = next((x for x in (listed or {}).get("content", []) if x["id"] == own["id"]), {})
check("before anyone responds, the list's deadline is the response deadline",
      row.get("dueAt") is not None and row.get("dueAt") == own["sla"]["responseDueAt"], (row.get("dueAt"), own.get("sla")))

print(f"\n{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
