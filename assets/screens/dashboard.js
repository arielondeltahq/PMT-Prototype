/* "My view" per project — each role sees its own POV over the same Thread + Knowledge.
 * Also: My home (cross-project). Switch persona with "View as" in the top bar. */
(function () {
  const A = App;

  // Shared cards -------------------------------------------------------------
  function banner(p) {
    const u = A.persona();
    const intern = u.employment === "intern";
    return `<div class="role-banner spread"><div>Viewing <b>${A.esc(p.name)}</b> as <b>${A.esc(u.name)}</b> · ${u.roleIds.map((r) => A.role(r).name).join(" + ")}
      ${intern ? A.badge("intern", "intern") + ` <span class="small muted">mentor: ${A.esc(A.user(u.mentorId).name)} · approvals & sensitive pages disabled</span>` : ""}</div>
      <span class="small muted">Same data, different POV — switch “View as” in the top bar</span></div>`;
  }

  function onboarding(p) {
    const u = A.persona();
    if (A.daysSince(u.joined) > 45) return "";
    const pages = A.where("wikiPages", (w) => (w.projectId === p.id || !w.projectId) && ["product_context", "business_rule", "glossary", "standard", "postmortem"].includes(w.category) && A.canRead(w));
    return `<div class="card ai-panel mb">
      <div class="spread"><h2>${A.badge("AI", "ai")} Welcome, ${A.esc(u.name)} — your ${A.esc(p.name)} briefing</h2><span class="conf">joined ${A.daysSince(u.joined)} days ago</span></div>
      <p>${p.id === "p-payflow" ? "PayFlow is our billing & payment SaaS. The Ledger is the financial source of truth. The most important lesson so far: INC-7 — a fix unmasked a hidden payment bug because blocked tests were treated as fine. Read these in order:" : "Start with these pages:"}</p>
      <ol>${pages.map((w) => `<li>${A.ref(w.id)} <span class="small muted">${w.category.replace("_", " ")}</span></li>`).join("")}</ol>
    </div>`;
  }

  const itemRow = (it, extra = "") => `<tr><td>${A.itemLink(it.id)}</td><td>${A.esc(it.title)}<div>${A.typeBadge(it.typeId)}</div></td><td>${A.stageBadge(it.stage)}</td><td class="small">${extra}</td></tr>`;
  const table = (rows, empty = "Nothing here.") => (rows.length ? `<table>${rows.join("")}</table>` : `<p class="muted small">${empty}</p>`);
  const card = (title, body, cls = "") => `<div class="card ${cls}"><h2>${title}</h2>${body}</div>`;

  function plainStatus(it) {
    const idx = A.stageIndex(it) + 1, total = A.stagesOf(it).length;
    const rel = it.releaseId && A.find("releases", it.releaseId);
    const relTxt = rel ? (rel.state === "released" ? `Released in ${rel.version}.` : `Planned for ${rel.version}, projected ${rel.projected}${rel.projected !== rel.target ? ` (target was ${rel.target})` : ""}.`) : "Not scheduled for a release yet.";
    const flag = (it.flags || []).find((f) => f.state !== "on" && f.plannedLaunch);
    const launchTxt = flag ? ` Customers can use it from <b>${flag.plannedLaunch}</b> (feature switched on then).` : "";
    return `Now in <b>${A.stage(it.stage).name}</b> (step ${idx} of ${total}). ${relTxt}${launchTxt}`;
  }

  // Role views ---------------------------------------------------------------
  const views = {
    business(p, items, me) {
      const toApprove = items.filter((i) => DB.prds.some((p) => p.itemId === i.id && p.review?.reviewers.some((r) => r.userId === me.id && r.decision !== "approved")));
      const rels = A.where("releases", (r) => r.projectId === p.id && r.state === "planned");
      return `
        <div class="grid g2 mb">
          ${card("PRDs waiting for your review", table(toApprove.map((i) => itemRow(i, `<a class="btn sm primary" href="#/p/${i.projectId}/item/${encodeURIComponent(i.id)}/prd?v=draft">Review PRD →</a>`))))}
          ${card("Release projection", table(rels.map((r) => `<tr><td><b>${A.esc(r.version)}</b></td><td>target ${r.target}<br>projected <b>${r.projected}</b></td><td>${A.badge(r.confidence + " confidence", r.confidence === "high" ? "pass" : "blocked")}<div class="small muted">${A.esc(r.reason)}</div></td></tr>`)))}
        </div>
        ${card(`My requests <span class="muted small">(plain-language status)</span>`, table(DB.requests.filter((r) => r.projectId === p.id && r.requesterId === me.id).map((r) => { const st = A.requestStatus(r), its = A.itemsOfRequest(r.id);
          return `<tr><td>${A.requestLink(r.id)}</td><td><b>${A.esc(r.title)}</b>${its.map((i) => `<div class="small">${A.itemLink(i.id)} — ${plainStatus(i)}</div>`).join("")}</td><td>${A.requestBadge(r)}${st.total ? `<div class="bar mt-s" style="width:120px"><span style="width:${(st.done / st.total) * 100}%"></span></div>` : ""}</td></tr>`; })) +
          `<div class="mt">${A.btn("item.request", "+ Submit a request", `location.hash='/p/${p.id}/requests/new'`, "primary")} <a class="small" href="#/p/${p.id}/requests?status=all">My submitted requests →</a></div>`)}`;
    },

    pm(p, items, me) {
      const action = items.filter((i) => ["request", "requirement"].includes(i.stage));
      const gapItems = items.filter((i) => A.gaps(i).length);
      const stale = A.where("wikiPages", (w) => w.projectId === p.id && A.daysSince(w.updated) > 180);
      return `
        ${card("Pipeline", `<div class="pipeline">${DB.stages.map((s) => {
          const n = items.filter((i) => i.stage === s.id).length;
          return `<a class="icard" href="#/p/${p.id}/items" style="text-align:center"><div class="small muted">${s.name}</div><div style="font-size:22px;font-weight:700">${n}</div></a>`;
        }).join("")}</div>`, "mb")}
        <div class="grid g2">
          ${card(`Requests to triage <a class="small" href="#/p/${p.id}/requests">open inbox →</a>`, table(DB.requests.filter((r) => r.projectId === p.id && ["new", "needs_info"].includes(r.status)).map((r) => `<tr><td>${A.requestLink(r.id)}</td><td>${A.esc(r.title)}</td><td>${A.requestBadge(r)}</td></tr>`)))}
          ${card("Needs PM action (PRD)", table(action.map((i) => itemRow(i, A.gate(i).ok ? "Ready to advance" : "⏳ " + A.esc(A.gate(i).reason)))))}
          ${card("Knowledge gaps", table([
            ...gapItems.map((i) => itemRow(i, `${A.badge("no record", "gap")} ${A.gaps(i).map((s) => A.stage(s).name).join(", ")}`)),
            ...stale.map((w) => `<tr><td colspan="3">${A.ref(w.id)}</td><td class="small">${A.badge("possibly outdated", "blocked")} ${A.daysSince(w.updated)}d since update</td></tr>`),
          ], "No gaps 🎉"))}
          ${card(`${A.badge("AI", "ai")} PRD assistant`, `<div class="ai-item">PAY-23 Subscription pause — missing acceptance criteria detected:<ul class="small"><li>What happens to an invoice already issued for the paused month?</li><li>Can a paused subscription be upgraded/downgraded?</li><li>Proration on resume mid-cycle?</li></ul><div class="conf">Based on W-2 business rules and similar item PAY-12</div></div>`, "ai-panel")}
        </div>`;
    },

    eng_lead(p, items) {
      const active = items.filter((i) => !["learning"].includes(i.stage));
      const aging = active.map((i) => { const last = Object.values(i.log).map((r) => r.at).sort().pop() || i.created; return { i, d: A.daysSince(last) }; }).sort((a, b) => b.d - a.d);
      const overrides = items.flatMap((i) => Object.entries(i.log).filter(([, r]) => r.gateOverride).map(([s]) => ({ i, s })));
      const blocked = items.filter((i) => i.gateMode === "strict" && !A.gate(i).ok);
      const rels = A.where("releases", (r) => r.projectId === p.id && r.state === "planned");
      const inc = A.where("incidents", (x) => x.projectId === p.id && x.status !== "closed");
      return `<div class="grid g2">
        ${card("Stage aging (days since last activity)", table(aging.map(({ i, d }) => itemRow(i, `${d > 7 ? A.badge(d + "d", "blocked") : d + "d"}`))))}
        ${card("Blocked by strict gate", table(blocked.map((i) => itemRow(i, A.esc(A.gate(i).reason))), "None."))}
        ${card("Release risk", table(rels.map((r) => `<tr><td>${A.esc(r.version)}</td><td>${r.projected !== r.target ? A.badge(`slips ${r.target} → ${r.projected}`, "fail") : A.badge("on track", "pass")}</td><td class="small">${A.esc(r.reason)}</td></tr>`)))}
        ${card("Gate overrides & incidents", table([
          ...overrides.map(({ i, s }) => itemRow(i, `${A.badge("override", "blocked")} at ${A.stage(s).name}`)),
          ...inc.map((x) => `<tr><td><a href="#/p/${p.id}/incident/${x.id}">${x.id}</a></td><td>${A.esc(x.title)}</td><td>${A.badge(x.severity, "critical")}</td><td class="small">${x.status}</td></tr>`),
        ], "None."))}
      </div>`;
    },

    lead_dev(p, items) {
      const sol = items.filter((i) => i.stage === "solution");
      const rev = items.filter((i) => i.stage === "review" || i.prs.some((x) => x.state === "open"));
      return `<div class="grid g2">
        ${card("Solutions to design / approve", table(sol.map((i) => itemRow(i, A.btn("approve.solution", "Approve", `App.toast('Prototype: solution approved, recorded in thread')`, "sm")))))}
        ${card("Reviews & requirement conformance", table(rev.map((i) => { const c = A.conformance(i); return itemRow(i, `${i.prs.filter((x) => x.state === "open").map((x) => `<span class="mono">${x.repo}#${x.number}</span>`).join(" ")}<br>${c ? `AC evidenced ${c.met}/${c.total}` : ""}`); })))}
        ${card("Knowledge gaps in design", table(items.filter((i) => A.gaps(i).some((s) => ["solution", "breakdown"].includes(s))).map((i) => itemRow(i, A.badge("missing " + A.gaps(i).join(", "), "gap"))), "None."))}
      </div>`;
    },

    dev(p, items, me) {
      const tasks = A.where("tasks", (t) => t.projectId === p.id && t.assigneeId === me.id && t.status !== "done");
      const myItems = [...new Set(tasks.map((t) => t.itemId))].map((id) => A.find("items", id));
      return `<div class="grid g2">
        ${card("My tasks", table(tasks.map((t) => `<tr><td>${A.itemLink(t.itemId)}</td><td>${A.esc(t.title)} ${t.kind === "qa_finding" ? A.badge("QA finding", "fail") : ""}<div class="small mono">${t.issue || "no issue"}</div></td><td>${A.badge(A.find("taskStatuses", t.status).name)}</td></tr>`)) + `<a class="small" href="#/p/${p.id}/board">Open board →</a>`)}
        <div>${myItems.map((i) => `<div class="card ai-panel mb"><h2>${A.badge("AI", "ai")} Context pack · ${A.itemLabel(i)}</h2>
          <div class="ai-item"><b>Why this exists:</b> ${A.esc(i.log.request?.summary || "—")}</div>
          <div class="ai-item"><b>Rules & docs to respect:</b> ${i.wikiIds.map(A.ref).join(" · ") || "—"}</div>
          ${i.relatedIncidentIds.length ? `<div class="ai-item"><b>Past incidents in this area:</b> ${i.relatedIncidentIds.map(A.ref).join(", ")}</div>` : ""}
          <button class="btn sm" onclick="App.toast('Prototype: AI writes a business-friendly summary of your PR')">Explain my change for Business</button></div>`).join("")}</div>
      </div>`;
    },

    lead_qa(p, items) {
      const inQa = items.filter((i) => i.stage === "qa");
      const crit = inQa.flatMap((i) => i.tests.filter((t) => t.critical && t.status !== "pass").map((t) => ({ i, t })));
      const findings = A.where("tasks", (t) => t.projectId === p.id && t.kind === "qa_finding" && t.status !== "done");
      return `<div class="grid g2">
        ${card("Items in QA — gate status", table(inQa.map((i) => itemRow(i, `${A.gate(i).ok ? "✅" : "❌"} ${A.esc(A.gate(i).reason)}`))))}
        ${card("Critical scenarios without PASS", table(crit.map(({ i, t }) => `<tr><td>${A.itemLink(i.id)}</td><td class="mono">${t.id}</td><td>${A.esc(t.title)}</td><td>${A.testBadge(t.status)}<div class="small muted">${A.esc(t.reason || "")}</div></td></tr>`), "None."))}
        ${card("Open QA findings", table(findings.map((t) => `<tr><td>${A.itemLink(t.itemId)}</td><td>${A.esc(t.title)}</td><td>${A.badge(A.find("taskStatuses", t.status).name)}</td><td class="small">by ${A.who(t.reporterId)}</td></tr>`)))}
        ${card("Test plans", `<p class="small">Approve test plans before execution.</p>${A.btn("approve.testplan", "Approve PAY-20 test plan", "App.toast('Prototype: test plan approved')", "sm")}`)}
      </div>`;
    },

    qa(p, items, me) {
      const ready = A.where("tasks", (t) => t.projectId === p.id && ["ready_to_qa", "testing"].includes(t.status));
      const inQa = items.filter((i) => i.stage === "qa");
      return `<div class="grid g2">
        ${card("Ready for me to (re)test", table(ready.map((t) => `<tr><td>${A.itemLink(t.itemId)}</td><td>${A.esc(t.title)}</td><td>${A.badge(A.find("taskStatuses", t.status).name, t.status === "ready_to_qa" ? "pass" : "")}</td></tr>`)) + `<a class="small" href="#/p/${p.id}/board">Open board →</a>`)}
        <div>${inQa.map((i) => `<div class="card ai-panel mb"><h2>${A.badge("AI", "ai")} Edge cases for ${A.itemLabel(i)}</h2>${A.answer("edge case")}
          ${A.btn("item.request", "Report a QA finding", "App.toast('Prototype: creates task + GitHub issue, status Fixing')", "sm")}</div>`).join("") || card("Edge cases", '<p class="muted small">No items in QA.</p>')}</div>
      </div>`;
    },
  };
  views.admin = views.eng_lead;

  App.screens.dashboard = ({ pid }) => {
    const p = A.project(pid), me = A.persona();
    const items = A.where("items", (i) => i.projectId === pid);
    const notMember = !p.memberIds.includes(me.id);
    return `
      <div class="spread mb"><div><h1>${A.esc(p.name)}</h1><div class="muted">${A.esc(p.desc)} · knowledge ${A.badge(p.knowledgeSharing)}</div></div>
        ${A.btn(A.can("item.create") ? "item.create" : "item.request", A.can("item.create") ? "+ New item" : "+ Submit request", `location.hash='/p/${pid}/${A.can("item.create") ? "new" : "requests/new"}'`, "primary")}</div>
      ${banner(p)}
      ${notMember ? `<div class="callout mb small">${A.esc(me.name)} is not a member of ${A.esc(p.name)} — read-only via shared knowledge.</div>` : ""}
      ${onboarding(p)}
      ${A.askBox(`Ask about ${p.name}…`)}
      ${views[A.primaryRole()](p, items, me)}`;
  };

  App.screens.home = () => {
    const me = A.persona();
    const projects = DB.projects.filter((p) => p.memberIds.includes(me.id));
    return `
      <h1>Hi ${A.esc(me.name)} 👋</h1>
      <p class="muted mb">${me.roleIds.map((r) => A.role(r).name).join(" + ")} · ${A.find("employmentTypes", me.employment).name} · ${A.esc(me.email)}</p>
      ${A.askBox("Ask across all projects…")}
      <div class="grid g3">${projects.map((p) => {
        const items = A.where("items", (i) => i.projectId === p.id);
        const rel = DB.releases.find((r) => r.projectId === p.id && r.state === "planned");
        const myTasks = A.where("tasks", (t) => t.projectId === p.id && t.assigneeId === me.id && t.status !== "done").length;
        return `<a class="card click" href="#/p/${p.id}" style="color:inherit;text-decoration:none">
          <h2>${A.esc(p.name)}</h2><div class="muted small mb">${A.esc(p.desc)}</div>
          <div class="row">${A.badge(items.filter((i) => i.stage !== "learning").length + " active items")}${myTasks ? A.badge(myTasks + " my tasks", "ai") : ""}</div>
          ${rel ? `<div class="small mt">Next: <b>${A.esc(rel.version)}</b> projected ${rel.projected} ${rel.projected !== rel.target ? A.badge("slipping", "fail") : ""}</div>` : ""}
        </a>`;
      }).join("")}</div>`;
  };
})();
