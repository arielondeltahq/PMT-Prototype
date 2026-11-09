/* The Thread — one Development Item's journey from request to learning.
 * Every stage leaves a record; passed stages without a record are knowledge gaps.
 * Amendments (ADR-012):
 *   Mode A "version"  → parallel thread (item with versionOf). Version picker + Compare.
 *   Mode B "revision" → same thread rewinds. No picker; old rounds stay in place (rev N),
 *                       "only changes" toggle + PRD diff + per-stage history. */
(function () {
  const A = App;
  const revOf = (x) => x?.rev || 1;

  function artifact(a) {
    if (a.kind === "wiki" || a.kind === "release" || a.kind === "incident") return A.ref(a.ref);
    const icon = { pr: "⇄ PR", issue: "◎ Issue" }[a.kind] || a.kind;
    return `${A.badge(icon, "gh")} <span class="mono">${A.esc(a.ref)}</span>${a.label ? ` <span class="small muted">${A.esc(a.label)}</span>` : ""}`;
  }
  const revBadge = (x, item) => (item.rev > 1 ? (revOf(x) === item.rev ? A.badge(`+ rev ${revOf(x)}`, "ai") : A.badge(`rev ${revOf(x)}`)) : "");
  const diffBlock = (lines) => `<div class="diff">${lines.map((l) => `<div class="d${l.t === "+" ? "add" : l.t === "-" ? "del" : ""}">${l.t === " " ? "&nbsp;" : l.t} ${A.esc(l.line)}</div>`).join("")}</div>`;

  // Role-aware AI hint for the current stage.
  function aiHint(item, roleOverride) {
    const r = roleOverride || A.primaryRole(), s = item.stage;
    if (r === "business") return `In plain words: this ${A.itemType(item.typeId).name.toLowerCase()} is at “${A.stage(s).name}”. ${A.gate(item).ok ? "Nothing is blocking it." : "It is waiting on: " + A.esc(A.gate(item).reason) + "."}`;
    if (item.rev > 1 && ["dev", "lead_dev", "qa", "lead_qa"].includes(r)) return `This item was amended (rev ${item.rev}). What changed for you: ${item.acceptance.filter((a) => revOf(a) === item.rev).map((a) => a.id + " " + A.esc(a.text)).join("; ") || "see PRD diff"}. Turn on “Only changes in rev ${item.rev}” to see exactly where.`;
    if (s === "qa" && ["qa", "lead_qa"].includes(r)) return A.answer("edge case");
    if (s === "requirement") return "Acceptance criteria look incomplete: no criterion covers failure/rollback behaviour. Similar item PAY-12 needed one after review. <span class='conf'>Source: PAY-12, W-2</span>";
    if (["development", "review"].includes(s)) return `Context: ${A.esc(item.log.request?.summary || "")} Rules: ${item.wikiIds.map(A.ref).join(", ") || "—"}. ${item.relatedIncidentIds.length ? "Past incident in this area: " + item.relatedIncidentIds.map(A.ref).join(", ") : ""}`;
    return "No suggestions for this stage.";
  }

  // Mode A: where are the other versions at this stage?
  function otherVersionsLine(item, sid) {
    const others = A.versionsOf(A.rootId(item)).filter((v) => v.id !== item.id && A.stagesOf(v).includes(sid));
    if (!others.length) return "";
    return `<div class="small muted mt-s">↔ ${others.map((v) => {
      const i = A.stagesOf(v).indexOf(sid), c = A.stageIndex(v);
      const st = i < c ? "done" : i === c ? "active now" : "not yet";
      return `${A.itemLink(v.id)} at this stage: <b>${st}</b>${v.log[sid] ? ` — ${A.esc(v.log[sid].summary)}` : ""}`;
    }).join("<br>")}</div>`;
  }

  function stageCard(item, sid, idx, cur) {
    const rec = item.log[sid];
    const st = idx < cur ? (rec ? "done" : "gap") : idx === cur ? "active" : "pending";
    const s = A.stage(sid);
    const g = st === "active" ? A.gate(item) : null;
    const changed = rec && revOf(rec) === (item.rev || 1) && item.rev > 1;
    // Mode B "only changes": collapse stages untouched by the current revision.
    if (A.state.onlyChanges && item.rev > 1 && !changed && st !== "active")
      return `<div class="card stage-card ${st} mb unchanged small"><b>${idx + 1}. ${s.name}</b> <span class="muted">— unchanged in rev ${item.rev}</span></div>`;

    let body = "";
    if (rec) {
      if (sid === "requirement" && changed) {
        const am = A.amendmentsOf(A.rootId(item)).find((a) => a.mode === "revision" && a.rev === item.rev);
        if (am) body += `<div class="small"><b>PRD diff rev ${am.rev - 1} → rev ${am.rev}</b></div>${diffBlock(am.prdDiff)}`;
      }
      body += `<p>${A.esc(rec.summary)}</p>`;
      if (sid === "requirement" && App.prdBlock) body += App.prdBlock(item);
      if (sid === "solution" && App.solutionBlock) body += App.solutionBlock(item);
      const arts = (rec.artifacts || []).filter((a) => !(sid === "requirement" && a.kind === "wiki")); // PRD wiki page is a mirror, shown inside the PRD block
      if (arts.length) body += `<div class="row mb">${arts.map(artifact).join(" ")}</div>`;
      if (rec.decisions) body += rec.decisions.map((d) => `<div class="small">🧭 <b>Decision:</b> ${A.esc(d)}</div>`).join("");
      if (rec.approvals) body += `<div class="small muted">${rec.approvals.map((a) => `✔ ${A.esc(A.user(a.by).name)} ${a.decision} · ${a.at}`).join(" &nbsp; ")}</div>`;
      if (sid !== "requirement" && rec.pendingApprovers?.length) body += `<div class="small">⏳ waiting: ${rec.pendingApprovers.map((u) => A.who(u)).join(", ")}</div>`;
      if (rec.gateOverride) body += `<div class="small">${A.badge("gate overridden", "blocked")}</div>`;
      if (rec.history) body += `<details class="small mt-s"><summary>Earlier revisions (${Math.max(rec.history.length, revOf(rec) - 1)})</summary>${
        (rec.history.length ? rec.history : [{ rev: 1, missing: true }]).map((h) => h.missing
          ? `<div class="hist">${A.badge("rev 1")} ${A.badge("no record", "gap")}</div>`
          : `<div class="hist">${A.badge("rev " + h.rev)} ${A.who(h.by)} · ${h.at} — ${A.esc(h.summary)}${h.approvals ? `<div class="muted">${h.approvals.map((a) => `✔ ${A.esc(A.user(a.by).name)} ${a.at}`).join(" ")}</div>` : ""}</div>`).join("")}</details>`;
    } else if (st === "gap") {
      body = `<p class="small">${A.badge("knowledge gap", "gap")} This stage was passed with no record (who, what, why). <button class="btn sm" onclick="App.toast('Prototype: AI drafts the missing record from PRs/issues for the owner to confirm')">Ask AI to draft</button></p>`;
    } else if (sid === "requirement" && st === "active" && App.prdBlock) {
      body = App.prdBlock(item);
    } else if (sid === "solution" && st === "active" && App.solutionBlock) {
      body = App.solutionBlock(item);
    } else if (st === "pending") {
      body = `<p class="small muted">Gate: ${A.esc(s.gate)}</p>`;
    }
    if (st !== "pending") body += A.attachments("item_stage", `${item.id}/${sid}`, { compact: true });
    body += otherVersionsLine(item, sid);
    if (g) body += `<div class="callout ${g.ok ? "green" : ""} small mt-s"><b>Gate (${item.gateMode}):</b> ${A.esc(s.gate)}<br>${g.ok ? "✅" : "❌"} ${A.esc(g.reason)}</div>`;
    return `<div class="card stage-card ${st} mb">
      <div class="spread"><h3>${idx + 1}. ${s.name} ${rec && item.rev > 1 ? revBadge(rec, item) : ""}</h3><span class="small muted">${rec ? `${A.who(rec.by)} · ${rec.at}` : `owner role: ${A.role(s.ownerRole).name}`}</span></div>${body}</div>`;
  }

  function advanceControls(item) {
    const stages = A.stagesOf(item), cur = A.stageIndex(item);
    const amend = A.can("item.amend") ? `<a class="btn" href="#/p/${item.projectId}/item/${encodeURIComponent(item.id)}/amend">✎ Amend</a>`
      : A.can("item.request") ? `<button class="btn" onclick="App.toast('Amendment proposal sent to PM / Lead Dev')">✎ Propose amendment</button>` : "";
    if (cur >= stages.length - 1) return `${amend}<span class="small muted">Final stage.</span>`;
    const next = A.stage(stages[cur + 1]).name;
    if (!A.can("item.advance")) return amend + A.btn("item.advance", `Advance to ${next}`, "");
    const g = A.gate(item);
    if (g.ok) return `${amend}<button class="btn primary" onclick="App.screens._advance('${item.id}')">Advance to ${next} →</button>`;
    if (item.gateMode === "advisory") return `${amend}<button class="btn" onclick="if(confirm('Gate not met: ${A.esc(g.reason).replace(/'/g, "")}. Advance anyway? This is recorded.'))App.screens._advance('${item.id}',true)">⚠ Advance to ${next} anyway</button>`;
    return `${amend}<button class="btn" disabled title="Strict gate">⛔ Blocked by strict gate</button> ${A.btn("item.override_gate", "Override (logged)", `App.screens._advance('${item.id}',true)`, "sm")}`;
  }

  App.screens._advance = (iid, override) => {
    const it = A.find("items", iid), me = A.persona();
    const stages = A.stagesOf(it), cur = A.stageIndex(it);
    const old = it.log[it.stage], rev = it.rev || 1;
    // Re-passing a stage in a newer revision keeps the old round in history.
    if (old && revOf(old) < rev) it.log[it.stage] = { rev, summary: `Re-done for rev ${rev}.`, history: [...(old.history || []), { ...old, history: undefined }] };
    it.log[it.stage] = Object.assign(it.log[it.stage] || { summary: "Completed.", rev }, { by: me.id, at: App.today }, override ? { gateOverride: true } : {});
    it.stage = stages[cur + 1];
    A.toast(`${A.itemLabel(it)} → ${A.stage(it.stage).name}${override ? " (gate override logged)" : ""}`);
    A.render();
  };
  App.screens._toggleChanges = () => { A.state.onlyChanges = !A.state.onlyChanges; A.render(); };

  function versionBar(item) {
    const vs = A.versionsOf(A.rootId(item));
    if (vs.length < 2) return "";
    return `<div class="versionbar mb"><span class="small muted">Versions:</span>
      ${vs.map((v) => `<a class="btn sm ${v.id === item.id ? "primary" : ""}" href="#/p/${v.projectId}/item/${encodeURIComponent(v.id)}">v${v.version || 1} · ${A.stage(v.stage).name}${A.isReleased(v) ? " ✓" : ""}</a>`).join("")}
      <a class="btn sm" href="#/p/${item.projectId}/item/${encodeURIComponent(item.id)}/compare">⇆ Compare</a></div>`;
  }

  function amendmentHistory(item) {
    const ams = A.amendmentsOf(A.rootId(item));
    if (!ams.length) return "";
    return `<div class="card mb"><h3>✎ Amendment history</h3>${ams.map((a, i) => `
      <details class="mb" ${i === ams.length - 1 ? "open" : ""}><summary>${A.badge(a.mode === "version" ? `Mode A · v${a.fromVersion} → v${a.toVersion}` : `Mode B · rev ${a.rev}`, a.mode === "version" ? "ai" : "blocked")}
        <span class="small">${A.who(a.by)}${a.decidedWith ? " + " + A.who(a.decidedWith) : ""} · ${a.at}</span></summary>
        <p class="small">${A.esc(a.reason)}</p>${diffBlock(a.prdDiff)}</details>`).join("")}</div>`;
  }

  // Shared with panels.js
  App.T = { stageCard, aiHint, amendmentHistory, revBadge, revOf, diffBlock };

  App.screens.thread = ({ pid, iid }) => {
    const item = A.find("items", iid);
    if (!item) return "<p>Item not found.</p>";
    const stages = A.stagesOf(item), cur = A.stageIndex(item);
    const skipped = DB.stages.filter((s) => !stages.includes(s.id)).map((s) => s.name);
    const only = A.state.onlyChanges && item.rev > 1;

    return `
      <div class="muted small">${A.itemLabel(item)} · created ${item.created} · requested by ${A.who(item.requesterId)} · owner ${A.who(item.ownerId)}</div>
      <div class="spread"><h1>${A.esc(item.title)} ${item.versionOf ? A.badge("v" + item.version, "ai") : ""} ${item.rev > 1 ? A.badge("rev " + item.rev, "blocked") : ""}</h1><div class="row">${advanceControls(item)}</div></div>
      <div class="row mb">${A.typeBadge(item.typeId)} ${A.badge("gate: " + item.gateMode, item.gateMode === "strict" ? "critical" : "")} ${A.planBadge(item.id)} <a class="small" href="#/p/${item.projectId}/item/${encodeURIComponent(item.id)}/archive">🗂 archive (${A.archivesOf(item.id).length})</a>
        ${skipped.length ? `<span class="small muted">This type skips: ${skipped.join(", ")}</span>` : ""}</div>
      ${versionBar(item)}
      ${item.rev > 1 ? `<div class="callout small mb spread"><span>Amended in place (Mode B) — revision ${item.rev}. Earlier work stays visible, marked <b>rev 1</b>.</span>
        <label><input type="checkbox" ${only ? "checked" : ""} onchange="App.screens._toggleChanges()"> Only changes in rev ${item.rev}</label></div>` : ""}

      <div class="stepper">${stages.map((s, i) => {
        const rec = item.log[s];
        const cls = i < cur ? (rec ? "done" : "gap") : i === cur ? "active" : "";
        const loop = rec && (revOf(rec) > 1 || rec.history) ? ` ⟲${revOf(rec)}` : "";
        return `<div class="step ${cls}">${A.stage(s).name}${loop}</div>`;
      }).join("")}</div>

      ${A.lensBar(item)}
      ${A.renderLayout(item, A.activeLens(), item.stage)}
      <div class="drawer" id="drawer"><div class="spread"><b id="drawerTitle"></b><button class="btn sm" onclick="App.closeDrawer()">✕</button></div><div id="drawerBody" class="mt"></div></div>`;
  };

  // ---------- Compare versions (Mode A) ----------
  App.screens.compare = ({ iid, a, b }) => {
    const base = A.find("items", iid);
    if (!base) return "<p>Item not found.</p>";
    const vs = A.versionsOf(A.rootId(base));
    const L = A.find("items", a) || vs[0], R = A.find("items", b) || vs[vs.length - 1];
    const sel = (name, cur) => `<select onchange="location.hash='/p/${base.projectId}/item/${encodeURIComponent(iid)}/compare?a='+encodeURIComponent(${name === "a" ? "this.value" : `'${L.id}'`})+'&b='+encodeURIComponent(${name === "b" ? "this.value" : `'${R.id}'`})">${vs.map((v) => `<option value="${v.id}" ${v.id === cur.id ? "selected" : ""}>${A.itemLabel(v)}</option>`).join("")}</select>`;
    const ids = [...new Set([...L.acceptance.map((x) => x.id), ...R.acceptance.map((x) => x.id)])];
    const acRow = (id) => {
      const l = L.acceptance.find((x) => x.id === id), r = R.acceptance.find((x) => x.id === id);
      const kind = !l ? "add" : !r ? "del" : l.text !== r.text ? "chg" : "";
      return `<tr class="${kind ? "row-" + kind : ""}"><td class="mono">${id}</td><td>${l ? A.esc(l.text) : "—"}</td><td>${r ? A.esc(r.text) : "—"}</td><td>${{ add: A.badge("added", "pass"), del: A.badge("removed", "fail"), chg: A.badge("changed", "blocked") }[kind] || '<span class="muted small">same</span>'}</td></tr>`;
    };
    const list = (it, fn) => fn(it).join("<br>") || '<span class="muted">—</span>';
    const tasks = (it) => A.where("tasks", (t) => t.itemId === it.id).map((t) => `${A.esc(t.title)} ${A.badge(A.find("taskStatuses", t.status).name)}`);
    const prs = (it) => it.prs.map((x) => `<span class="mono">${x.repo}#${x.number}</span> ${A.badge(x.state)}`);
    const tests = (it) => it.tests.map((t) => `<span class="mono">${t.id}</span> ${A.testBadge(t.status)}`);
    const row = (label, l, r) => `<tr><th>${label}</th><td>${l}</td><td>${r}</td></tr>`;
    return `
      <div class="spread mb"><h1>Compare versions — ${A.esc(base.title)}</h1><a class="btn" href="#/p/${base.projectId}/item/${encodeURIComponent(iid)}">← Back to thread</a></div>
      <div class="card mb"><h2>Acceptance criteria</h2>
        <table><tr><th></th><th>${sel("a", L)}</th><th>${sel("b", R)}</th><th></th></tr>${ids.map(acRow).join("")}</table></div>
      <div class="card"><h2>Per stage</h2><table>
        <tr><th></th><th>${A.itemLink(L.id)}</th><th>${A.itemLink(R.id)}</th></tr>
        ${row("Current stage", A.stageBadge(L.stage), A.stageBadge(R.stage))}
        ${row("Requirement", A.esc(L.log.requirement?.summary || "—"), A.esc(R.log.requirement?.summary || "—"))}
        ${row("Solution", A.esc(L.log.solution?.summary || "—"), A.esc(R.log.solution?.summary || "—"))}
        ${row("Tasks", list(L, tasks), list(R, tasks))}
        ${row("Pull requests", list(L, prs), list(R, prs))}
        ${row("Tests", list(L, tests), list(R, tests))}
        ${row("Release", L.releaseId ? A.ref(L.releaseId) : "—", R.releaseId ? A.ref(R.releaseId) : "—")}
      </table></div>`;
  };

  // ---------- Amend form with impact preview ----------
  App.screens.amend = ({ iid }) => {
    const item = A.find("items", iid);
    if (!item) return "<p>Item not found.</p>";
    if (!A.can("item.amend")) return `<h1>Amend</h1><div class="callout">${A.esc(A.whyNot("item.amend"))}</div>`;
    const stages = A.stagesOf(item), cur = A.stageIndex(item), dev = stages.indexOf("development");
    const released = A.isReleased(item), preDev = dev >= 0 && cur < dev;
    return `
      <h1>Amend ${A.itemLabel(item)} — ${A.esc(item.title)}</h1>
      <p class="muted mb">Currently at <b>${A.stage(item.stage).name}</b>. Choose how the change runs. You'll see the impact before confirming.</p>
      <form class="card" id="amendForm" style="max-width:820px">
        <h3>Mode</h3>
        <label class="modeopt ${preDev ? "off" : ""}"><input type="radio" name="mode" value="version" ${preDev ? "disabled" : ""} ${released ? "checked" : ""}>
          <b>A — New version (parallel)</b><br><span class="small muted">${A.itemLabel(item)} keeps running to release. A new version starts at Requirement.${preDev ? " Not offered before Development — nothing to protect yet." : ""}</span></label>
        <label class="modeopt ${released ? "off" : ""}"><input type="radio" name="mode" value="revision" ${released ? "disabled" : ""} ${!released ? "checked" : ""}>
          <b>B — Revise in place (rewind)</b><br><span class="small muted">Same thread & branch; stages repeat only for what changed; one release.${released ? " Not possible — already released." : ""}</span></label>
        <label class="mt" style="display:block">Reason<br><textarea name="reason" rows="2" required style="width:100%" placeholder="Why does the scope change?"></textarea></label>
        <label class="mt" style="display:block">New / changed acceptance criteria (one per line, e.g. <span class="mono">AC7: Refund via e-wallet</span>)<br><textarea name="acs" rows="3" style="width:100%"></textarea></label>
        <div class="card mt" id="impact"></div>
        <div class="mt"><button class="btn primary">Confirm amendment</button> <a class="btn" href="#/p/${item.projectId}/item/${encodeURIComponent(item.id)}">Cancel</a></div>
      </form>`;
  };

  App.after.amend = ({ iid }) => {
    const f = document.getElementById("amendForm");
    if (!f) return;
    const item = A.find("items", iid), stages = A.stagesOf(item), cur = A.stageIndex(item);
    const rel = item.releaseId && A.find("releases", item.releaseId);
    const impact = () => {
      const mode = f.querySelector("[name=mode]:checked")?.value;
      const n = f.acs.value.split("\n").filter((l) => l.trim()).length;
      if (mode === "version") {
        const nv = A.versionsOf(A.rootId(item)).length + 1;
        document.getElementById("impact").innerHTML = `<h3>Impact — Mode A</h3><ul class="small">
          <li>${A.itemLabel(item)} continues at <b>${A.stage(item.stage).name}</b>${rel ? ` and still ships in ${A.esc(rel.version)}` : ""}.</li>
          <li>New version code: <b class="mono">${A.esc(A.rootId(item) + A.renderSuffix(A.project(item.projectId).codeFormat.amendSuffix, nv - 1))}</b> (base code locked; suffix from project settings).</li>
          <li>New <b>v${nv}</b> starts at <b>Requirement</b>: PRD v${nv} must be approved by requester + PM (strict gate).</li>
          <li>${n} new/changed acceptance criteria; unchanged ones are inherited.</li>
          <li>v${nv} may run in parallel but cannot release before ${A.itemLabel(item)}.</li></ul>`;
      } else if (mode === "revision") {
        const redo = stages.slice(stages.indexOf("requirement"), cur + 1).map((s) => A.stage(s).name);
        const approvals = stages.slice(1, cur + 1).filter((s) => item.log[s]?.approvals).map((s) => A.stage(s).name);
        document.getElementById("impact").innerHTML = `<h3>Impact — Mode B</h3><ul class="small">
          <li>Thread rewinds to <b>Requirement</b> (rev ${(item.rev || 1) + 1}). Stages to pass again: ${redo.join(" → ")}.</li>
          <li>Approvals to redo: ${approvals.join(", ") || "—"}.</li>
          <li>${n} new/changed acceptance criteria → expect ≈${n} new task(s) in Breakdown and new tests in QA; regression of existing AC in QA.</li>
          <li>Same branch is patched; existing work stays, marked rev ${item.rev || 1}.</li>
          ${rel ? `<li>Release ${A.esc(rel.version)} projected to slip ≈${redo.length} day(s) (est.).</li>` : ""}</ul>`;
      } else document.getElementById("impact").innerHTML = '<p class="small muted">Choose a mode to see the impact.</p>';
    };
    f.querySelectorAll("[name=mode]").forEach((r) => (r.onchange = impact));
    f.acs.oninput = impact;
    impact();

    f.onsubmit = (e) => {
      e.preventDefault();
      const mode = f.querySelector("[name=mode]:checked")?.value, me = A.persona();
      if (!mode) return A.toast("Choose a mode");
      const lines = f.acs.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(AC\d+)\s*:\s*(.+)$/); return m ? { id: m[1], text: m[2] } : { id: "AC" + (item.acceptance.length + 1), text: l }; });
      const prdDiff = lines.map((l) => ({ t: "+", line: `${l.id} ${l.text}` }));
      const root = A.rootId(item);
      if (mode === "revision") {
        const rev = (item.rev || 1) + 1, old = item.log.requirement;
        item.rev = rev;
        item.log.requirement = { rev, by: me.id, at: App.today, summary: `PRD amended (rev ${rev}): ${f.reason.value}`, approvals: [],
          artifacts: old?.artifacts, history: [...(old?.history || []), ...(old ? [{ ...old, history: undefined, rev: old.rev || 1 }] : [])] };
        lines.forEach((l) => { const ex = item.acceptance.find((x) => x.id === l.id); ex ? Object.assign(ex, { text: l.text, rev, status: "unverified" }) : item.acceptance.push({ ...l, rev, status: "unverified", evidence: "—" }); });
        item.stage = "requirement";
        // Rewind opens a new PRD draft from the latest version; it goes through review before publishing (ADR-018).
        const prd = DB.prds.find((x) => x.itemId === item.id);
        if (prd && prd.draftHtml == null && prd.versions.length) { prd.draftHtml = prd.versions[prd.versions.length - 1].html + `<p><mark>rev ${rev}: ${A.esc(f.reason.value)}</mark></p>`; prd.draftSavedAt = App.today; prd.review = null; }
        DB.amendments.push({ id: "AM-" + (DB.amendments.length + 1), itemId: root, mode, rev, by: me.id, at: App.today, rewindTo: "requirement", reason: f.reason.value, prdDiff });
        A.state.onlyChanges = true;
        A.toast(`${A.itemLabel(item)} amended — rev ${rev}, rewound to Requirement`);
        location.hash = `/p/${item.projectId}/item/${encodeURIComponent(item.id)}`;
      } else {
        const latest = A.versionsOf(root).pop(), nv = (latest.version || 1) + 1, p = A.project(item.projectId), id = root + A.renderSuffix(p.codeFormat.amendSuffix, nv - 1);
        const acs = latest.acceptance.map((x) => ({ ...x, rev: undefined, evidence: x.status === "met" ? "inherited from v" + (latest.version || 1) : "—" }));
        lines.forEach((l) => { const ex = acs.find((x) => x.id === l.id); ex ? Object.assign(ex, { text: l.text, status: "unverified" }) : acs.push({ ...l, status: "unverified", evidence: "—" }); });
        DB.items.push({ id, versionOf: root, version: nv, projectId: item.projectId, typeId: item.typeId, title: item.title, stage: "requirement", gateMode: item.gateMode,
          requesterId: item.requesterId, ownerId: me.id, created: App.today, releaseId: null, wikiIds: [...item.wikiIds],
          log: { request: { by: me.id, at: App.today, summary: `Amendment of ${A.itemLabel(latest)}: ${f.reason.value}` } }, acceptance: acs, prs: [], tests: [], relatedIncidentIds: [...item.relatedIncidentIds] });
        DB.amendments.push({ id: "AM-" + (DB.amendments.length + 1), itemId: root, mode, fromVersion: latest.version || 1, toVersion: nv, by: me.id, at: App.today, reason: f.reason.value, prdDiff });
        A.toast(`${root} v${nv} created — ${A.itemLabel(latest)} keeps running`);
        location.hash = `/p/${item.projectId}/item/${encodeURIComponent(id)}`;
      }
    };
  };
})();
