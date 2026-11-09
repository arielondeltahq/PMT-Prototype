/* Lens & panels (ADR-016).
 * - Panel catalog: each panel is code that renders one block for an item.
 * - Layout: data rows { lens, stage, panel, column: main | side, order, variant }. Drag & drop editing is planned; prototype uses selects.
 * - Resolution falls back so a stage is never empty: lens×stage → lens×"*" → default×stage → default×"*".
 * - Quick access bar opens any panel in a drawer, from any stage/lens.
 * - Panel manager (Backoffice → Lens & panels) edits layouts with live preview. */
(function () {
  const A = App;
  const COLUMNS = { main: "Main", side: "Side" };
  const T = () => App.T;
  const only = (item) => A.state.onlyChanges && item.rev > 1;
  const keep = (item) => (x) => !only(item) || T().revOf(x) === item.rev;

  // ---------- Panel catalog ----------
  const P = {
    current_stage: { name: "Current stage", desc: "Record, approvals, attachments and gate of the stage the item is in now",
      render: (it) => T().stageCard(it, it.stage, A.stageIndex(it), A.stageIndex(it)).replace('class="card', 'class="inner') },
    timeline: { name: "Full thread (all stages)", desc: "Every stage record from Request to Learning, incl. gaps and earlier revisions",
      render: (it) => `<h2>Full thread</h2>${A.stagesOf(it).map((s, i) => T().stageCard(it, s, i, A.stageIndex(it))).join("")}` },
    ai_hint: { name: "AI helper", desc: "Role-aware suggestion for the current stage", variants: ["technical", "plain"],
      render: (it, v) => `<h2>${A.badge("AI", "ai")} For you at this stage</h2><div class="ai-item">${v === "plain" ? T().aiHint(it, "business") : T().aiHint(it)}</div>` },
    prd: { name: "PRD & acceptance criteria", desc: "Requirement summary, PRD page, AC list and latest PRD diff",
      render: (it) => {
        const rec = it.log.requirement, am = A.amendmentsOf(A.rootId(it)).slice(-1)[0];
        return `<h2>PRD</h2>${App.prdBlock ? App.prdBlock(it) : ""}${rec ? `<p class="small muted">${A.esc(rec.summary)}</p>` : ""}
          <h3 class="mt">Acceptance criteria</h3>${it.acceptance.map((a) => `<div class="small"><span class="mono">${a.id}</span> ${A.esc(a.text)} ${T().revBadge(a, it)}</div>`).join("") || '<p class="muted small">None yet.</p>'}
          ${am ? `<details class="small mt-s"><summary>Latest PRD change (${am.id})</summary>${T().diffBlock(am.prdDiff)}</details>` : ""}`;
      } },
    solution: { name: "Solution card", desc: "Approach, data/API, decisions, risks, flag, AC → solution, approvals",
      render: (it) => `<h2>Solution</h2>${App.solutionBlock ? App.solutionBlock(it) : ""}` },
    archive: { name: "Discussion archive", desc: "Archived meeting / Slack / dev notes for this item + crosscheck",
      render: (it) => `<h2>🗂 Discussion archive (${A.archivesOf(it.id).length})</h2>${A.archivesOf(it.id).map((a) => `<div class="small">${A.esc(A.ARCHIVE_KIND[a.kind])} <b>${A.esc(a.title)}</b> <span class="muted">${a.date}</span></div>`).join("") || '<p class="muted small">None.</p>'}<div class="mt-s"><a class="small" href="#/p/${it.projectId}/item/${encodeURIComponent(it.id)}/archive">Open archive & crosscheck →</a></div>` },
    linked_requests: { name: "Linked requests & demand", desc: "Requests this item solves (N:M) with customers, urgency and commercial impact",
      render: (it) => { const d = A.demandOf(A.rootId(it)), own = A.rootId(it) === it.id ? d : A.demandOf(it.id), rs = [...new Set([...d.requests, ...own.requests])];
        return `<h2>📥 Requests (${rs.length})</h2>${rs.length ? `<div class="small mb">${d.customers.length} customer(s)${d.churn ? ` · ${A.badge(d.churn + " churn risk", "fail")}` : ""}${d.blockers ? ` · ${A.badge(d.blockers + " deal blocker", "fail")}` : ""}${d.topUrgency ? ` · top urgency ${A.badge(d.topUrgency, d.topUrgency.toLowerCase())}` : ""}</div>` : ""}
          ${rs.map((r) => `<div class="small mt-s">${A.requestLink(r.id)} ${A.esc(r.title)} <span class="muted">· ${r.customerId ? A.esc(A.find("customers", r.customerId).name) : "internal"}</span></div>`).join("") || '<p class="muted small">Not linked to a request (created directly).</p>'}`; } },
    conformance: { name: "Requirement conformance", desc: "Status & evidence per acceptance criterion",
      render: (it) => { const c = A.conformance(it);
        return `<h2>Conformance ${c ? `<span class="muted small">${c.met}/${c.total} met</span>` : ""}</h2>${it.acceptance.length ? `<table>${it.acceptance.filter(keep(it)).map((a) => `<tr><td class="mono">${a.id}</td><td>${A.esc(a.text)} ${T().revBadge(a, it)}<div class="small muted">${A.esc(a.evidence)}</div></td><td>${A.badge(a.status, a.status)}</td></tr>`).join("")}</table>` : '<p class="muted small">No acceptance criteria yet.</p>'}`; } },
    dev_progress: { name: "Dev progress (tasks & PRs)", desc: "Tasks done vs total, PRs, branch and commits",
      render: (it) => {
        const tasks = A.where("tasks", (t) => t.itemId === it.id), shown = tasks.filter(keep(it)), done = tasks.filter((t) => t.status === "done").length;
        return `<h2>Dev progress</h2><div class="spread small"><span>${done}/${tasks.length} tasks done</span><a href="#/p/${it.projectId}/board">board →</a></div>
          <div class="bar mb"><span style="width:${tasks.length ? (done / tasks.length) * 100 : 0}%"></span></div>
          <table class="small">${shown.map((t) => `<tr><td>${A.esc(t.title)} ${T().revBadge(t, it)} ${t.kind === "qa_finding" ? A.badge("QA finding", "fail") : ""}</td><td>${A.badge(A.find("taskStatuses", t.status).name)}</td><td>${A.who(t.assigneeId)}</td></tr>`).join("") || '<tr><td class="muted">No tasks</td></tr>'}</table>
          ${it.prs.map((x) => `<div class="small mt-s"><span class="mono">${x.repo}#${x.number}</span> ${A.esc(x.title)} ${A.badge(x.state, x.state === "merged" ? "pass" : "")}${x.branch ? `<div class="mono muted">⎇ ${A.esc(x.branch)}</div>` : ""}
            ${(x.commits || []).filter(keep(it)).map((c) => `<div class="mono">· ${c.sha.slice(0, 7)} ${A.esc(c.msg)} ${T().revBadge(c, it)}</div>`).join("")}</div>`).join("")}`;
      } },
    blockers: { name: "Blockers & risks", desc: "Gate status, knowledge gaps, open findings, held release, rewinds",
      render: (it) => {
        const g = A.gate(it), gaps = A.gaps(it), rel = it.releaseId && A.find("releases", it.releaseId);
        const open = A.where("tasks", (t) => t.itemId === it.id && t.kind === "qa_finding" && t.status !== "done");
        const rows = [
          !g.ok && `${A.badge("gate", "fail")} ${A.esc(g.reason)}`,
          gaps.length && `${A.badge("knowledge gap", "gap")} no record for ${gaps.map((s) => A.stage(s).name).join(", ")}`,
          open.length && `${A.badge("QA findings", "fail")} ${open.length} open`,
          rel && A.releaseGate(rel).blocked && `${A.badge("release held", "fail")} ${A.esc(rel.version)}`,
          it.rev > 1 && `${A.badge("amended", "blocked")} rev ${it.rev} — see what changed`,
        ].filter(Boolean);
        return `<h2>Blockers & risks</h2>${rows.map((r) => `<div class="small mb">${r}</div>`).join("") || '<p class="small">✅ Nothing blocking.</p>'}`;
      } },
    plain_status: { name: "Status in plain language", desc: "Where it is, when customers get it, why it moved — no jargon",
      render: (it) => {
        const rel = it.releaseId && A.find("releases", it.releaseId), flag = (it.flags || []).find((f) => f.state !== "on" && f.plannedLaunch), g = A.gate(it);
        return `<h2>Status</h2><div style="font-size:22px;font-weight:700">${A.stage(it.stage).name}</div>
          <p>Step ${A.stageIndex(it) + 1} of ${A.stagesOf(it).length}. ${rel ? (rel.state === "released" ? `Released in ${A.esc(rel.version)}.` : `Planned for ${A.esc(rel.version)}, expected <b>${rel.projected}</b>${rel.projected !== rel.target ? ` (originally ${rel.target})` : ""}.`) : "Not scheduled yet."}
          ${flag ? ` Customers can use it from <b>${flag.plannedLaunch}</b>.` : ""}</p>${g.ok ? "" : `<p class="small">Waiting on: ${A.esc(g.reason)}</p>`}`;
      } },
    context_pack: { name: "Context pack", desc: "Why the item exists, rules & docs to respect, decisions, past incidents",
      render: (it) => {
        const decisions = Object.values(it.log).flatMap((r) => r.decisions || []);
        return `<h2>Context pack</h2><div class="small"><b>Why:</b> ${A.esc(it.log.request?.summary || "—")}</div>
          <div class="small mt-s"><b>Rules & docs:</b> ${it.wikiIds.map(A.ref).join(" · ") || "—"}</div>
          ${decisions.length ? `<div class="small mt-s"><b>Decisions:</b> ${decisions.map(A.esc).join("; ")}</div>` : ""}
          ${it.relatedIncidentIds.length ? `<div class="small mt-s"><b>Past incidents:</b> ${it.relatedIncidentIds.map(A.ref).join(", ")}</div>` : ""}`;
      } },
    qa_plan: { name: "QA plan & tests", desc: "What will be tested, test status, AI edge-case suggestions",
      render: (it) => `<h2>QA plan</h2><table class="small">${it.acceptance.map((a) => `<tr><td class="mono">${a.id}</td><td>${A.esc(a.text)}</td><td>${A.badge(a.status, a.status)}</td></tr>`).join("")}</table>
        <h3 class="mt">Tests</h3>${it.tests.map((t) => `<div class="small"><span class="mono">${t.id}</span> ${A.esc(t.title)} ${t.critical ? A.badge("critical", "critical") : ""} ${A.testBadge(t.status)}</div>`).join("") || '<p class="small" style="color:var(--fail)">No tests linked yet</p>'}
        <div class="mt">${A.answer("edge case")}</div>` },
    approvals: { name: "Approvals & decisions", desc: "Who approved what at which stage, pending approvers, decisions",
      render: (it) => `<h2>Approvals & decisions</h2>${A.stagesOf(it).filter((s) => it.log[s]?.approvals || it.log[s]?.decisions || it.log[s]?.pendingApprovers).map((s) => { const r = it.log[s];
        return `<div class="small mb"><b>${A.stage(s).name}</b><br>${(r.approvals || []).map((a) => `✔ ${A.esc(A.user(a.by).name)} · ${a.at}`).join("<br>")}${r.pendingApprovers?.length ? `<br>⏳ ${r.pendingApprovers.map((u) => A.who(u)).join(", ")}` : ""}${(r.decisions || []).map((d) => `<br>🧭 ${A.esc(d)}`).join("")}</div>`; }).join("") || '<p class="muted small">None yet.</p>'}` },
    release_info: { name: "Release & flags", desc: "Release, gate status, release branches, feature flags",
      render: (it) => { const rel = it.releaseId && A.find("releases", it.releaseId);
        return `<h2>Release</h2>${rel ? `${A.ref(rel.id)} · ${rel.state} · projected <b>${rel.projected}</b> ${A.releaseGate(rel).blocked ? A.badge("held", "fail") : ""}` : '<span class="muted">Not in a release yet</span>'}
          ${it.releaseBranches ? `<div class="small mono muted mt-s">⎇ ${A.esc(it.releaseBranches.base)} → ${A.esc(it.releaseBranches.target)}</div>` : ""}
          ${(it.flags || []).map((f) => `<div class="small mt-s">${A.flagBadge(f)}${f.plannedLaunch && f.state !== "on" ? " launch " + f.plannedLaunch : ""}</div>`).join("")}`; } },
    traceability: { name: "Traceability", desc: "Knowledge, tests, files and incidents linked to the item",
      render: (it) => `<h2>Traceability</h2><table class="small">
        <tr><th>Knowledge</th><td>${it.wikiIds.map(A.ref).join("<br>") || "—"}</td></tr>
        <tr><th>Tests</th><td>${it.tests.map((t) => `<span class="mono">${t.id}</span> ${A.testBadge(t.status)}`).join("<br>") || "—"}</td></tr>
        <tr><th>Files</th><td>${A.attachments("item", it.id)}</td></tr>
        <tr><th>Incidents</th><td>${it.relatedIncidentIds.map(A.ref).join(", ") || "—"}</td></tr></table>` },
    amendments: { name: "Amendment history", desc: "Every amendment with mode, reason and PRD diff",
      render: (it) => T().amendmentHistory(it).replace('class="card mb"', 'class="inner"') || '<h3>✎ Amendment history</h3><p class="muted small">No amendments.</p>' },
    files: { name: "Files", desc: "Files & links attached to the item and its stages",
      render: (it) => `<h2>Files</h2>${A.attachments("item", it.id)}${A.stagesOf(it).map((s) => { const ls = DB.resourceLinks.filter((l) => l.targetType === "item_stage" && l.targetId === `${it.id}/${s}`); return ls.length ? `<div class="small mt-s"><b>${A.stage(s).name}</b>${A.attachments("item_stage", `${it.id}/${s}`)}</div>` : ""; }).join("")}` },
    ask_ai: { name: "Ask AI", desc: "Free question box answered from the Knowledge Center", render: (it) => `<h2>Ask AI</h2>${A.askBox(`Ask about ${A.itemLabel(it)}…`)}` },
  };
  App.panels = P;

  // ---------- Layout resolution & rendering ----------
  function resolveLayout(lens, stage) {
    const pick = (l, s) => DB.layouts.filter((r) => r.lens === l && r.stage === s);
    for (const [l, s, src] of [[lens, stage, "custom"], [lens, "*", "lens (all stages)"], ["default", stage, "default"], ["default", "*", "default (all stages)"]]) {
      const rows = pick(l, s);
      if (rows.length) return { rows: rows.slice().sort((a, b) => a.order - b.order), source: src, lens: l, stage: s };
    }
    return { rows: [], source: "none" };
  }
  const panelCard = (row, item, cap) => `<div class="card mb" data-panel="${row.panel}">${cap ? `<div class="pcap">${A.esc(P[row.panel]?.name || row.panel)} · #${row.order}${row.variant ? " · " + row.variant : ""}</div>` : ""}${P[row.panel] ? P[row.panel].render(item, row.variant) : `<p class="muted">Unknown panel ${row.panel}</p>`}</div>`;
  // Two columns: main (wide) and side (narrow); panels stacked by order.
  function columns(rows, item, cap) {
    const col = (c) => rows.filter((r) => r.column === c).map((r) => panelCard(r, item, cap)).join("") || (cap ? '<p class="muted small">Empty</p>' : "");
    return `<div class="pcols"><div class="pcol-main">${col("main")}</div><div class="pcol-side">${col("side")}</div></div>`;
  }
  function renderLayout(item, lens, stage) { return columns(resolveLayout(lens, stage).rows, item, false); }

  // Lenses the persona may use = lenses of their roles. Active = chosen or primary role's.
  const lensesOf = (u = A.persona()) => [...new Set(u.roleIds.map((r) => A.role(r).lensId).filter(Boolean))];
  function activeLens() {
    const ls = lensesOf();
    return ls.includes(A.state.lensId) ? A.state.lensId : A.role(A.primaryRole()).lensId || ls[0] || "default";
  }
  const QUICK = [["PRD", "prd"], ["Solution", "solution"], ["Archive", "archive"], ["Acceptance criteria", "conformance"], ["Tasks & PRs", "dev_progress"], ["Tests", "qa_plan"], ["Files", "files"], ["History", "timeline"], ["Amendments", "amendments"], ["Approvals", "approvals"]];
  function lensBar(item) {
    const ls = lensesOf(), cur = activeLens(), L = resolveLayout(cur, item.stage);
    return `<div class="lensbar spread mb">
      <div class="row small">Lens: ${ls.length > 1 ? `<select onchange="App.state.lensId=this.value;App.render()">${ls.map((l) => `<option value="${l}" ${l === cur ? "selected" : ""}>${A.esc(A.find("lenses", l).name)}</option>`).join("")}</select>` : `<b>${A.esc(A.find("lenses", cur).name)}</b>`}
        <span class="muted">· layout: ${L.source}${A.can("lens.manage") ? ` · <a href="#/admin/lenses?tab=panels&lens=${cur}&stage=${item.stage}&item=${encodeURIComponent(item.id)}">customize</a>` : ""}</span></div>
      <div class="row quick">${QUICK.map(([l, p]) => `<button class="btn sm" onclick="App.openDrawer('${p}','${item.id}','${l}')">${l}</button>`).join("")}</div></div>`;
  }
  App.openDrawer = (panel, iid, title) => {
    document.getElementById("drawerTitle").textContent = title;
    document.getElementById("drawerBody").innerHTML = P[panel].render(A.find("items", iid));
    document.getElementById("drawer").classList.add("open");
  };
  App.closeDrawer = () => document.getElementById("drawer").classList.remove("open");
  Object.assign(App, { resolveLayout, renderLayout, activeLens, lensBar, lensesOf });

  // ---------- Panel manager ----------
  const LTABS = { lenses: "1 · Master lens", roles: "2 · Role → lens", panels: "3 · Panel management" };
  App.screens.lensManager = ({ tab = "lenses", lens = "pm", stage = "development", item, open }) => {
    if (!A.can("lens.manage")) return `<h1>Lens & panels</h1><div class="callout">${A.esc(A.whyNot("lens.manage"))}</div>`;
    const tabs = `<div class="row mb">${Object.entries(LTABS).map(([k, v]) => `<a class="btn sm ${k === tab ? "primary" : ""}" href="#/admin/lenses?tab=${k}">${v}</a>`).join("")}</div>`;
    if (tab === "lenses") return `<h1>Lens & panels</h1>${tabs}
      <div class="card"><h2>Master lens</h2><p class="small muted">A lens is a point of view. Its layout per stage is set in tab 3; which roles use it in tab 2.</p>
        <table><tr><th>Lens</th><th>Used by roles</th><th>Customized stages</th><th></th></tr>${DB.lenses.map((l) => {
          const roles = DB.roles.filter((r) => r.lensId === l.id), stages = [...new Set(DB.layouts.filter((x) => x.lens === l.id).map((x) => x.stage))];
          return `<tr><td><b>${A.esc(l.name)}</b> <span class="mono muted">${l.id}</span>${l.id === "default" ? `<div class="small muted">Fallback for any lens/stage without its own layout</div>` : ""}</td>
            <td class="small">${roles.map((r) => A.badge(r.name)).join(" ") || "—"}</td><td class="small">${stages.map((s) => (s === "*" ? "all stages" : A.stage(s).name)).join(", ") || "—"}</td>
            <td><a class="btn sm" href="#/admin/lenses?tab=panels&lens=${l.id}&stage=*">Edit layout →</a></td></tr>`; }).join("")}</table>
        <form class="row mt" id="addLens"><input name="name" placeholder="New lens, e.g. Support" required><label class="small">start from <select name="from">${DB.lenses.map((l) => `<option value="${l.id}">${A.esc(l.name)}</option>`).join("")}</select></label><button class="btn sm primary">+ Add lens</button></form></div>`;
    if (tab === "roles") return `<h1>Lens & panels</h1>${tabs}
      <div class="card"><h2>Role → lens</h2><p class="small muted">Several roles can share a lens. Users switch only between lenses of roles they hold.</p>
        <table>${DB.roles.map((r) => `<tr><td>${A.esc(r.name)}</td><td><select data-rolelens="${r.id}">${DB.lenses.filter((l) => l.id !== "default").map((l) => `<option value="${l.id}" ${r.lensId === l.id ? "selected" : ""}>${A.esc(l.name)}</option>`).join("")}</select></td></tr>`).join("")}</table></div>`;
    const sample = A.find("items", item) || DB.items.find((i) => i.stage === stage) || A.find("items", "PAY-20");
    const L = resolveLayout(lens, stage), customized = L.source === "custom";
    const rowOf = (pid) => L.rows.find((r) => r.panel === pid);
    const q = (o) => "#/admin/lenses?" + new URLSearchParams({ tab: "panels", lens, stage, item: sample.id, ...o }).toString();
    const stageOpts = [["*", "All stages (*)"], ...DB.stages.map((s) => [s.id, s.name])];
    return `
      <h1>Lens & panels</h1>${tabs}
      <div class="card mb"><div class="row">
        <label>Lens <select onchange="location.hash='${q({ lens: "__" })}'.replace('lens=__','lens='+this.value)">${DB.lenses.map((l) => `<option value="${l.id}" ${l.id === lens ? "selected" : ""}>${A.esc(l.name)}</option>`).join("")}</select></label>
        <label>Stage <select onchange="location.hash='${q({ stage: "__" })}'.replace('stage=__','stage='+this.value)">${stageOpts.map(([v, n]) => `<option value="${v}" ${v === stage ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Preview with item <select onchange="location.hash='${q({ item: "__" })}'.replace('item=__','item='+encodeURIComponent(this.value))">${DB.items.map((i) => `<option value="${i.id}" ${i.id === sample.id ? "selected" : ""}>${A.esc(A.itemLabel(i))} · ${A.stage(i.stage).name}</option>`).join("")}</select></label>
      </div>
      <p class="small mt-s">${customized ? `${A.badge("customized", "ai")} This lens has its own layout for this stage.` : `${A.badge("inherited", "blocked")} Using <b>${L.lens} × ${L.stage === "*" ? "all stages" : L.stage}</b> (${L.source}). Editing below creates a custom layout for <b>${lens} × ${stage}</b>.`}
        ${customized && !(lens === "default" && stage === "*") ? `<button class="btn sm" onclick="App.screens._resetLayout('${lens}','${stage}')">Reset to inherited</button>` : ""}</p></div>

      <div class="grid" style="grid-template-columns:5fr 7fr">
        <div class="card"><h2>Panel catalog</h2><p class="small muted">Panels are built by developers. Here you only choose the column (main / side) and order. Hidden panels stay reachable from the quick access bar. <i>Drag & drop is planned; the prototype uses selects.</i></p>
          <table class="small">${Object.entries(P).map(([pid, def]) => { const r = rowOf(pid);
            return `<tr><td><b>${A.esc(def.name)}</b><div class="muted">${A.esc(def.desc)}</div></td>
              <td><select data-col="${pid}"><option value="">Hidden</option>${Object.entries(COLUMNS).map(([k, v]) => `<option value="${k}" ${r?.column === k ? "selected" : ""}>${v}</option>`).join("")}</select>
                ${def.variants ? `<select data-variant="${pid}" ${r ? "" : "disabled"}>${def.variants.map((v) => `<option ${r?.variant === v ? "selected" : ""}>${v}</option>`).join("")}</select>` : ""}</td>
              <td><input type="number" data-order="${pid}" value="${r?.order ?? ""}" ${r ? "" : "disabled"} style="width:52px"></td>
              <td><a class="btn sm" href="${q({ open: open === pid ? "" : pid })}" title="Preview this panel">👁</a></td></tr>
              ${open === pid ? `<tr><td colspan="4"><div class="card ppreview">${def.render(sample, r?.variant)}</div></td></tr>` : ""}`; }).join("")}</table></div>

        <div><div class="card"><div class="spread"><h2>Live preview</h2><span class="small muted">${A.esc(A.find("lenses", lens).name)} · ${stage === "*" ? "all stages" : A.stage(stage).name} · ${A.esc(A.itemLabel(sample))}</span></div>
          <div class="row quick mb">${QUICK.map(([l]) => `<span class="btn sm" style="cursor:default">${l}</span>`).join("")}</div>
          ${columns(L.rows, sample, true)}</div></div>
      </div>

`;
  };

  // Ensure lens×stage has its own rows (copy inherited) before editing.
  function ensureCustom(lens, stage) {
    const L = resolveLayout(lens, stage);
    if (L.source !== "custom") L.rows.forEach((r) => DB.layouts.push({ ...r, lens, stage }));
    return DB.layouts.filter((r) => r.lens === lens && r.stage === stage);
  }
  App.screens._resetLayout = (lens, stage) => { DB.layouts = DB.layouts.filter((r) => !(r.lens === lens && r.stage === stage)); A.toast("Reset — inheriting again"); A.render(); };

  App.after.lensManager = ({ lens = "pm", stage = "development" }) => {
    const save = (msg) => { A.toast(msg); A.render(); };
    document.querySelectorAll("[data-col]").forEach((s) => (s.onchange = () => {
      const pid = s.dataset.col, rows = ensureCustom(lens, stage), r = rows.find((x) => x.panel === pid);
      const nextOrder = Math.max(0, ...rows.filter((x) => x.column === s.value).map((x) => x.order)) + 1;
      if (!s.value) DB.layouts = DB.layouts.filter((x) => !(x.lens === lens && x.stage === stage && x.panel === pid));
      else if (r) Object.assign(r, { column: s.value, order: r.column === s.value ? r.order : nextOrder });
      else DB.layouts.push({ lens, stage, panel: pid, column: s.value, order: nextOrder, variant: P[pid].variants?.[0] });
      save(`${P[pid].name}: ${s.value || "hidden"}`);
    }));
    document.querySelectorAll("[data-order]").forEach((i) => (i.onchange = () => {
      ensureCustom(lens, stage).find((x) => x.panel === i.dataset.order).order = +i.value; save("Order updated");
    }));
    document.querySelectorAll("[data-variant]").forEach((s) => (s.onchange = () => {
      ensureCustom(lens, stage).find((x) => x.panel === s.dataset.variant).variant = s.value; save("Variant updated");
    }));
    const al = document.getElementById("addLens");
    if (al && al.name) al.onsubmit = (e) => {
      e.preventDefault();
      const id = al.name.value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      if (A.find("lenses", id)) return A.toast("Lens already exists");
      DB.lenses.push({ id, name: al.name.value });
      DB.layouts.filter((x) => x.lens === al.from.value).forEach((x) => DB.layouts.push({ ...x, lens: id }));
      A.toast(`Lens “${al.name.value}” added (copied from ${al.from.value})`); A.render();
    };
    document.querySelectorAll("[data-rolelens]").forEach((s) => (s.onchange = () => { A.role(s.dataset.rolelens).lensId = s.value; A.toast("Role → lens updated"); }));
  };
})();
