/* Core: router, layout, persona ("View as"), permissions, automation engine, shared helpers.
 * Screens live in assets/screens/*.js and register App.screens[name] = (params) => html,
 * with optional App.after[name] = (params) => void for event wiring. */
window.App = (function () {
  // One "today" for the whole prototype (mock data is written around it).
  const TODAY = "2026-11-09";
  const screens = {};
  const after = {};

  const routes = [
    ["/home", "home"],
    ["/tour", "tour"],
    ["/knowledge", "knowledge"],
    ["/wiki/:wid", "wiki"],
    ["/p/:pid", "dashboard"],
    ["/p/:pid/items", "items"],
    ["/p/:pid/new", "newItem"],
    ["/p/:pid/item/:iid", "thread"],
    ["/p/:pid/item/:iid/compare", "compare"],
    ["/p/:pid/item/:iid/amend", "amend"],
    ["/p/:pid/item/:iid/prd", "prd"],
    ["/p/:pid/item/:iid/solution", "solution"],
    ["/p/:pid/item/:iid/archive", "archive"],
    ["/p/:pid/archives", "archives"],
    ["/p/:pid/archive/new", "newArchive"],
    ["/p/:pid/sprints", "sprints"],
    ["/feedback", "feedbackPage"],
    ["/admin/feedback", "feedbackAdmin"],
    ["/p/:pid/board", "board"],
    ["/p/:pid/releases", "releases"],
    ["/p/:pid/knowledge", "knowledge"],
    ["/p/:pid/incidents", "incidents"],
    ["/p/:pid/incident/:incid", "incident"],
    ["/p/:pid/requests", "requests"],
    ["/p/:pid/requests/new", "newRequest"],
    ["/p/:pid/request/:rid", "request"],
    ["/admin/lenses", "lensManager"],
    ["/admin/customers", "customers"],
    ["/admin/request-forms", "requestForms"],
    ["/admin/:tab", "backoffice"],
    ["/projects/new", "newProject"],
    ["/p/:pid/settings", "projectSettings"],
    ["/p/:pid/settings/:tab", "projectSettings"],
    ["/files", "files"],
    ["/files/new", "newResource"],
    ["/files/:rid", "resource"],
    ["/p/:pid/files", "files"],
  ];

  const state = { projectId: "p-payflow", personaId: "u2", onlyChanges: false };

  // ---------- persistence: one shared state across pages & reloads (localStorage), with reset ----------
  // Bump DATA_VERSION whenever data.js changes so viewers get the new seed instead of stale saved data.
  const DATA_VERSION = "2026-11-09.1", KEY = "delta-pmt-prototype";
  const SEED = JSON.stringify(DB);
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.v === DATA_VERSION) { Object.assign(DB, saved.db); Object.assign(state, saved.state); }
    } catch (e) { /* storage unavailable — run in memory */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: DATA_VERSION, db: DB, state })); } catch (e) { /* ignore */ } }
  function resetData() {
    if (!confirm("Reset all demo data to the original example? Everything you changed in this browser is discarded.")) return;
    Object.keys(DB).forEach((k) => delete DB[k]); Object.assign(DB, JSON.parse(SEED));
    Object.assign(state, { projectId: "p-payflow", personaId: "u2", onlyChanges: false });
    save(); toast("Demo data reset"); location.hash = "/tour"; render();
  }

  // ---------- data helpers ----------
  const find = (coll, id) => DB[coll].find((x) => x.id === id);
  const where = (coll, fn) => DB[coll].filter(fn);
  const user = (id) => find("users", id);
  const project = (id) => find("projects", id);
  const itemType = (id) => find("itemTypes", id);
  const stage = (id) => find("stages", id);
  const role = (id) => find("roles", id);
  const persona = () => user(state.personaId);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const daysSince = (d) => Math.round((new Date(TODAY) - new Date(d)) / 86400000);

  // ---------- permissions: ∪ role perms − employment deny ----------
  function permsOf(u) {
    const set = new Set(u.roleIds.flatMap((r) => role(r).perms));
    find("employmentTypes", u.employment).deny.forEach((p) => set.delete(p));
    return set;
  }
  const can = (perm, u = persona()) => permsOf(u).has(perm);
  function whyNot(perm, u = persona()) {
    const viaRole = u.roleIds.some((r) => role(r).perms.includes(perm));
    const label = DB.permissions.find((p) => p.key === perm)?.label || perm;
    return viaRole ? `${label}: restricted for ${find("employmentTypes", u.employment).name}` : `${label}: not granted to ${u.roleIds.map((r) => role(r).name).join(", ")}`;
  }
  // Button that renders disabled (with reason) when the persona lacks the permission.
  function btn(perm, label, onclick, cls = "") {
    if (perm && !can(perm)) return `<button class="btn ${cls}" disabled title="${esc(whyNot(perm))}">🔒 ${label}</button>`;
    return `<button class="btn ${cls}" onclick="${onclick}">${label}</button>`;
  }
  const primaryRole = (u = persona()) => u.roleIds.find((r) => r !== "admin") || u.roleIds[0];

  // ---------- item helpers ----------
  const stagesOf = (item) => itemType(item.typeId).stages;
  const stageIndex = (item) => stagesOf(item).indexOf(item.stage);
  const progress = (item) => (stageIndex(item) + 1) / stagesOf(item).length;
  const conformance = (item) => {
    const a = item.acceptance;
    return a.length ? { met: a.filter((x) => x.status === "met").length, total: a.length } : null;
  };
  // Stages already passed but with no record = knowledge gap.
  const gaps = (item) => stagesOf(item).slice(0, stageIndex(item)).filter((s) => !item.log[s]);

  // Gate evaluation for the item's current stage (deterministic, explainable).
  function gate(item) {
    const s = item.stage, rec = item.log[s] || {};
    if (s === "requirement") {
      // PRD is internal data (ADR-018): must exist and be published; open comments are a warning only.
      // Publishing requires review approval (all, or ≥1 with "force"), so a published version = approved PRD.
      const prd = DB.prds.find((p) => p.itemId === item.id);
      if (!prd) return { ok: false, reason: "No PRD written yet" };
      const lv = prd.versions[prd.versions.length - 1];
      if (!lv) { const rs = prd.review?.reviewers || []; return { ok: false, reason: rs.length ? `PRD in review — ${rs.filter((r) => r.decision === "approved").length}/${rs.length} approved, not published yet` : "PRD is a draft — request review, then publish" }; }
      return { ok: true, reason: `PRD v${lv.v} published${lv.forced ? " (force-published)" : ""}` };
    }
    if (s === "qa") {
      const bad = item.tests.filter((t) => t.critical && t.status !== "pass");
      const open = where("tasks", (t) => t.itemId === item.id && t.kind === "qa_finding" && t.status !== "done");
      if (bad.length) return { ok: false, reason: `${bad.length} critical test(s) without PASS: ${bad.map((t) => `${t.id} ${t.status.toUpperCase().replace("_", " ")}`).join(", ")}` };
      if (open.length) return { ok: false, reason: `${open.length} open QA finding(s)` };
      return { ok: true, reason: "All critical tests PASS" };
    }
    if (s === "development") {
      const open = where("tasks", (t) => t.itemId === item.id && t.kind === "dev" && t.status !== "done");
      return open.length ? { ok: false, reason: `${open.length} dev task(s) not done` } : { ok: true, reason: "All dev tasks done" };
    }
    if (s === "solution") {
      // Structured solution card (ADR-022): every AC mapped, Lead Dev approved, + Eng Lead when data/API changes.
      const sol = DB.solutions.find((x) => x.itemId === item.id);
      if (!sol) return rec.approvals?.length ? { ok: true, reason: "Approved" } : { ok: false, reason: "No solution card yet" };
      const unmapped = item.acceptance.filter((a) => !(sol.acMap[a.id] || "").trim()).map((a) => a.id);
      if (unmapped.length) return { ok: false, reason: `AC without solution: ${unmapped.join(", ")}` };
      const need = solutionApprovers(item, sol), missing = need.filter((r) => !sol.reviewers.some((v) => v.decision === "approved" && user(v.userId).roleIds.includes(r)));
      return missing.length ? { ok: false, reason: `Waiting approval: ${missing.map((r) => role(r).name).join(" + ")}` } : { ok: true, reason: "Solution approved" };
    }
    return { ok: true, reason: stage(s).gate };
  }

  // ---------- solution, planning & archive (ADR-021, ADR-022) ----------
  const solutionApprovers = (item, sol) => ["lead_dev", ...((sol.dataApi || "").trim() ? ["eng_lead"] : [])];
  const quarterOf = (date) => `${date.slice(0, 4)}-Q${Math.floor((+date.slice(5, 7) - 1) / 3) + 1}`;
  const sprintRows = (iid) => DB.itemSprints.filter((r) => r.itemId === iid).map((r) => ({ ...r, sprint: find("sprints", r.sprintId) })).sort((a, b) => a.sprint.start.localeCompare(b.sprint.start));
  function planOf(iid) {
    const rows = sprintRows(iid), cur = rows[rows.length - 1];
    return cur ? { sprint: cur.sprint, quarter: quarterOf(cur.sprint.start), outcome: cur.outcome, carried: rows.filter((r) => r.outcome === "carried_over").length, rows } : null;
  }
  const planBadge = (iid) => { const pl = planOf(iid); return pl ? `${badge(pl.quarter)} ${badge(pl.sprint.name, pl.sprint.state === "active" ? "ai" : "")}${pl.carried ? " " + badge(`carried over ×${pl.carried}`, "blocked") : ""}` : badge("unplanned", "gap"); };

  const archivesOf = (iid) => DB.archives.filter((a) => !a.deleted && a.itemIds.includes(iid));
  const ARCHIVE_KIND = { meeting_ai: "🤖 Meeting summary (AI)", meeting_manual: "📝 Meeting notes", slack: "💬 Slack thread", dev_discussion: "🛠 Dev discussion" };
  const cite = (a, n) => `${a.id} · ${esc(ARCHIVE_KIND[a.kind])} “${esc(a.title)}” by ${esc(user(a.by).name)}, ${a.date} · line ${n}${a.sourceUrl ? ` · <a href="${esc(a.sourceUrl)}" target="_blank">source ↗</a>` : ""}`;
  function searchArchives(q, pid) {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    return DB.archives.filter((a) => !a.deleted && (!pid || a.projectId === pid)).flatMap((a) => a.content.split("\n").map((t, i) => ({ a, n: i + 1, t }))
      .filter((l) => words.length && words.every((w) => l.t.toLowerCase().includes(w))));
  }
  // Crosscheck (AI) — reads archive text + context notes, picks the statements that matter, compares them with PRD + solution.
  // Prototype: sentence heuristics, keyword & number matching. Production: LLM with the same output shape (statement, status, citation, suggestion).
  const STOP = new Set(["with", "that", "this", "from", "only", "when", "every", "each", "within", "maximum", "allowed", "about", "should", "must", "agreed", "decided", "still", "open", "rejected", "whether", "could"]);
  const NUM = /(\d+)(?:\s*[–-]\s*(\d+))?\s*(month|day|week|hour)s?/i;
  const KIND_RE = [["open", /\?\s*$|^(still )?open\b|asked whether/i], ["rejected", /reject/i], ["decision", /\b(agreed|decided|we will|we decided)\b/i], ["requirement", /\b(must|only|maximum|minimum|need|allowed)\b/i]];
  function statementKind(t) { const k = KIND_RE.find(([, re]) => re.test(t)); return k ? k[0] : null; }
  function docText(item) {
    const prd = DB.prds.find((p) => p.itemId === item.id), sol = DB.solutions.find((x) => x.itemId === item.id);
    const prdHtml = prd ? (prd.draftHtml ?? prd.versions[prd.versions.length - 1]?.html ?? "") : "";
    const solText = sol ? [sol.approach, sol.touched, sol.dataApi, sol.decisions, sol.rejected, sol.risks, sol.flag, ...Object.values(sol.acMap)].join(" ") : "";
    return { prd, sol, prdHtml, text: (prdHtml.replace(/<[^>]+>/g, " ") + " " + solText + " " + item.acceptance.map((a) => a.text).join(" ")).toLowerCase() };
  }
  function crosscheck(item) {
    const { text: target } = docText(item);
    const stem = (w) => w.slice(0, 5);
    const tstems = new Set(target.split(/[^a-z0-9]+/).map(stem));
    return archivesOf(item.id).flatMap((a) => {
      const ignore = (a.contexts || []).filter((c) => c.kind === "ignore").flatMap((c) => (c.terms || []).map((x) => ({ term: x.toLowerCase(), note: c })));
      return a.content.split("\n").map((t, i) => ({ a, n: i + 1, t: t.trim() })).filter((l) => l.n > 1 && l.t.length > 15 && !/^(attendees|action|summary|context)\b/i.test(l.t)).map((l) => {
        const kind = statementKind(l.t);
        if (!kind) return null;
        const ig = ignore.find((x) => l.t.toLowerCase().includes(x.term));
        if (ig) return { ...l, kind, text: l.t, status: "ignored", detail: `Ignored per context note (${ig.note.by === "ai" ? "AI" : user(ig.note.by).name}): ${ig.note.text}` };
        const m = l.t.match(NUM);
        if (m) {
          const unit = m[3].toLowerCase(), t2 = target.match(new RegExp(`(\\d+)(?:\\s*[–-]\\s*(\\d+))?\\s*${unit}s?`));
          if (t2 && +(t2[2] || t2[1]) !== +(m[2] || m[1])) return { ...l, kind, text: l.t, status: "conflict", found: t2[0], said: m[0], detail: `Discussion says “${m[0]}”, document says “${t2[0]}”` };
          if (!t2) return { ...l, kind, text: l.t, status: kind === "open" ? "open" : "missing", detail: `“${m[0]}” is not in the PRD / solution` };
        }
        const kws = l.t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
        const hit = kws.filter((w) => tstems.has(stem(w))).length / (kws.length || 1);
        const status = hit >= 0.6 ? "covered" : kind === "open" ? "open" : "missing";
        return { ...l, kind, text: l.t, status, detail: status === "covered" ? "Reflected in PRD / solution" : status === "open" ? "Open question — not answered in PRD / solution" : "Not in PRD / solution" };
      }).filter(Boolean);
    });
  }
  // AI suggestion per finding (prototype: templated). target: "prd" | "solution".
  function suggestFix(item, r, target) {
    if (r.status === "conflict") return { target: "prd", op: "replace", find: r.found, text: r.said, label: `Replace “${r.found}” with “${r.said}” in the PRD` };
    const clean = r.text.replace(/^(rina|budi|andi|hendra|yoga):\s*/i, "").replace(/^(we agreed to|we decided to|we agreed|we decided)\s*/i, "").replace(/^(still )?open:\s*/i, "");
    const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (r.status === "open") return target === "solution" ? { target: "solution", op: "append", field: "risks", text: `Open: ${cap}`, label: "Add to Solution → Risks as an open question" }
      : { target: "prd", op: "section", section: "Open questions", text: cap, label: "Add to PRD → Open questions" };
    if (target === "solution" || r.kind === "decision" || r.kind === "rejected") return { target: "solution", op: "append", field: r.kind === "rejected" ? "rejected" : "decisions", text: cap, label: `Add to Solution → ${r.kind === "rejected" ? "Rejected alternatives" : "Decision"}` };
    return { target: "prd", op: "section", section: "From discussions", text: cap, label: "Add to PRD → From discussions" };
  }

  // ---------- automation engine ----------
  // Simulates a GitHub/Delta event and applies enabled rules. Returns log lines.
  function fireEvent(event, task) {
    const lines = [];
    for (const r of DB.automationRules) {
      if (!r.enabled || r.match.event !== event) continue;
      const from = [].concat(r.match.from);
      if (r.match.kind && r.match.kind !== task.kind) continue;
      if (!from.includes(task.status)) continue;
      const fromName = find("taskStatuses", task.status).name;
      task.status = r.to;
      if (r.to === "fixing" && task.pr) task.assigneeId = task.pr.authorId || task.assigneeId;
      const notify = r.notify === "reporter" && task.reporterId ? `; notified ${user(task.reporterId).name}` : r.notify === "assignee" ? `; notified ${user(task.assigneeId).name}` : "";
      const line = `${task.pr?.ref || task.issue || task.id} ${event.replace("_", " ")} → ${task.id} moved ${fromName} → ${find("taskStatuses", r.to).name}${notify}`;
      DB.automationLog.unshift({ at: "just now", ruleId: r.id, taskId: task.id, text: line });
      lines.push(`${r.id}: ${line}`);
      break; // first matching rule wins
    }
    return lines;
  }

  // ---------- resources (ADR-009) ----------
  // Metadata is always visible; content needs internal grant AND external provider access.
  function resourceAccess(r, u = persona()) {
    const granted = r.ownerId === u.id || (r.grants || []).some((g) => g.userId === u.id || u.roleIds.includes(g.roleId));
    const inherited = r.access === "inherit" && inheritedAccess(r, u);
    const internal = r.access === "anyone_in_app" || granted || inherited;
    const external = !(r.externalDenied || []).includes(u.id) && r.health !== "broken";
    const reason = !internal ? (r.access === "inherit" ? `Only members of ${project(r.projectId).name}${project(r.projectId).relatedProjectIds.length ? " or related projects" : ""} — request access` : `Restricted by ${user(r.ownerId).name} — request access`) : !external ? (r.health === "broken" ? "Link is broken at the source" : `${find("resourceProviders", r.provider).name} denies your account`) : "";
    return { internal, external, ok: internal && external, reason };
  }
  // Inherited access: project members + members of projects registered as related by that project.
  function inheritedAccess(r, u) {
    const p = r.projectId && project(r.projectId);
    if (!p || p.visibility === "internal") return true;
    return [p.id, ...p.relatedProjectIds].some((pid) => project(pid).memberIds.includes(u.id));
  }
  function accessLabel(r) {
    if (r.access === "anyone_in_app") return "🌐 Anyone in app (override)";
    if (r.access === "restricted") return "🔒 Restricted (override)";
    const p = r.projectId && project(r.projectId);
    return p ? `↳ Inherit from ${esc(p.name)} (${p.visibility}${p.relatedProjectIds.length ? " + related: " + p.relatedProjectIds.map((x) => esc(project(x).name)).join(", ") : ""})` : "↳ Inherit (company-wide)";
  }
  const linksOf = (rid) => DB.resourceLinks.filter((l) => l.resourceId === rid);
  function isKnowledgeArea(targetType, targetId) {
    return DB.knowledgeAreas.some((a) => a.targetType === targetType && (!a.stages || a.stages.includes(String(targetId).split("/")[1])));
  }
  const fileType = (id) => find("fileTypes", id);
  const companionOf = (rid) => DB.resources.find((x) => x.companionOf === rid);
  // ready | needs_ai_version | not_knowledge | undecided
  function knowledgeStatus(r) {
    if (r.companionOf) return "ready";
    const inArea = linksOf(r.id).some((l) => isKnowledgeArea(l.targetType, l.targetId));
    const isKS = inArea || r.knowledgeSource === true;
    if (!isKS) return r.knowledgeSource === false ? "not_knowledge" : "undecided";
    return fileType(r.fileType).aiReadable || companionOf(r.id) ? "ready" : "needs_ai_version";
  }
  const KS_LABEL = { ready: ["AI-ready", "pass"], needs_ai_version: ["needs AI-readable version", "fail"], not_knowledge: ["not knowledge", ""], undecided: ["knowledge? not decided", "blocked"] };
  const ksBadge = (r) => badge(...KS_LABEL[knowledgeStatus(r)]);
  const KIND_ICON = { uploaded: "📎", external_file: "☁", web_link: "🔗" };
  const resLink = (r) => `<a href="#/files/${r.id}">${KIND_ICON[r.kind]} ${esc(r.title)}</a>${resourceAccess(r).ok ? "" : " 🔒"}`;
  // Attachments widget for any target (item, item_stage, task, incident, wiki_page …).
  function attachments(targetType, targetId, { compact } = {}) {
    const ls = DB.resourceLinks.filter((l) => l.targetType === targetType && l.targetId === targetId);
    const add = `<a class="small" href="#/files/new?tt=${targetType}&tid=${encodeURIComponent(targetId)}">+ attach</a>`;
    if (!ls.length) return compact ? `<div class="small mt-s">${add}</div>` : `<div class="small muted">No files. ${add}</div>`;
    return `<div class="small mt-s">${ls.map((l) => { const r = find("resources", l.resourceId); return `<div>${resLink(r)} ${badge(l.relation)} ${knowledgeStatus(r) === "needs_ai_version" ? badge("needs AI version", "fail") : ""}</div>`; }).join("")}${add}</div>`;
  }
  function targetLabel(l) {
    if (l.targetType === "item_stage") { const [iid, s] = l.targetId.split("/"); return `${itemLink(iid)} · ${stage(s).name}`; }
    if (l.targetType === "item") return itemLink(l.targetId);
    if (l.targetType === "request") return requestLink(l.targetId);
    if (l.targetType === "task") { const t = find("tasks", l.targetId); return `task ${esc(t.title)} (${itemLink(t.itemId)})`; }
    return ref(l.targetId);
  }

  // ---------- requests (ADR-017) ----------
  const itemsOfRequest = (rid) => DB.requestItemLinks.filter((l) => l.requestId === rid).map((l) => find("items", l.itemId)).filter(Boolean);
  const requestsOfItem = (iid) => DB.requestItemLinks.filter((l) => l.itemId === iid).map((l) => find("requests", l.requestId)).filter(Boolean);
  // Stored status for triage; once items are linked the status is derived: done when every linked item is released.
  function requestStatus(r) {
    const its = itemsOfRequest(r.id);
    if (r.status === "declined" || !its.length) return { key: r.status, label: { new: "New", needs_info: "Needs info", accepted: "Accepted — no item yet", declined: "Declined" }[r.status], done: 0, total: 0 };
    const done = its.filter((it) => isReleased(it) || (!stagesOf(it).includes("release") && it.stage === stagesOf(it).slice(-1)[0])).length;
    return done === its.length ? { key: "done", label: "Done", done, total: its.length } : { key: "in_progress", label: `In progress · ${done}/${its.length} items released`, done, total: its.length };
  }
  const REQ_CLS = { new: "ai", needs_info: "blocked", accepted: "", declined: "skipped", in_progress: "medium", done: "pass" };
  const requestBadge = (r) => { const st = requestStatus(r); return badge(st.label, REQ_CLS[st.key]); };
  const requestLink = (rid) => { const r = find("requests", rid); return r ? `<a href="#/p/${r.projectId}/request/${r.id}">📥 ${r.id}</a>` : esc(rid); };
  const openRequests = (pid) => DB.requests.filter((r) => r.projectId === pid && ["new", "needs_info"].includes(r.status)).length;
  // Demand signal for an item: who asked, how urgent, what is at stake.
  function demandOf(iid) {
    const rs = requestsOfItem(iid), cs = [...new Set(rs.map((r) => r.customerId).filter(Boolean))];
    const rank = ["Critical", "High", "Medium", "Low", "Unknown"];
    return { requests: rs, customers: cs.map((c) => find("customers", c)), churn: rs.filter((r) => r.impact === "Existing-client churn risk").length,
      blockers: rs.filter((r) => r.impact === "New business deal blocker").length, topUrgency: rs.map((r) => r.urgency).sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0] };
  }

  // ---------- release gate (ADR-013) & flags (ADR-014) ----------
  // A release is held while it contains an item rewound by an amendment (Mode B) that hasn't re-passed QA.
  function releaseGate(rel) {
    const p = project(rel.projectId);
    const reasons = rel.itemIds.map((id) => find("items", id)).filter((it) => it && it.rev > 1 && stagesOf(it).indexOf(it.stage) <= stagesOf(it).indexOf("qa")).map((it) => {
      const am = DB.amendments.filter((a) => a.itemId === rootId(it) && a.mode === "revision").pop();
      return { it, text: `${it.id} rewound to ${stage(am?.rewindTo || "requirement").name} by ${am ? user(am.by).name : "?"} (rev ${it.rev}) — now at ${stage(it.stage).name}` };
    });
    return { blocked: reasons.length > 0 && !rel.override, overridden: !!rel.override && reasons.length > 0, reasons, failMode: p.releaseConfig.failMode, prodBranch: p.releaseConfig.productionBranch };
  }
  const flagBadge = (f) => `${badge("🚩 " + f.key + " " + f.state.toUpperCase() + (f.state === "partial" ? ` ${f.rollout}%` : ""), f.state === "on" ? "pass" : f.state === "partial" ? "blocked" : "")}`;
  // ---------- item code format (per project) ----------
  // Tokens: {KEY} {TYPE} {PRIORITY} {YYYY} {YY} {MM} {FIELD:name} {SEQ} {SEQ:n}
  // seqScope decides when the counter restarts: project | type | year | type_year | month.
  const CODE_TOKENS = [
    ["{KEY}", "Project key"], ["{TYPE}", "Item type code (FT, BUG…)"], ["{PRIORITY}", "Priority (U/H/M/L)"],
    ["{YYYY}", "Year, 4 digits"], ["{YY}", "Year, 2 digits"], ["{MM}", "Month"], ["{FIELD:module}", "Custom field code"], ["{SEQ}", "Sequence"], ["{SEQ:4}", "Sequence, zero-padded"],
  ];
  const SEQ_SCOPES = { project: "Never resets (whole project)", type: "Per item type", year: "Per year", type_year: "Per type, per year", month: "Per month" };
  function codeAttrs(p, a) {
    const d = a.date || TODAY;
    return { KEY: p.key, TYPE: itemType(a.typeId).code, PRIORITY: (a.priority || "medium")[0].toUpperCase(), YYYY: d.slice(0, 4), YY: d.slice(2, 4), MM: d.slice(5, 7), fields: a.fields || {} };
  }
  function scopeKey(scope, at) { return { project: "_", type: at.TYPE, year: at.YY, type_year: at.TYPE + at.YY, month: at.YY + at.MM }[scope] || "_"; }
  function renderCode(p, tpl, at, seq) {
    return tpl.replace(/\{(\w+)(?::([\w-]+))?\}/g, (m, tok, arg) => {
      if (tok === "SEQ") return arg ? String(seq).padStart(+arg, "0") : String(seq);
      if (tok === "FIELD") { const f = p.itemFields.find((x) => x.key === arg); const v = at.fields[arg]; return f ? (f.options.find((o) => o.value === v)?.code || "???") : "?"; }
      return at[tok] ?? m;
    });
  }
  // Validation: unknown tokens, missing {SEQ}, and scope/template mismatches that would create duplicate codes.
  function validateFormat(p, tpl, scope) {
    const errs = [], warns = [];
    const toks = [...tpl.matchAll(/\{(\w+)(?::([\w-]+))?\}/g)];
    toks.forEach(([m, t, arg]) => {
      if (!["KEY", "TYPE", "PRIORITY", "YYYY", "YY", "MM", "FIELD", "SEQ"].includes(t)) errs.push(`Unknown token ${m}`);
      if (t === "FIELD" && !p.itemFields.some((f) => f.key === arg)) errs.push(`${m}: project has no custom field “${arg}”`);
    });
    if (!toks.some(([, t]) => t === "SEQ")) errs.push("Template must contain {SEQ} so codes stay unique");
    if (/[^A-Za-z0-9{}:\-_.\/]/.test(tpl.replace(/\{[^}]*\}/g, ""))) errs.push("Only letters, digits and - _ . / are allowed outside tokens");
    const has = (t) => toks.some(([, x]) => x === t);
    if (["type", "type_year"].includes(scope) && !has("TYPE")) errs.push("Sequence resets per type but {TYPE} is not in the template → duplicate codes");
    if (["year", "type_year"].includes(scope) && !has("YY") && !has("YYYY")) errs.push("Sequence resets per year but no {YY}/{YYYY} in the template → duplicate codes");
    if (scope === "month" && !has("MM")) errs.push("Sequence resets per month but {MM} is not in the template → duplicate codes");
    if (has("PRIORITY")) warns.push("{PRIORITY} is frozen at creation — the code won't change if priority changes later");
    return { errs, warns };
  }
  function previewCode(p, tpl, scope, a) {
    const at = codeAttrs(p, a);
    return renderCode(p, tpl, at, (p.codeCounters[scopeKey(scope, at)] || 0) + 1);
  }
  function nextItemCode(p, a) {
    const at = codeAttrs(p, a), k = scopeKey(p.codeFormat.seqScope, at);
    p.codeCounters[k] = (p.codeCounters[k] || 0) + 1;
    return renderCode(p, p.codeFormat.template, at, p.codeCounters[k]);
  }
  // Mode A amendment suffix: appended to the locked base code. {SEQ} = amendment number of that item (1, 2, …).
  const SUFFIX_TOKENS = [["{SEQ}", "Amendment number of the item"], ["{SEQ:2}", "Amendment number, padded"], ["{VER}", "Version number (amendment + 1)"], ["{YY}", "Year of amendment"], ["{MM}", "Month of amendment"]];
  function validateSuffix(sfx) {
    const errs = [];
    const toks = [...sfx.matchAll(/\{(\w+)(?::(\d+))?\}/g)];
    toks.forEach(([m, t]) => { if (!["SEQ", "VER", "YY", "MM"].includes(t)) errs.push(`Unknown token ${m} (suffix allows {SEQ} {VER} {YY} {MM})`); });
    if (!toks.some(([, t]) => t === "SEQ" || t === "VER")) errs.push("Suffix must contain {SEQ} or {VER} so each amendment gets a unique code");
    if (!sfx.trim()) errs.push("Suffix cannot be empty");
    if (/[^A-Za-z0-9\-_.]/.test(sfx.replace(/\{[^}]*\}/g, ""))) errs.push("Only letters, digits and - _ . are allowed outside tokens");
    return errs;
  }
  function renderSuffix(sfx, n, date = TODAY) {
    return sfx.replace(/\{(\w+)(?::(\d+))?\}/g, (m, t, pad) => {
      const v = { SEQ: n, VER: n + 1, YY: date.slice(2, 4), MM: date.slice(5, 7) }[t];
      return v === undefined ? m : pad ? String(v).padStart(+pad, "0") : String(v);
    });
  }
  const canManageProject = (p, u = persona()) => u.roleIds.includes("admin") || (can("project.manage", u) && p.leadIds.includes(u.id));

  // ---------- badges & small UI ----------
  const badge = (text, cls = "") => `<span class="badge ${cls}">${esc(text)}</span>`;
  const STATUS = { pass: "PASS", fail: "FAIL", blocked: "BLOCKED", skipped: "SKIPPED", not_executed: "NOT EXECUTED" };
  const testBadge = (s) => badge(STATUS[s] || s, s);
  const typeBadge = (id) => { const t = itemType(id); return `<span class="badge" style="background:${t.color}1a;color:${t.color}">${esc(t.name)}</span>`; };
  const stageBadge = (id) => badge(stage(id).name, "stage");
  const who = (id) => (id ? esc(user(id).name) + (user(id).employment === "intern" ? ' <span class="badge intern">intern</span>' : "") : '<span class="muted">—</span>');
  // Versions (Mode A) are items with versionOf; label "PAY-12 v2".
  const itemLabel = (it) => it.id;
  const itemLink = (id) => { const it = find("items", id); return it ? `<a href="#/p/${it.projectId}/item/${encodeURIComponent(it.id)}">${itemLabel(it)}</a>` : esc(id); };
  const rootId = (it) => it.versionOf || it.id;
  const versionsOf = (root) => DB.items.filter((i) => i.id === root || i.versionOf === root).sort((a, b) => (a.version || 1) - (b.version || 1));
  const amendmentsOf = (root) => DB.amendments.filter((a) => a.itemId === root);
  const isReleased = (it) => stagesOf(it).indexOf(it.stage) >= stagesOf(it).indexOf("release") && stagesOf(it).includes("release");

  // Resolve a reference id (item, wiki, release, incident) into a link.
  function ref(id) {
    if (find("items", id)) return itemLink(id);
    const w = find("wikiPages", id);
    if (w) return canRead(w) ? `<a href="#/wiki/${w.id}">📄 ${esc(w.title)}</a>` : `🔒 <span class="muted">sensitive page</span>`;
    const r = find("releases", id);
    if (r) return `<a href="#/p/${r.projectId}/releases">🚀 ${esc(r.version)}</a>`;
    const inc = find("incidents", id);
    if (inc) return `<a href="#/p/${inc.projectId}/incident/${inc.id}">🔥 ${inc.id}</a>`;
    return `<span class="mono">${esc(id)}</span>`;
  }
  const canRead = (w) => !w.sensitive || can("knowledge.sensitive");

  // Ask-AI widget (canned answers; no LLM). Wired generically in render().
  function askBox(placeholder = "Ask anything about this project…") {
    if (!can("ai.ask")) return "";
    return `<div class="ask"><form class="ask-form row"><input name="q" placeholder="${esc(placeholder)}" /><button class="btn primary">Ask AI</button></form><div class="ask-out"></div></div>`;
  }
  function answer(q) {
    const s = q.toLowerCase();
    const hit = DB.aiAnswers.find((a) => a.keys.some((k) => s.includes(k)));
    if (!hit) return `<div class="ai-item">I couldn't find this in the Knowledge Center yet. <span class="conf">Try: “apa itu PayFlow”, “kapan rilis”, “edge case refund”, “INC-7”.</span></div>`;
    const hidden = hit.sources.filter((id) => { const w = find("wikiPages", id); return w && !canRead(w); }).length;
    return `<div class="ai-item">${esc(hit.answer)}<div class="conf mt-s">Sources: ${hit.sources.map(ref).join(" · ")}</div>
      ${hidden ? `<div class="conf">${hidden} sensitive source(s) hidden for your access level.</div>` : ""}
      <div class="conf">Sample answer — the real app answers from the Knowledge Center with citations.</div></div>`;
  }

  // ---------- layout ----------
  function sidebar() {
    const pid = state.projectId;
    const cur = location.hash.split("?")[0];
    const link = (href, label) => `<a href="#${href}" class="${cur === "#" + href ? "active" : ""}">${label}</a>`;
    return `
      <div class="brand">◆ Delta PMT</div>
      ${link("/tour", "🧭 Start here — tour")}
      ${link("/home", "🏠 My home")}
      ${link("/knowledge", "📚 Knowledge Center")}
      ${link("/files", "🗂 Files")}
      <div class="section">Project</div>
      <select id="projectSwitch">${DB.projects.map((p) => `<option value="${p.id}" ${p.id === pid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
      ${link(`/p/${pid}`, "◉ My view")}
      ${link(`/p/${pid}/requests`, `📥 Requests${can("request.triage") && openRequests(pid) ? ` <span class="badge">${openRequests(pid)}</span>` : ""}`)}
      ${link(`/p/${pid}/items`, "🧵 Items (threads)")}
      ${link(`/p/${pid}/sprints`, "🗓 Sprints & quarters")}
      ${link(`/p/${pid}/board`, "▦ Task board")}
      ${link(`/p/${pid}/archives`, "🗂 Discussion archive")}
      ${link(`/p/${pid}/releases`, "🚀 Releases")}
      ${link(`/p/${pid}/knowledge`, "📄 Project knowledge")}
      ${link(`/p/${pid}/incidents`, "🔥 Incidents")}
      ${link(`/p/${pid}/files`, "🗂 Project files")}
      ${canManageProject(project(pid)) ? link(`/p/${pid}/settings`, "⚙ Project settings") : ""}
      ${can("project.create") ? link("/projects/new", "+ New project") : ""}
      ${can("admin.manage") ? `<div class="section">Backoffice</div>
        ${link("/admin/types", "Item types & stages")}
        ${link("/admin/roles", "Roles & permissions")}
        ${link("/admin/projects", "Projects & file policy")}
        ${link("/admin/users", "Users")}
        ${link("/admin/customers", "Customers")}
        ${link("/admin/request-forms", "Request forms")}
        ${link("/admin/feedback", "Feedback widget")}
        ${link("/admin/automation", "Automation rules")}
        ${link("/admin/integrations", "Integrations")}` : ""}
      ${can("lens.manage") ? link("/admin/lenses", "🧩 Lens & panels") : ""}
      <div class="section">Guides & demos</div>
      <a href="guide.html">📖 User guide (ID)</a>
      <a href="flow-demo.html">🎬 Demo: request → development</a>
      <a href="lens-demo.html">🎬 Demo: lens per role</a>
      <a href="javascript:App.resetData()">↺ Reset demo data</a>
    `;
  }

  function topbar() {
    const u = persona();
    return `
      <form class="row" id="searchForm"><input name="q" placeholder="Search knowledge, items, incidents…" style="width:280px" /></form>
      <div class="row">
        <span class="muted small">View as</span>
        <select id="personaSwitch">${DB.users.map((x) => `<option value="${x.id}" ${x.id === u.id ? "selected" : ""}>${esc(x.name)} — ${x.roleIds.map((r) => role(r).name).join(" + ")}${x.employment === "intern" ? " (intern)" : ""}</option>`).join("")}</select>
      </div>`;
  }

  // ---------- router ----------
  function match(path) {
    for (const [pattern, name] of routes) {
      const pp = pattern.split("/"), sp = path.split("/");
      if (pp.length !== sp.length) continue;
      const params = {};
      if (pp.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = decodeURIComponent(sp[i])), true) : seg === sp[i]))) return { name, params };
    }
    return null;
  }

  function render() {
    const [path, qs] = (location.hash.slice(1) || "/tour").split("?");
    const m = match(path) || { name: "tour", params: {} };
    new URLSearchParams(qs).forEach((v, k) => (m.params[k] = v));
    // ?as=<userId> switches persona from a link (used by the tour).
    if (m.params.as) {
      if (user(m.params.as)) state.personaId = m.params.as;
      // Drop ?as= from the URL so the "View as" switch keeps working afterwards.
      const rest = new URLSearchParams(qs); rest.delete("as");
      try { history.replaceState(null, "", "#" + path + (rest.toString() ? "?" + rest : "")); } catch (e) { /* file:// in some browsers */ }
      delete m.params.as;
    }
    if (m.params.pid && project(m.params.pid)) state.projectId = m.params.pid;

    document.getElementById("sidebar").innerHTML = sidebar();
    document.getElementById("topbar").innerHTML = topbar();
    const fn = screens[m.name];
    document.getElementById("content").innerHTML = fn ? fn(m.params) : `<p>Screen "${m.name}" not found.</p>`;
    if (after[m.name]) after[m.name](m.params);
    if (screens.feedbackWidget) document.getElementById("feedbackWidget").innerHTML = screens.feedbackWidget(m);

    document.getElementById("projectSwitch").onchange = (e) => {
      const sub = path.match(/^\/p\/[^/]+\/(items|board|releases|knowledge|incidents|files|settings)$/);
      location.hash = `/p/${e.target.value}${sub ? "/" + sub[1] : ""}`;
    };
    document.getElementById("personaSwitch").onchange = (e) => { state.personaId = e.target.value; render(); toast(`Now viewing as ${persona().name}`); };
    document.getElementById("searchForm").onsubmit = (e) => { e.preventDefault(); location.hash = `/knowledge?q=${encodeURIComponent(e.target.q.value)}`; };
    save();
    document.querySelectorAll(".ask-form").forEach((f) => {
      f.onsubmit = (e) => { e.preventDefault(); f.nextElementSibling.innerHTML = answer(f.q.value); };
    });
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function start() {
    load();
    window.addEventListener("beforeunload", save);
    window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
    render();
  }

  return {
    today: TODAY, resetData, save,
    screens, after, state, find, where, user, project, itemType, stage, role, persona, esc, daysSince,
    permsOf, can, whyNot, btn, primaryRole, stagesOf, stageIndex, progress, conformance, gaps, gate, fireEvent,
    resourceAccess, inheritedAccess, accessLabel, linksOf, isKnowledgeArea, fileType, companionOf, knowledgeStatus, ksBadge, resLink, attachments, targetLabel, KIND_ICON,
    CODE_TOKENS, SEQ_SCOPES, SUFFIX_TOKENS, validateSuffix, renderSuffix, validateFormat, previewCode, nextItemCode, canManageProject, releaseGate, flagBadge, itemLabel, rootId, versionsOf, amendmentsOf, isReleased,
    solutionApprovers, quarterOf, sprintRows, planOf, planBadge, archivesOf, ARCHIVE_KIND, cite, searchArchives, crosscheck, suggestFix, docText,
    itemsOfRequest, requestsOfItem, requestStatus, requestBadge, requestLink, openRequests, demandOf,
    badge, testBadge, typeBadge, stageBadge, who, itemLink, ref, canRead, askBox, answer, toast, render, start,
  };
})();
