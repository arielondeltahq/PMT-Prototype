/* Solution (ADR-022) + discussion archive + crosscheck.
 * - Solution is a structured decision card, not a chat: approach, touched parts, data/API, decision + rejected options, risks, flag, estimate, AC → solution.
 *   Approval: Lead Dev, + Eng Lead when data/API changes.
 * - Discussion happens outside PMT (meetings, Slack). People archive the notes: AI meeting summary, manual notes, Slack thread (link + summary), dev discussion.
 *   Archives are immutable — delete only (audit kept). Slack API import is not MVP; pasting the summary + link is.
 * - Archive text is immutable; users or AI add context notes (ignore off-topic parts, clarify, focus) that the AI reads with it.
 * - Crosscheck (AI) picks statements from the text, highlights mismatches with PRD + solution (conflict / missing / open), warns,
 *   then offers AI suggestions the user can use, edit or skip — or the user fixes manually. Never blocks the gate.
 * - Search finds who said what, where: "AR-1 · Meeting notes by Budi · line 5" or the Slack link. */
(function () {
  const A = App;
  const NOW = App.today;
  const solOf = (iid) => DB.solutions.find((s) => s.itemId === iid);
  const url = (item, sub) => `#/p/${item.projectId}/item/${encodeURIComponent(item.id)}/${sub}`;
  const FIELDS = [["approach", "Approach", "How we build it, in a few sentences"], ["touched", "Parts touched", "Repos, modules, services"], ["dataApi", "Data / API changes", "Tables, columns, endpoints, events (requires Eng Lead approval)"],
    ["decisions", "Decision", "What we chose"], ["rejected", "Rejected alternatives", "What we did not choose, and why"], ["risks", "Risks & non-functional", "Performance, security, compatibility, rollback"],
    ["flag", "Feature flag", "Flag key, or empty if none"], ["estimate", "Estimate", "S / M / L"]];
  const DEC = { pending: ["⏳ pending", "skipped"], approved: ["✔ approved", "pass"], changes: ["✎ changes requested", "fail"] };
  const ST = { draft: ["Draft", "blocked"], in_review: ["In review", "medium"], approved: ["Approved", "pass"] };

  // ---------- crosscheck: warning → offer AI suggestions → use / edit / skip each ----------
  const CC = { covered: ["✓ covered", "pass"], missing: ["missing", "fail"], conflict: ["⚠ conflict", "fail"], open: ["open question", "blocked"], ignored: ["ignored", "skipped"] };
  const ORDER = ["conflict", "missing", "open", "covered", "ignored"];
  let cc = null; // { iid, target, mode: "offer" | "suggest" | "manual", handled: { key: "used" | "skipped" } }
  const key = (r) => `${r.a.id}:${r.n}`;
  function ccHtml() {
    const item = A.find("items", cc.iid), rows = A.crosscheck(item).sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status));
    if (!A.archivesOf(item.id).length) return `<p class="small muted">No archived discussions for this item yet.</p>`;
    const issues = rows.filter((r) => ["conflict", "missing", "open"].includes(r.status)), rest = rows.filter((r) => !issues.includes(r));
    const count = (st) => issues.filter((r) => r.status === st).length;
    const line = (r) => {
      const h = cc.handled[key(r)], fx = cc.mode === "suggest" && !h && issues.includes(r) ? A.suggestFix(item, r, cc.target) : null;
      return `<tr><td style="width:110px">${A.badge(...CC[r.status])}</td><td>${A.esc(r.text)}<div class="small muted">${A.esc(r.detail)} · ${A.cite(r.a, r.n)}</div>
        ${h ? `<div class="small mt-s">${h === "used" ? "✅ applied" : "⏭ skipped"}</div>` : ""}
        ${fx ? `<div class="suggest mt-s"><div class="small">${A.badge("AI", "ai")} ${A.esc(fx.label)}</div>
          <div class="row mt-s"><input id="fx-${key(r).replace(":", "-")}" value="${A.esc(fx.text)}" style="flex:1"><button class="btn sm primary" onclick="App.ccUse('${key(r)}')">Use</button><button class="btn sm" onclick="App.ccSkip('${key(r)}')">Skip</button></div>
          <div class="small muted">Edit the text before “Use” if needed.</div></div>` : ""}</td></tr>`;
    };
    return `<div class="callout ${issues.length ? "" : "green"} small">${issues.length ? `⚠ <b>${issues.length} finding(s)</b> between the archived discussions and the ${cc.target === "solution" ? "solution" : "PRD / solution"}: ${count("conflict")} conflict · ${count("missing")} missing · ${count("open")} open question. This is a warning — it does not block the gate.` : "✅ PRD / solution match the archived discussions."}</div>
      ${issues.length && cc.mode === "offer" ? `<div class="row mt-s"><b class="small">Generate suggestions with AI?</b><button class="btn sm primary" onclick="App.ccMode('suggest')">Yes, suggest fixes</button><button class="btn sm" onclick="App.ccMode('manual')">No, I'll fix it myself</button></div>` : ""}
      ${cc.mode === "manual" && issues.length ? `<div class="small mt-s">Fix manually: <a href="#/p/${item.projectId}/item/${encodeURIComponent(item.id)}/prd?edit=1">edit PRD</a> · <a href="#/p/${item.projectId}/item/${encodeURIComponent(item.id)}/solution?edit=1">edit solution</a> · <a href="javascript:App.ccMode('suggest')">or let AI suggest</a></div>` : ""}
      <table class="mt-s">${issues.map(line).join("")}</table>
      ${rest.length ? `<details class="small mt-s"><summary>${rest.length} covered / ignored</summary><table>${rest.map(line).join("")}</table></details>` : ""}
      <p class="small muted mt-s">${A.badge("AI", "ai")} The AI picks the statements that matter from the archive text and its context notes. Prototype uses keyword & number matching.</p>`;
  }
  const ccDraw = () => { const el = document.getElementById("ccBox"); if (el && cc) { el.innerHTML = ccHtml(); el.style.display = "block"; } };
  App.ccToggle = (iid, target) => { cc = { iid, target, mode: "offer", handled: {} }; ccDraw(); };
  App.ccMode = (m) => { cc.mode = m; if (m === "manual") A.toast("OK — fix it manually; run the crosscheck again afterwards"); ccDraw(); };
  App.ccSkip = (k) => { cc.handled[k] = "skipped"; ccDraw(); };
  App.ccUse = (k) => {
    const item = A.find("items", cc.iid), r = A.crosscheck(item).find((x) => key(x) === k), fx = A.suggestFix(item, r, cc.target);
    fx.text = document.getElementById("fx-" + k.replace(":", "-")).value.trim();
    if (!applyFix(item, fx)) return;
    cc.handled[k] = "used"; ccDraw();
  };
  // Apply to the PRD draft (created from the latest version if needed) or the solution card. Approvals reset, as with any edit.
  function applyFix(item, fx) {
    if (fx.target === "prd") {
      const p = App.prdOf && App.prdOf(item.id);
      if (!p) { A.toast("This item has no PRD — apply to the solution instead"); return false; }
      if (p.draftHtml == null) p.draftHtml = p.versions[p.versions.length - 1]?.html || "";
      if (fx.op === "replace") p.draftHtml = p.draftHtml.replace(fx.find, fx.text);
      else {
        const h = `<h2>${fx.section}</h2><ul>`;
        p.draftHtml = p.draftHtml.includes(h) ? p.draftHtml.replace(h, `${h}<li>${A.esc(fx.text)}</li>`) : p.draftHtml + `${h}<li>${A.esc(fx.text)}</li></ul>`;
      }
      p.draftSavedAt = NOW;
      if (p.review?.reviewers.some((x) => x.decision !== "pending")) p.review.reviewers.forEach((x) => (x.decision = "pending"));
      A.toast("Added to the PRD draft — review & publish as usual");
    } else {
      const s = solOf(item.id);
      if (!s) { A.toast("No solution card yet"); return false; }
      s[fx.field] = [s[fx.field], fx.text].filter(Boolean).join(" · ");
      if (s.reviewers.some((x) => x.decision !== "pending")) { s.reviewers.forEach((x) => (x.decision = "pending")); s.status = "in_review"; }
      A.toast(`Solution → ${fx.field} updated (approvals reset)`);
    }
    return true;
  }
  App.crosscheckButton = (item, target = "prd") => `<button class="btn sm" onclick="App.ccToggle('${A.esc(item.id)}','${target}')">🔎 Crosscheck with archive (${A.archivesOf(item.id).length})</button><div id="ccBox" class="mt-s" style="display:none"></div>`;

  // ---------- solution block (stage card + panel) ----------
  App.solutionBlock = (item) => {
    const s = solOf(item.id);
    if (!s) return `<div class="prd-block"><b>🧭 Solution</b> ${A.badge("not written", "gap")}<div class="mt-s">${A.btn("solution.edit", "✎ Write solution", `location.hash='${url(item, "solution")}?edit=1'`, "sm primary")}</div></div>`;
    const mapped = item.acceptance.filter((a) => (s.acMap[a.id] || "").trim()).length;
    return `<div class="prd-block"><div class="spread"><div><b>🧭 <a href="${url(item, "solution")}">Solution</a></b> ${A.badge(...ST[s.status])} ${s.estimate ? A.badge("size " + s.estimate) : ""} ${s.flag ? A.badge("flag " + s.flag, "ai") : ""}</div>
      <a class="btn sm primary" href="${url(item, "solution")}">Open →</a></div>
      <div class="small mt-s">${A.esc(s.approach)}</div>
      <div class="row small mt-s">${item.acceptance.length ? `<span>AC mapped ${mapped}/${item.acceptance.length}</span>` : ""}<span>approvals: ${s.reviewers.map((r) => `${A.esc(A.user(r.userId).name)} ${DEC[r.decision][0]}`).join(", ")}</span><span>🗂 ${A.archivesOf(item.id).length} archive(s)</span></div></div>`;
  };

  // ---------- solution screen ----------
  App.screens.solution = ({ pid, iid, edit }) => {
    const item = A.find("items", iid);
    if (!item) return "<h1>Item not found</h1>";
    const s0 = solOf(iid), editing = edit && A.can("solution.edit");
    if (!s0 && !editing) return `<div class="muted small">${A.itemLink(iid)} › Solution</div><h1>Solution — ${A.esc(item.title)}</h1><div class="card"><p class="muted">No solution yet.</p>${A.btn("solution.edit", "✎ Write solution", `location.hash='${url(item, "solution")}?edit=1'`, "primary")}</div>`;
    const s = s0 || { itemId: iid, status: "draft", by: A.persona().id, updated: NOW, acMap: {}, reviewers: [], ...Object.fromEntries(FIELDS.map(([k]) => [k, ""])) };
    const need = A.solutionApprovers(item, s), me = A.persona(), mine = s.reviewers.find((r) => r.userId === me.id);
    return `
      <div class="muted small">${A.itemLink(iid)} › Solution</div>
      <div class="spread"><h1>Solution — ${A.esc(item.title)} ${A.badge(...ST[s.status])}</h1>
        <div class="row">${editing ? `<button class="btn primary" onclick="App.solSave('${A.esc(iid)}')">Save</button><a class="btn" href="${url(item, "solution")}">Cancel</a>` : A.btn("solution.edit", "✎ Edit", `location.hash='${url(item, "solution")}?edit=1'`)}</div></div>
      <p class="small muted mb">The decision card for “how we build it”. Discussions happen in meetings or Slack — archive their notes, then crosscheck.</p>
      <div class="pcols">
        <div>
          <form class="card" id="solForm"><h2>Decision card</h2><table>
            ${FIELDS.map(([k, l, ph]) => `<tr><th style="width:170px">${l}</th><td>${editing ? `<textarea name="${k}" rows="${k === "estimate" || k === "flag" ? 1 : 2}" style="width:100%" placeholder="${ph}">${A.esc(s[k] || "")}</textarea>` : A.esc(s[k] || "—")}</td></tr>`).join("")}</table>
            ${item.acceptance.length ? `<h3 class="mt">AC → solution</h3><table>${item.acceptance.map((a) => `<tr><td class="mono" style="width:60px">${a.id}</td><td class="small">${A.esc(a.text)}</td><td>${editing ? `<input name="ac_${a.id}" value="${A.esc(s.acMap[a.id] || "")}" style="width:100%">` : s.acMap[a.id] ? A.esc(s.acMap[a.id]) : A.badge("not mapped", "fail")}</td></tr>`).join("")}</table>` : '<p class="small muted mt">This item type has no acceptance criteria — describe the technical problem in “Approach”.</p>'}
            ${editing ? `<div class="small muted mt-s">${A.badge("AI", "ai")} <a href="javascript:App.toast('Prototype: AI drafts the card from the PRD + archived discussions, for you to edit')">Draft from PRD + archives</a></div>` : ""}
          </form>
          <div class="card mt"><div class="spread"><h2>🗂 Discussion archive</h2><a class="btn sm" href="${url(item, "archive")}">Open archive →</a></div>
            ${A.archivesOf(iid).map((a) => `<div class="small mt-s">${A.esc(A.ARCHIVE_KIND[a.kind])} <b>${A.esc(a.title)}</b> <span class="muted">· ${a.id} · ${A.esc(A.user(a.by).name)} · ${a.date}</span></div>`).join("") || '<p class="small muted">None yet.</p>'}
            <div class="mt">${App.crosscheckButton(item, "solution")}</div></div>
        </div>
        <div>
          <div class="card"><h2>Approval</h2>
            <div class="small muted">Required: ${need.map((r) => A.role(r).name).join(" + ")}${need.includes("eng_lead") ? " (data/API changes)" : ""}</div>
            ${s.reviewers.map((r) => `<div class="small mt-s">${A.who(r.userId)} ${A.badge(...DEC[r.decision])}</div>`).join("") || '<p class="small muted">Not sent for review.</p>'}
            ${s0 && A.can("solution.edit") && s.status === "draft" ? `<button class="btn sm primary mt" onclick="App.solReview('${A.esc(iid)}')">Request review</button>` : ""}
            ${mine && mine.decision !== "approved" ? `<div class="row mt"><button class="btn sm primary" onclick="App.solDecide('${A.esc(iid)}','approved')">✔ Approve</button><button class="btn sm" onclick="App.solDecide('${A.esc(iid)}','changes')">✎ Request changes</button></div>` : ""}
            <div class="callout small mt-s ${A.gate(item).ok ? "green" : ""}">${item.stage === "solution" ? `Gate: ${A.gate(item).ok ? "✅" : "❌"} ${A.esc(A.gate(item).reason)}` : `Item is at ${A.stage(item.stage).name}.`}</div></div>
          <div class="card mt"><h2>Used later by</h2><div class="small">Breakdown ← AC → solution &amp; estimate<br>QA ← risks<br>Release ← feature flag<br>AI ← parts touched &amp; past incidents</div></div>
        </div>
      </div>`;
  };
  App.solSave = (iid) => {
    const f = document.getElementById("solForm"), item = A.find("items", iid);
    let s = solOf(iid);
    if (!s) { s = { itemId: iid, status: "draft", reviewers: [], acMap: {} }; DB.solutions.push(s); }
    FIELDS.forEach(([k]) => (s[k] = f[k].value.trim()));
    item.acceptance.forEach((a) => (s.acMap[a.id] = f["ac_" + a.id].value.trim()));
    Object.assign(s, { by: A.persona().id, updated: NOW });
    if (s.reviewers.some((r) => r.decision !== "pending")) { s.reviewers.forEach((r) => (r.decision = "pending")); s.status = s.reviewers.length ? "in_review" : "draft"; A.toast("Changed after review — approvals reset"); }
    location.hash = url(item, "solution").slice(1);
  };
  App.solReview = (iid) => {
    const item = A.find("items", iid), s = solOf(iid), need = A.solutionApprovers(item, s);
    const ppl = need.map((r) => DB.users.find((u) => u.roleIds.includes(r) && A.project(item.projectId).memberIds.includes(u.id))).filter(Boolean);
    s.reviewers = ppl.map((u) => ({ userId: u.id, decision: u.id === A.persona().id ? "approved" : "pending", at: NOW }));
    s.status = s.reviewers.every((r) => r.decision === "approved") ? "approved" : "in_review";
    A.toast(`Review requested: ${ppl.map((u) => u.name).join(", ")}`); A.render();
  };
  App.solDecide = (iid, d) => {
    const s = solOf(iid), r = s.reviewers.find((x) => x.userId === A.persona().id);
    Object.assign(r, { decision: d, at: NOW });
    s.status = s.reviewers.every((x) => x.decision === "approved") ? "approved" : "in_review";
    A.toast(d === "approved" ? "Solution approved" : "Changes requested"); A.render();
  };

  // ---------- archive (per item + per project) ----------
  // Line highlights come from the crosscheck of every linked item (AI decides; no manual tags).
  function lineStatus(a) {
    const m = {};
    a.itemIds.forEach((iid) => { const it = A.find("items", iid); if (it) A.crosscheck(it).forEach((r) => { if (r.a.id === a.id && (!m[r.n] || ORDER.indexOf(r.status) < ORDER.indexOf(m[r.n]))) m[r.n] = r.status; }); });
    return m;
  }
  const CX = { ignore: "🙈 Ignore", clarify: "💡 Clarify", focus: "🎯 Focus" };
  const contextList = (a) => `<div class="mt-s"><b class="small">Context notes</b> <span class="small muted">(added later; the text above never changes)</span>
      ${(a.contexts || []).map((c) => `<div class="small mt-s ctx">${A.badge(CX[c.kind])} ${A.esc(c.text)}${c.terms?.length ? ` <span class="muted">· terms: ${c.terms.map(A.esc).join(", ")}</span>` : ""}
        <span class="muted">— ${c.by === "ai" ? `${A.badge("AI", "ai")}${c.acceptedBy ? ` accepted by ${A.esc(A.user(c.acceptedBy).name)}` : ""}` : A.esc(A.user(c.by).name)}, ${c.at}</span></div>`).join("") || '<div class="small muted">None.</div>'}
      ${A.can("archive.add") ? `<form class="row mt-s small" onsubmit="event.preventDefault();App.cxAdd('${a.id}',this)"><select name="kind">${Object.entries(CX).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <input name="text" placeholder="e.g. Ignore the WhatsApp part — other feature / Focus on the queue choice" style="flex:1" required><input name="terms" placeholder="terms to ignore (comma)" style="width:170px"><button class="btn sm">+ Add context</button>
        <button class="btn sm" type="button" onclick="App.cxSuggest('${a.id}')">${A.badge("AI", "ai")} Suggest context</button></form><div id="cxs-${a.id}"></div>` : ""}</div>`;
  const archiveCard = (a, showItems) => { const st = lineStatus(a); return `<div class="card mt-s" id="${a.id}">
      <div class="spread"><div><b>${A.esc(a.title)}</b> <span class="small muted">${a.id} · ${A.esc(A.ARCHIVE_KIND[a.kind])} · ${a.date} · archived by ${A.who(a.by)}</span></div>
        ${a.by === A.persona().id || A.can("admin.manage") ? `<a class="small" href="javascript:App.arDelete('${a.id}')">🗑 delete</a>` : ""}</div>
      <div class="small muted">Participants: ${a.participants.map((u) => A.esc(A.user(u).name)).join(", ")}${a.sourceUrl ? ` · <a href="${A.esc(a.sourceUrl)}" target="_blank">source ↗</a>` : ""}${showItems ? ` · items: ${a.itemIds.map(A.itemLink).join(" ")}` : ""}</div>
      <pre class="archive">${a.content.split("\n").map((t, i) => `<span class="ln">${i + 1}</span><span class="${st[i + 1] && st[i + 1] !== "covered" ? "cc-" + st[i + 1] : ""}" title="${st[i + 1] || ""}">${A.esc(t)}</span>`).join("\n")}</pre>
      <div class="small muted">🔒 Read-only text. Highlights: <span class="cc-conflict">conflict</span> <span class="cc-missing">missing in PRD / solution</span> <span class="cc-open">open question</span> <span class="cc-ignored">ignored</span></div>
      ${contextList(a)}</div>`; };
  App.cxAdd = (id, f) => {
    const a = A.find("archives", id);
    (a.contexts = a.contexts || []).push({ id: "CX-" + Date.now().toString(36), by: A.persona().id, at: NOW, kind: f.kind.value, text: f.text.value.trim(), terms: f.terms.value.split(",").map((x) => x.trim()).filter(Boolean) });
    A.toast("Context added — the archive text itself is unchanged"); A.render();
  };
  // AI context suggestion (prototype): lines mentioning another request/item of the project → propose "ignore".
  App.cxSuggest = (id) => {
    const a = A.find("archives", id), others = [...DB.requests.filter((r) => r.projectId === a.projectId), ...DB.items.filter((i) => i.projectId === a.projectId && !a.itemIds.includes(i.id))];
    const hit = a.content.split("\n").map((t) => ({ t, o: others.find((o) => o.title.split(/\W+/).some((w) => w.length > 6 && t.toLowerCase().includes(w.toLowerCase()) && !A.find("items", a.itemIds[0]).title.toLowerCase().includes(w.toLowerCase()))) })).find((x) => x.o);
    const sug = hit ? { kind: "ignore", terms: [hit.o.title.split(/\W+/).find((w) => w.length > 6 && hit.t.toLowerCase().includes(w.toLowerCase())).toLowerCase()], text: `Off-topic: “${hit.t.trim()}” belongs to ${hit.o.id} (${hit.o.title}). Ignore when checking ${a.itemIds.join(", ")}.` }
      : { kind: "focus", terms: [], text: `Focus on statements that affect ${a.itemIds.map((i) => A.find("items", i).title).join(", ")}.` };
    document.getElementById("cxs-" + id).innerHTML = `<div class="suggest small mt-s">${A.badge("AI", "ai")} ${CX[sug.kind]}: ${A.esc(sug.text)} <button class="btn sm primary" onclick='App.cxAccept("${id}", ${JSON.stringify(JSON.stringify(sug))})'>Accept</button></div>`;
  };
  App.cxAccept = (id, json) => { const a = A.find("archives", id), sug = JSON.parse(json); (a.contexts = a.contexts || []).push({ id: "CX-" + Date.now().toString(36), by: "ai", acceptedBy: A.persona().id, at: NOW, ...sug }); A.toast("AI context accepted"); A.render(); };
  const deletedCard = (a) => `<div class="small muted mt-s">🗑 ${a.id} “${A.esc(a.title)}” deleted by ${A.esc(A.user(a.deletedBy).name)} on ${a.deletedAt}</div>`;

  App.screens.archive = ({ pid, iid }) => {
    const item = A.find("items", iid), all = DB.archives.filter((a) => a.itemIds.includes(iid));
    return `<div class="muted small">${A.itemLink(iid)} › Discussion archive</div>
      <div class="spread"><h1>Discussion archive — ${A.esc(item.title)}</h1>${A.btn("archive.add", "+ Archive a discussion", `location.hash='#/p/${pid}/archive/new?item=${encodeURIComponent(iid)}'`, "primary")}</div>
      <p class="small muted mb">Notes from meetings, Slack and dev discussions about this item. PMT does not host the chat — it keeps the record and checks it against the PRD and solution.</p>
      <div class="card">${App.crosscheckButton(item, A.stagesOf(item).includes("requirement") ? "prd" : "solution")}</div>
      ${all.filter((a) => !a.deleted).map((a) => archiveCard(a)).join("") || '<p class="muted">Nothing archived yet.</p>'}${all.filter((a) => a.deleted).map(deletedCard).join("")}`;
  };

  App.screens.archives = ({ pid, q = "" }) => {
    const hits = q ? A.searchArchives(q, pid) : [];
    const list = DB.archives.filter((a) => a.projectId === pid);
    return `<div class="spread"><h1>Discussion archive — ${A.esc(A.project(pid).name)}</h1>${A.btn("archive.add", "+ Archive a discussion", `location.hash='#/p/${pid}/archive/new'`, "primary")}</div>
      <form class="card row" onsubmit="event.preventDefault();location.hash='/p/${pid}/archives?q='+encodeURIComponent(this.q.value)"><input name="q" value="${A.esc(q)}" placeholder="Was topic X ever discussed? e.g. “30 days”, “rounding”, “Redis”" style="flex:1"><button class="btn primary">Find</button></form>
      ${q ? `<div class="card mt"><h2>${hits.length} match(es) for “${A.esc(q)}”</h2>${hits.map((h) => `<div class="small mt-s">“${A.esc(h.t)}”<div class="muted">${A.cite(h.a, h.n)} · items ${h.a.itemIds.map(A.itemLink).join(" ")}</div></div>`).join("") || '<p class="small muted">Never archived — if it was discussed, nobody saved the notes.</p>'}</div>` : ""}
      ${list.filter((a) => !a.deleted).map((a) => archiveCard(a, true)).join("")}${list.filter((a) => a.deleted).map(deletedCard).join("")}`;
  };

  App.screens.newArchive = ({ pid, item }) => {
    if (!A.can("archive.add")) return `<h1>Archive a discussion</h1><div class="callout">${A.esc(A.whyNot("archive.add"))}</div>`;
    const items = DB.items.filter((i) => i.projectId === pid);
    return `<h1>Archive a discussion — ${A.esc(A.project(pid).name)}</h1>
      <form class="card" id="arForm" style="max-width:820px">
        <div class="grid g2"><label>Source<br><select name="kind" style="width:100%">${Object.entries(A.ARCHIVE_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
          <label>Date<br><input type="date" name="date" value="${NOW}" style="width:100%"></label></div>
        <label class="mt" style="display:block">Title<br><input name="title" required style="width:100%" placeholder="e.g. Subscription pause kickoff"></label>
        <label class="mt" style="display:block">Link to source (Slack thread, recording, doc) — optional<br><input name="sourceUrl" style="width:100%" placeholder="https://deltahq.slack.com/archives/…"></label>
        <div class="mt"><b>Items</b><div class="small">${items.map((i) => `<label style="display:inline-block;margin-right:10px"><input type="checkbox" name="items" value="${A.esc(i.id)}" ${i.id === item ? "checked" : ""}> ${A.esc(i.id)}</label>`).join("")}</div></div>
        <div class="mt"><b>Participants</b><div class="small">${DB.users.filter((u) => A.project(pid).memberIds.includes(u.id)).map((u) => `<label style="display:inline-block;margin-right:10px"><input type="checkbox" name="ppl" value="${u.id}"> ${A.esc(u.name)}</label>`).join("")}</div></div>
        <label class="mt" style="display:block">Notes (full text)<br><textarea name="content" rows="10" required style="width:100%" placeholder="Paste the AI meeting summary or your notes as they are. No tagging needed — the AI crosscheck finds what matters. You can add context notes later (ignore / clarify / focus)."></textarea></label>
        <div class="callout mt small">⚠ <b>Archives cannot be edited after saving</b> — only deleted. Check names, numbers and decisions before you save.
          <label style="display:block" class="mt-s"><input type="checkbox" name="ok"> I have checked the content and it is final.</label></div>
        <div class="row mt"><button class="btn primary">Save archive</button><span class="small muted">Slack import via API is planned (not MVP) — paste the summary + link for now.</span></div>
      </form>`;
  };
  App.after.newArchive = ({ pid, item }) => {
    const f = document.getElementById("arForm");
    if (!f) return;
    f.onsubmit = (e) => {
      e.preventDefault();
      const itemIds = [...f.querySelectorAll("[name=items]:checked")].map((x) => x.value);
      if (!itemIds.length) return A.toast("Choose at least one item");
      if (!f.ok.checked) return A.toast("Tick “I have checked the content” first");
      if (!confirm("Save this archive? It cannot be edited afterwards — only deleted.")) return;
      const id = "AR-" + (DB.archives.length + 1);
      DB.archives.push({ id, projectId: pid, itemIds, kind: f.kind.value, title: f.title.value, date: f.date.value, by: A.persona().id,
        participants: [...f.querySelectorAll("[name=ppl]:checked")].map((x) => x.value), sourceUrl: f.sourceUrl.value.trim(), content: f.content.value });
      A.toast(`${id} archived (read-only)`);
      location.hash = item ? `/p/${pid}/item/${encodeURIComponent(item)}/archive` : `/p/${pid}/archives`;
    };
  };
  App.arDelete = (id) => {
    const a = A.find("archives", id);
    if (!confirm(`Delete ${id} “${a.title}”? The content is removed; a deletion record stays.`)) return;
    Object.assign(a, { deleted: true, deletedBy: A.persona().id, deletedAt: NOW, content: "" });
    A.toast(`${id} deleted`); A.render();
  };
})();
