/* PRD (ADR-018) — written in-app, 1 item = 1 PRD.
 * - Draft autosaves (500 ms debounce). Publishing a draft creates the next version (v1, v2 …) and syncs it to the GitHub Wiki.
 *   Editor history is only undo/redo.
 * - GitHub issue from PRD: "Generate issue" → later "Update issue details" when a newer version is published (e.g. after a rewind).
 *   An amendment (Mode A) is a separate item, so it gets its own PRD, its own wiki page and a new issue linked to v1's.
 * - Review is separate from publish: the author requests review from chosen reviewers (approve.requirement).
 *   All approved → "Publish"; at least one approved → "Force publish" (type "force"); none → cannot publish.
 *   Editing the draft after approvals resets them to pending.
 * - Inline comments (MVP): select text → comment; threads with replies, resolve.
 * - Rich text: headings, bold/italic/underline, highlight, lists, links, tables, images. Prototype: contenteditable + execCommand;
 *   production target: TipTap (MIT core has table / highlight / link / image extensions).
 * - Embeds (multiple): Figma (live view-only iframe), links, images. Diagram block is planned (not MVP).
 * - Export: PDF (print dialog → Save as PDF), Markdown, Word. */
(function () {
  const A = App;
  const NOW = App.today;
  const prdOf = (iid) => DB.prds.find((p) => p.itemId === iid);
  const latest = (p) => p.versions[p.versions.length - 1];
  const hasDraftOf = (p) => p.draftHtml != null && p.draftHtml !== latest(p)?.html;
  const tally = (p) => { const rs = p.review?.reviewers || []; const ok = rs.filter((r) => r.decision === "approved").length; return { rs, ok, all: rs.length > 0 && ok === rs.length }; };
  // Derived status — there is no manual status anymore.
  function statusOf(p) {
    const lv = latest(p), t = tally(p);
    if (hasDraftOf(p) && p.review) return [`In review · ${t.ok}/${t.rs.length} approved`, t.all ? "pass" : "medium"];
    if (hasDraftOf(p)) return [lv ? `Draft (changes after v${lv.v})` : "Draft", "blocked"];
    return lv ? [`Published v${lv.v}${lv.forced ? " (forced)" : ""}`, lv.forced ? "blocked" : "pass"] : ["Empty", "gap"];
  }
  const reviewersFor = (item) => DB.users.filter((u) => A.project(item.projectId).memberIds.includes(u.id) && A.permsOf(u).has("approve.requirement"));
  const DEC = { pending: ["⏳ pending", "skipped"], approved: ["✔ approved", "pass"], changes: ["✎ changes requested", "fail"] };
  const FIGMA_RE = /^https:\/\/(www\.)?figma\.com\/(file|design|proto|board|slides)\/[A-Za-z0-9]+/;
  const figmaEmbedUrl = (url) => `https://www.figma.com/embed?embed_host=delta-pmt&url=${encodeURIComponent(url)}`;
  const base = (iid) => `#/p/${A.find("items", iid).projectId}/item/${encodeURIComponent(iid)}/prd`;
  let timer = null;

  function ensurePrd(item) {
    let p = prdOf(item.id);
    if (!p) {
      const reqs = A.requestsOfItem(item.id);
      p = { id: "PRD-" + item.id, itemId: item.id, review: null, wikiId: null, issue: null, versions: [], comments: [], embeds: [], draftSavedAt: null,
        draftHtml: `<h2>Problem</h2><p>${A.esc(item.log.request?.summary || "")}</p>${reqs.length ? `<p>From requests: ${reqs.map((r) => r.id).join(", ")}</p>` : ""}<h2>Goals</h2><ul><li></li></ul><h2>Acceptance criteria</h2><table><tr><th>ID</th><th>Criterion</th></tr><tr><td>AC1</td><td></td></tr></table><h2>Out of scope</h2><p></p>` };
      DB.prds.push(p);
    }
    return p;
  }

  function embedCard(e, editing) {
    const rm = editing ? ` <a class="small" href="javascript:App.prdRemoveEmbed('${e.id}')">remove</a>` : "";
    if (e.kind === "figma") return `<div class="card mt-s embed"><div class="row" style="justify-content:space-between"><b>🎨 ${A.esc(e.title)}</b><span class="small"><a href="${A.esc(e.url)}" target="_blank">Open in Figma ↗</a>${rm}</span></div>
      <div class="figma-frame" id="fig-${e.id}"><div class="muted small">View-only Figma embed. Viewers need access to the file in Figma (link sharing or team membership).</div>
        <button class="btn sm mt-s" onclick="App.prdLoadFigma('${e.id}')">▶ Load live preview</button></div></div>`;
    if (e.kind === "image") return `<div class="card mt-s embed"><b>🖼 ${A.esc(e.title)}</b>${rm}<div><img src="${A.esc(e.url)}" alt="${A.esc(e.title)}" style="max-width:100%"></div></div>`;
    return `<div class="card mt-s embed">🔗 <a href="${A.esc(e.url)}" target="_blank">${A.esc(e.title)}</a>${rm}</div>`;
  }

  // GitHub issue button: generate → update details when a newer version exists; amendments (Mode A) generate their own issue.
  function issueBox(item, p) {
    const lv = latest(p), root = item.versionOf && prdOf(item.versionOf);
    if (!lv) return '<p class="small muted">Publish a version first.</p>';
    if (!p.issue) return `${A.btn("prd.edit", item.versionOf ? `Generate new issue for v${item.version}` : "Generate GitHub issue", `App.prdIssue('${A.esc(item.id)}')`, "sm primary")}
      ${root?.issue ? `<div class="small muted mt-s">Amendment: a new issue is created and linked to ${A.esc(root.issue.repo)}#${root.issue.number} (v1 keeps its own).</div>` : ""}`;
    const stale = p.issue.syncedVersion < lv.v;
    return `<div class="small">🐙 <span class="mono">${A.esc(p.issue.repo)}#${p.issue.number}</span> · synced from v${p.issue.syncedVersion}${item.rev > 1 ? ` · item rewound (rev ${item.rev})` : ""}</div>
      ${stale ? `<div class="mt-s">${A.btn("prd.edit", `Update issue details (→ v${lv.v})`, `App.prdIssue('${A.esc(item.id)}')`, "sm primary")}</div>` : '<div class="small muted mt-s">Issue is up to date.</div>'}`;
  }

  function commentsBox(p, iid) {
    const open = p.comments.filter((c) => !c.resolved), done = p.comments.filter((c) => c.resolved);
    // Outdated: the commented text no longer exists in the latest version (comment stays visible, not auto-resolved).
    const lv = latest(p), txt = lv ? lv.html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&") : "";
    const outdated = (c) => c.quote && lv && !txt.includes(c.quote);
    const one = (c) => `<div class="card mt-s small ${c.resolved ? "muted" : ""}" id="cm-${c.id}">
        ${c.quote ? `<div><mark>“${A.esc(c.quote)}”</mark> ${outdated(c) ? A.badge(`outdated — text changed in v${lv.v}`, "skipped") : ""}</div>` : ""}<div class="mt-s"><b>${A.who(c.by)}</b> ${A.esc(c.text)} <span class="muted">· ${c.at}</span></div>
        ${c.replies.map((r) => `<div class="mt-s" style="padding-left:10px;border-left:2px solid #e5e7eb"><b>${A.who(r.by)}</b> ${A.esc(r.text)} <span class="muted">· ${r.at}</span></div>`).join("")}
        ${c.resolved ? `<div class="mt-s">✓ resolved · <a href="javascript:App.prdResolve('${A.esc(iid)}','${c.id}',false)">reopen</a></div>`
          : `<form class="row mt-s" onsubmit="event.preventDefault();App.prdReply('${A.esc(iid)}','${c.id}',this.t.value)"><input name="t" placeholder="Reply" style="flex:1"><button class="btn sm">↵</button></form>
             <a href="javascript:App.prdResolve('${A.esc(iid)}','${c.id}',true)">✓ Resolve</a>`}</div>`;
    return `<div class="card mt"><h2>💬 Comments (${open.length} open)</h2>
      <div class="small muted">Select text in the PRD, then <button class="btn sm" onmousedown="event.preventDefault();App.prdComment('${A.esc(iid)}')">💬 Comment on selection</button></div>
      ${open.map(one).join("")}${done.length ? `<details class="mt-s"><summary class="small">${done.length} resolved</summary>${done.map(one).join("")}</details>` : ""}</div>`;
  }

  const TOOLS = [["H2", "formatBlock", "h2"], ["H3", "formatBlock", "h3"], ["¶", "formatBlock", "p"], ["<b>B</b>", "bold"], ["<i>I</i>", "italic"], ["<u>U</u>", "underline"],
    ["🖍 Highlight", "hiliteColor", "#fef08a"], ["• List", "insertUnorderedList"], ["1. List", "insertOrderedList"], ["🔗 Link", "link"], ["▦ Table", "table"], ["🖼 Image", "image"], ["⌫ Clear", "removeFormat"], ["↶", "undo"], ["↷", "redo"]];

  // Highlight comment quotes in the rendered HTML (text-only match, first occurrence, outside tags).
  const withMarks = (html, p) => p.comments.filter((c) => !c.resolved && c.quote).reduce((h, c) => {
    const q = A.esc(c.quote).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return h.replace(new RegExp(`(>[^<]*?)(${q})`), `$1<span class="cmt" title="${A.esc(c.text)}" onclick="document.getElementById('cm-${c.id}').scrollIntoView()">$2</span>`);
  }, html);

  App.screens.prd = ({ pid, iid, edit, v }) => {
    const item = A.find("items", iid);
    if (!item) return "<h1>Item not found</h1>";
    const p0 = prdOf(iid), canEdit = A.can("prd.edit"), editing = edit && canEdit;
    if (!p0 && !editing) return `<div class="muted small">${A.itemLink(iid)} › PRD</div><h1>PRD — ${A.esc(item.title)}</h1>
      <div class="card"><p class="muted">No PRD yet.</p>${A.btn("prd.edit", "✎ Write PRD", `location.hash='${base(iid)}?edit=1'`, "primary")}</div>`;
    const p = p0 || ensurePrd(item), [stl, stc] = statusOf(p), lv = latest(p);
    const hasDraft = hasDraftOf(p);
    const showDraft = v === "draft" || (!v && hasDraft && (!lv || p.review));
    const shown = showDraft ? null : v ? p.versions.find((x) => x.v === +v) : lv;
    if (editing && !hasDraft) p.draftHtml = lv ? lv.html : "";
    const wiki = p.wikiId && A.find("wikiPages", p.wikiId);
    const root = item.versionOf;
    return `
      <div class="muted small">${A.itemLink(iid)} › PRD</div>
      <div class="row" style="justify-content:space-between"><h1>PRD — ${A.esc(item.title)} ${A.badge(stl, stc)}</h1>
        <div class="row">
          ${editing ? `<span class="small muted" id="saveState">${p.draftSavedAt ? "Draft saved " + p.draftSavedAt : "Draft"}</span>
              <a class="btn primary" href="${base(iid)}?v=draft">Done editing</a>${lv ? `<button class="btn" onclick="App.prdDiscard('${A.esc(iid)}')">Discard draft</button>` : ""}`
            : `${A.btn("prd.edit", hasDraft ? "✎ Continue draft" : "✎ Edit", `location.hash='${base(iid)}?edit=1'`)}
               ${lv ? `<select onchange="App.prdExport('${A.esc(iid)}', this.value, ${shown?.v || 0}); this.value=''"><option value="">⬇ Download as…</option><option value="pdf">PDF</option><option value="md">Markdown (.md)</option><option value="doc">Word (.doc)</option></select>` : ""}`}
        </div></div>
      <div class="small muted mb">${p.id}${root ? ` · amendment of ${A.itemLink(root)} (own PRD, wiki page and issue)` : ""} · requests: ${A.requestsOfItem(iid).map((r) => A.requestLink(r.id)).join(" ") || "—"}</div>
      ${!editing && (p.versions.length || hasDraft) ? `<div class="row mb small">Version: ${p.versions.map((x) => `<a class="btn sm ${shown && x.v === shown.v ? "primary" : ""}" href="${base(iid)}?v=${x.v}">v${x.v}${x.forced ? " ⚠" : ""}</a>`).join("")}
        ${hasDraft ? `<a class="btn sm ${showDraft ? "primary" : ""}" href="${base(iid)}?v=draft">Draft${p.review ? " (in review)" : ""}</a>` : ""}
        <span class="muted">· ${shown ? `v${shown.v} published by ${A.who(shown.by)} on ${shown.at} — ${A.esc(shown.note || "")}${shown.forced ? " · ⚠ force-published" : ""}` : `unpublished draft · saved ${p.draftSavedAt || "—"}`}</span></div>` : ""}
      <div class="pcols">
        <div>
          <div class="card">
            ${editing ? `<div class="row prd-toolbar">${TOOLS.map(([l, c, val]) => `<button class="btn sm" type="button" onmousedown="event.preventDefault();App.prdCmd('${c}','${val || ""}')">${l}</button>`).join("")}</div>` : ""}
            <div id="prdBody" class="prd-body ${editing ? "editing" : ""}" ${editing ? 'contenteditable="true"' : ""}>${editing ? p.draftHtml : showDraft ? withMarks(p.draftHtml, p) : shown ? withMarks(shown.html, p) : '<p class="muted">Nothing here yet.</p>'}</div>
          </div>
          ${commentsBox(p, iid)}
          <div class="card mt"><h2>🗂 Crosscheck</h2><p class="small muted">Compare archived meeting / Slack notes with this PRD (and the solution).</p>${App.crosscheckButton ? App.crosscheckButton(item) : ""}</div>
        </div>
        <div>
          ${reviewBox(item, p)}
          <div class="card mt"><h2>GitHub</h2>
            <div class="small">📄 Wiki: ${wiki ? `${A.ref(wiki.id)} <span class="muted">· synced on publish</span>` : '<span class="muted">created on first publish</span>'}</div>
            <div class="mt-s">${issueBox(item, p)}</div></div>
          <div class="card mt"><h2>Designs & references (${p.embeds.length})</h2>
            ${p.embeds.map((e) => embedCard(e, editing)).join("") || '<p class="muted small">None yet.</p>'}
            ${editing ? `<div class="mt"><select id="embKind"><option value="figma">🎨 Figma</option><option value="link">🔗 Link</option><option value="image">🖼 Image URL</option><option disabled>📐 Diagram — planned (not MVP)</option></select>
              <input id="embTitle" placeholder="Title" style="width:100%" class="mt-s"><input id="embUrl" placeholder="https://www.figma.com/design/…" style="width:100%" class="mt-s">
              <button class="btn sm mt-s" type="button" onclick="App.prdAddEmbed('${A.esc(iid)}')">+ Add</button> <span class="small" id="embErr" style="color:var(--fail)"></span></div>` : ""}
          </div>
        </div>
      </div>`;
  };

  // Review & publish card. Review is separate from publish.
  function reviewBox(item, p) {
    const iid = A.esc(item.id), me = A.persona(), t = tally(p), next = (latest(p)?.v || 0) + 1;
    if (!hasDraftOf(p)) return `<div class="card"><h2>Review & publish</h2><p class="small muted">No unpublished changes. ${A.can("prd.edit") ? "Edit to start a new draft." : ""}</p>${shownReviews(latest(p))}</div>`;
    if (!p.review) return `<div class="card"><h2>Review & publish</h2>
      ${A.can("prd.edit") ? `<div class="small">Request review from:</div>
        <div class="small mt-s">${reviewersFor(item).filter((u) => u.id !== me.id).map((u) => `<label style="display:block"><input type="checkbox" name="rv" value="${u.id}" ${u.id === item.requesterId ? "checked" : ""}> ${A.esc(u.name)} <span class="muted">— ${u.roleIds.map((r) => A.role(r).name).join(", ")}${u.id === item.requesterId ? " · requester" : ""}</span></label>`).join("") || '<span class="muted">No other member can approve PRDs.</span>'}</div>
        <button class="btn sm primary mt-s" onclick="App.prdRequestReview('${iid}')">Request review</button>
        <p class="small muted mt-s">Only members with “Approve PRD” permission are listed. Publishing needs at least one approval.</p>`
      : `<p class="small muted">Draft in progress — not yet sent for review.</p>`}</div>`;
    const mine = p.review.reviewers.find((r) => r.userId === me.id);
    const pub = !A.can("prd.edit") ? "" : t.all ? `<button class="btn primary" onclick="App.prdPublish('${iid}')">Publish v${next}</button>`
      : t.ok ? `<button class="btn" style="border-color:var(--fail);color:var(--fail)" onclick="App.prdPublish('${iid}')">Force publish v${next}</button><div class="small muted mt-s">${t.ok}/${t.rs.length} approved — type “force” to publish anyway.</div>`
      : `<button class="btn" disabled>Publish v${next}</button><div class="small muted mt-s">Needs at least one approval.</div>`;
    return `<div class="card"><h2>Review & publish</h2>
      <div class="small muted">Requested by ${A.who(p.review.requestedBy)} · ${p.review.at}</div>
      ${p.review.reviewers.map((r) => `<div class="small mt-s">${A.who(r.userId)} ${A.badge(...DEC[r.decision])}${r.note ? ` <span class="muted">“${A.esc(r.note)}”</span>` : ""}</div>`).join("")}
      ${mine && mine.decision !== "approved" ? `<div class="row mt"><button class="btn sm primary" onclick="App.prdDecide('${iid}','approved')">✔ Approve</button><button class="btn sm" onclick="App.prdDecide('${iid}','changes')">✎ Request changes</button></div>` : ""}
      ${A.can("prd.edit") ? `<div class="mt"><a class="small" href="javascript:App.prdCancelReview('${iid}')">cancel review</a></div>` : ""}
      <div class="mt">${pub}</div></div>`;
  }
  const shownReviews = (ver) => ver?.reviews?.length ? `<div class="small mt-s">v${ver.v} approved by ${ver.reviews.filter((r) => r.decision === "approved").map((r) => A.who(r.userId)).join(", ")}${ver.forced ? ` · ${A.badge("force-published", "blocked")}` : ""}</div>` : "";

  App.prdRequestReview = (iid) => {
    const ids = [...document.querySelectorAll("[name=rv]:checked")].map((x) => x.value);
    if (!ids.length) return A.toast("Choose at least one reviewer");
    const p = prdOf(iid);
    p.review = { requestedBy: A.persona().id, at: NOW, reviewers: ids.map((u) => ({ userId: u, decision: "pending" })) };
    A.toast(`Review requested from ${ids.map((u) => A.user(u).name).join(", ")}`); A.render();
  };
  App.prdDecide = (iid, d) => {
    const r = prdOf(iid).review.reviewers.find((x) => x.userId === A.persona().id);
    const note = d === "changes" ? prompt("What needs to change?") : "";
    if (d === "changes" && !note) return;
    Object.assign(r, { decision: d, at: NOW, note });
    A.toast(d === "approved" ? "PRD approved" : "Changes requested"); A.render();
  };
  App.prdCancelReview = (iid) => { prdOf(iid).review = null; A.render(); };

  // Autosave the draft 500 ms after the last keystroke.
  App.after.prd = ({ iid, edit }) => {
    const body = document.getElementById("prdBody");
    if (!edit || !body || !body.isContentEditable) return;
    body.oninput = () => {
      clearTimeout(timer);
      document.getElementById("saveState").textContent = "Saving…";
      timer = setTimeout(() => {
        const p = prdOf(iid); p.draftHtml = body.innerHTML; p.draftSavedAt = NOW + " " + new Date().toTimeString().slice(0, 8);
        // Content changed after approvals → reviewers must look again.
        if (p.review?.reviewers.some((r) => r.decision !== "pending")) { p.review.reviewers.forEach((r) => Object.assign(r, { decision: "pending", note: "" })); A.toast("Draft changed — review reset to pending"); }
        document.getElementById("saveState").textContent = "Draft saved " + p.draftSavedAt;
      }, 500);
    };
  };

  // ---------- editor commands ----------
  App.prdCmd = (c, v) => {
    if (c === "link") { const u = prompt("Link URL"); if (u) document.execCommand("createLink", false, u); return; }
    if (c === "image") { const u = prompt("Image URL"); if (u) document.execCommand("insertImage", false, u); return; }
    if (c === "table") { const n = +prompt("Rows × 3 columns — how many rows?", "3") || 3;
      document.execCommand("insertHTML", false, `<table><tr><th>Column</th><th>Column</th><th>Column</th></tr>${"<tr><td>&nbsp;</td><td></td><td></td></tr>".repeat(n)}</table><p></p>`); return; }
    document.execCommand(c, false, v ? (c === "formatBlock" ? `<${v}>` : v) : null);
  };
  const flush = (p) => { const b = document.getElementById("prdBody"); if (b?.isContentEditable) p.draftHtml = b.innerHTML; };

  // Publish: draft → next version, sync wiki page. Amendments get their own wiki page linked to v1's.
  App.prdPublish = (iid) => {
    const item = A.find("items", iid), p = ensurePrd(item);
    flush(p);
    const t = tally(p);
    if (!t.ok) return A.toast("Needs at least one approval");
    if (!t.all && prompt(`Only ${t.ok}/${t.rs.length} reviewers approved. Type "force" to publish anyway.`) !== "force") return A.toast("Not published");
    const note = prompt("What changed in this version?", p.versions.length ? "" : "Initial PRD");
    if (note === null) return;
    const v = (latest(p)?.v || 0) + 1, me = A.persona();
    p.versions.push({ v, by: me.id, at: NOW, note, html: p.draftHtml, forced: !t.all, reviews: p.review.reviewers.map((r) => ({ ...r })) });
    p.draftHtml = null; p.draftSavedAt = null; p.review = null;
    const text = p.versions[p.versions.length - 1].html.replace(/<\/(p|h\d|li|tr)>/g, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
    const rootP = item.versionOf && prdOf(item.versionOf);
    if (!p.wikiId) {
      p.wikiId = "W-PRD-" + iid;
      DB.wikiPages.push({ id: p.wikiId, projectId: item.projectId, repoId: DB.repos.find((r) => r.projectId === item.projectId && r.wiki)?.id, category: "prd", title: "", updated: NOW, by: me.id, body: "" });
    }
    const w = A.find("wikiPages", p.wikiId);
    Object.assign(w, { title: `PRD — ${item.title}${item.versionOf ? ` v${item.version} (${iid})` : ""}`, updated: NOW, by: me.id,
      body: `${rootP?.wikiId ? `Amendment of ${item.versionOf} — previous version: ${rootP.wikiId}\n` : ""}PRD version ${v}: ${note}\n${text}` });
    if (rootP?.wikiId) { const rw = A.find("wikiPages", rootP.wikiId); if (rw && !rw.body.includes(p.wikiId)) rw.body = `Newer version: ${iid} → ${p.wikiId}\n` + rw.body; }
    A.toast(`v${v} published · wiki ${p.wikiId} synced${p.issue ? " · issue now outdated" : ""}`);
    location.hash = base(iid).slice(1);
  };
  App.prdDiscard = (iid) => { const p = prdOf(iid); p.draftHtml = null; p.draftSavedAt = null; location.hash = base(iid).slice(1); };
  App.prdIssue = (iid) => {
    const item = A.find("items", iid), p = prdOf(iid), lv = latest(p);
    if (p.issue) { p.issue.syncedVersion = lv.v; A.toast(`Issue #${p.issue.number} updated with PRD v${lv.v}`); }
    else {
      const repo = DB.repos.find((r) => r.projectId === item.projectId)?.fullName || "deltahq/repo";
      const rootIssue = item.versionOf && prdOf(item.versionOf)?.issue;
      p.issue = { repo, number: 420 + DB.prds.filter((x) => x.issue).length, syncedVersion: lv.v, linkedTo: rootIssue?.number };
      A.toast(`Issue ${repo}#${p.issue.number} created from PRD v${lv.v}${rootIssue ? ` · linked to #${rootIssue.number}` : ""}`);
    }
    A.render();
  };

  // ---------- comments ----------
  App.prdComment = (iid) => {
    const sel = window.getSelection(), quote = sel ? sel.toString().trim() : "";
    if (!quote || !document.getElementById("prdBody").contains(sel.anchorNode)) return A.toast("Select some text in the PRD first");
    const text = prompt(`Comment on “${quote.slice(0, 60)}”`);
    if (!text) return;
    const p = prdOf(iid); flush(p);
    p.comments.push({ id: "CM-" + Date.now().toString(36), quote: quote.slice(0, 120), by: A.persona().id, at: NOW, text, resolved: false, replies: [] });
    A.render();
  };
  App.prdReply = (iid, cid, text) => { if (!text) return; const p = prdOf(iid); flush(p); p.comments.find((c) => c.id === cid).replies.push({ by: A.persona().id, at: NOW, text }); A.render(); };
  App.prdResolve = (iid, cid, on) => { const p = prdOf(iid); flush(p); p.comments.find((c) => c.id === cid).resolved = on; A.render(); };

  // ---------- embeds ----------
  App.prdAddEmbed = (iid) => {
    const kind = document.getElementById("embKind").value, url = document.getElementById("embUrl").value.trim(), title = document.getElementById("embTitle").value.trim() || url;
    const err = kind === "figma" && !FIGMA_RE.test(url) ? "Not a Figma file/design/prototype link" : !/^https?:\/\//.test(url) ? "Enter a full URL" : "";
    document.getElementById("embErr").textContent = err;
    if (err) return;
    const p = ensurePrd(A.find("items", iid));
    flush(p);
    p.embeds.push({ id: "E" + Date.now(), kind, title, url });
    A.render();
  };
  App.prdRemoveEmbed = (eid) => { DB.prds.forEach((p) => { flush(p); p.embeds = p.embeds.filter((e) => e.id !== eid); }); A.render(); };
  App.prdLoadFigma = (eid) => {
    const e = DB.prds.flatMap((p) => p.embeds).find((x) => x.id === eid);
    document.getElementById("fig-" + eid).innerHTML = `<iframe src="${figmaEmbedUrl(e.url)}" style="width:100%;height:420px;border:1px solid #e5e7eb;border-radius:8px" allowfullscreen></iframe>`;
  };

  // ---------- export ----------
  function toMd(node) {
    const kids = () => [...node.childNodes].map(toMd).join("");
    if (node.nodeType === 3) return node.textContent;
    const t = node.tagName?.toLowerCase();
    if (t === "h1") return `# ${kids()}\n\n`; if (t === "h2") return `## ${kids()}\n\n`; if (t === "h3") return `### ${kids()}\n\n`;
    if (t === "p" || t === "div") return `${kids()}\n\n`;
    if (t === "b" || t === "strong") return `**${kids()}**`; if (t === "i" || t === "em") return `*${kids()}*`;
    if (t === "mark" || (t === "span" && node.style?.backgroundColor)) return `==${kids()}==`;
    if (t === "a") return `[${kids()}](${node.getAttribute("href")})`;
    if (t === "img") return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src")})`;
    if (t === "br") return "\n";
    if (t === "ul" || t === "ol") return [...node.children].map((li, i) => `${t === "ol" ? i + 1 + "." : "-"} ${toMd(li).trim()}`).join("\n") + "\n\n";
    if (t === "table") {
      const rows = [...node.querySelectorAll("tr")].map((tr) => "| " + [...tr.children].map((c) => toMd(c).trim().replace(/\|/g, "\\|")).join(" | ") + " |");
      return rows.length ? [rows[0], "|" + " --- |".repeat(rows[0].split(" | ").length), ...rows.slice(1)].join("\n") + "\n\n" : "";
    }
    return kids();
  }
  function download(name, mime, content) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; a.click();
  }
  App.prdExport = (iid, fmt, v) => {
    if (!fmt) return;
    const item = A.find("items", iid), p = prdOf(iid), ver = p.versions.find((x) => x.v === v) || latest(p);
    const emb = p.embeds.map((e) => `<li>${e.kind}: <a href="${A.esc(e.url)}">${A.esc(e.title)}</a></li>`).join("");
    const doc = `<h1>PRD — ${A.esc(item.title)} (${A.esc(iid)}) v${ver.v}</h1>${ver.html}${emb ? `<h2>Designs & references</h2><ul>${emb}</ul>` : ""}`;
    const css = "body{font-family:Arial,sans-serif;font-size:11pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}mark{background:#fef08a}";
    const file = `${iid}-PRD-v${ver.v}`;
    if (fmt === "md") { const d = document.createElement("div"); d.innerHTML = doc; download(`${file}.md`, "text/markdown", toMd(d).replace(/\n{3,}/g, "\n\n")); }
    if (fmt === "doc") download(`${file}.doc`, "application/msword", `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css}</style></head><body>${doc}</body></html>`);
    if (fmt === "pdf") { const w = window.open("", "_blank"); w.document.write(`<html><head><title>${file}</title><style>${css}</style></head><body>${doc}</body></html>`); w.document.close(); w.focus(); w.print(); }
  };

  // Compact PRD summary for the Requirement stage card and the PRD panel.
  App.prdBlock = (item) => {
    const p = prdOf(item.id), url = base(item.id);
    if (!p) return `<div class="prd-block"><b>📝 PRD</b> ${A.badge("not written", "gap")}<div class="mt-s">${A.btn("prd.edit", "✎ Write PRD", `location.hash='${url}?edit=1'`, "sm primary")}
      <span class="small muted">Starts from a template filled with the linked requests.</span></div></div>`;
    const lv = latest(p), [stl, stc] = statusOf(p), draft = hasDraftOf(p) && !p.review;
    const open = p.comments.filter((c) => !c.resolved).length, figma = p.embeds.filter((e) => e.kind === "figma").length;
    const ac = lv ? (lv.html.match(/AC\d+/g) || []).filter((x, i, a) => a.indexOf(x) === i).length : 0;
    const issue = p.issue ? (p.issue.syncedVersion < (lv?.v || 0) ? A.badge(`issue #${p.issue.number} outdated (v${p.issue.syncedVersion})`, "blocked") : A.badge(`issue #${p.issue.number} ✓`, "pass")) : A.badge("no issue");
    return `<div class="prd-block">
      <div class="spread"><div><b>📝 <a href="${url}">${p.id}</a></b> ${A.badge(stl, stc)} ${lv ? A.badge("v" + lv.v) : ""} ${draft ? A.badge("unpublished draft", "blocked") : ""}</div>
        <div class="row">${A.btn("prd.edit", draft ? "✎ Continue draft" : "✎ Edit", `location.hash='${url}?edit=1'`, "sm")}<a class="btn sm primary" href="${url}">Open PRD →</a></div></div>
      ${lv ? `<div class="small muted mt-s">v${lv.v} by ${A.who(lv.by)} · ${lv.at} — ${A.esc(lv.note || "")}</div>` : '<div class="small muted mt-s">Draft only — not published yet.</div>'}
      <div class="row small mt-s">${ac ? `<span>✅ ${ac} acceptance criteria</span>` : ""}${figma ? `<span>🎨 ${figma} Figma</span>` : ""}<span>💬 ${open} open comment${open === 1 ? "" : "s"}</span>
        <span>📄 ${p.wikiId ? `wiki ${A.ref(p.wikiId)}` : "wiki on publish"}</span>${issue}</div>
      ${A.requestsOfItem(item.id).length ? `<div class="small mt-s">📥 ${A.requestsOfItem(item.id).map((r) => A.requestLink(r.id)).join(" ")}</div>` : ""}
    </div>`;
  };

  App.prdOf = prdOf;
})();
