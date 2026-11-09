/* Files — explorer over all resources (uploaded, external files, web links), detail with
 * two-layer access + "used in", and the add flow with the knowledge / AI-readable check (ADR-009). */
(function () {
  const A = App;
  const KIND = { uploaded: "Uploaded", external_file: "External file", web_link: "Web link" };
  const fmtSize = (b) => (b ? (b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB") : "—");

  App.screens.files = ({ pid, kind, ks, q = "" }) => {
    const base = pid ? `/p/${pid}/files` : "/files";
    const qs = (o) => "?" + new URLSearchParams(Object.fromEntries(Object.entries({ kind, ks, q, ...o }).filter(([, v]) => v))).toString();
    const list = DB.resources.filter((r) => (!pid || r.projectId === pid || r.projectId === null) && (!kind || r.kind === kind) &&
      (!ks || A.knowledgeStatus(r) === ks) && (!q || r.title.toLowerCase().includes(q.toLowerCase())));
    const needs = DB.resources.filter((r) => A.knowledgeStatus(r) === "needs_ai_version").length;
    return `
      <div class="spread mb"><div><h1>${pid ? A.esc(A.project(pid).name) + " files" : "Files"}</h1>
        <div class="muted small">Every file & link in Delta PMT. Everyone can see and click; opening content depends on the owner's access setting and the storage provider.</div></div>
        <a class="btn primary" href="#/files/new">+ Add file / link</a></div>
      ${needs ? `<div class="callout red small mb">${needs} knowledge file(s) are not AI-readable and have no AI-readable version yet. <a href="#${base}${qs({ ks: "needs_ai_version" })}">Show</a></div>` : ""}
      <div class="row mb">
        <form class="row" onsubmit="event.preventDefault();location.hash='${base}?q='+encodeURIComponent(this.q.value)"><input name="q" value="${A.esc(q)}" placeholder="Search files…" /></form>
        <a class="btn sm ${!kind ? "primary" : ""}" href="#${base}${qs({ kind: "" })}">All kinds</a>
        ${Object.entries(KIND).map(([k, v]) => `<a class="btn sm ${kind === k ? "primary" : ""}" href="#${base}${qs({ kind: k })}">${A.KIND_ICON[k]} ${v}</a>`).join("")}
        <span class="muted small">Knowledge:</span>
        ${["ready", "needs_ai_version", "not_knowledge", "undecided"].map((k) => `<a class="btn sm ${ks === k ? "primary" : ""}" href="#${base}${qs({ ks: ks === k ? "" : k })}">${k.replace(/_/g, " ")}</a>`).join("")}
      </div>
      <div class="card"><table>
        <tr><th>Name</th><th>Kind / provider</th><th>Type</th><th>Used in</th><th>Access</th><th>Knowledge</th><th>Owner</th></tr>
        ${list.map((r) => { const acc = A.resourceAccess(r);
          return `<tr><td>${A.resLink(r)}${r.companionOf ? `<div class="small muted">AI version of ${A.resLink(A.find("resources", r.companionOf))}</div>` : ""}
              <div class="small muted">${r.projectId ? A.esc(A.project(r.projectId).name) : "Company-wide"}</div></td>
            <td class="small">${KIND[r.kind]}<br>${A.esc(A.find("resourceProviders", r.provider).name)}</td>
            <td class="small">${A.esc(A.fileType(r.fileType).name)}</td>
            <td class="small">${A.linksOf(r.id).length} place(s)</td>
            <td class="small">${r.access === "restricted" ? "🔒 restricted" : r.access === "inherit" ? "↳ inherit" : "🌐 anyone in app"}${acc.ok ? "" : `<br><span style="color:var(--fail)">you: no access</span>`}${r.health === "broken" ? "<br>" + A.badge("broken link", "fail") : ""}</td>
            <td>${A.ksBadge(r)}</td><td class="small">${A.who(r.ownerId)}</td></tr>`; }).join("") || '<tr><td class="muted">No files.</td></tr>'}
      </table></div>`;
  };

  App.screens.resource = ({ rid }) => {
    const r = A.find("resources", rid);
    if (!r) return "<p>File not found.</p>";
    const acc = A.resourceAccess(r), ft = A.fileType(r.fileType), status = A.knowledgeStatus(r), comp = A.companionOf(r.id);
    const isOwner = r.ownerId === A.persona().id;
    return `
      <div class="muted small">${KIND[r.kind]} · ${A.esc(A.find("resourceProviders", r.provider).name)} · ${A.esc(ft.name)} · added ${r.created} by ${A.who(r.ownerId)}</div>
      <h1>${A.KIND_ICON[r.kind]} ${A.esc(r.title)}</h1>
      ${r.note ? `<p class="small muted">${A.esc(r.note)}</p>` : ""}
      <div class="grid" style="grid-template-columns:3fr 2fr">
        <div>
          <div class="card mb"><h2>Preview</h2>
            ${acc.ok ? `<div class="preview">${A.KIND_ICON[r.kind]} ${A.esc(ft.name)} preview (mock)<div class="small mono muted">${A.esc(r.previewUrl || r.url)}</div></div>
              <div class="row mt"><a class="btn primary" href="#" onclick="App.toast('Prototype: opens ${A.esc(r.url)}');return false">Open ↗</a></div>`
              : `<div class="preview locked">🔒 ${A.esc(acc.reason)}</div>
                 <div class="row mt">${!acc.internal ? `<button class="btn" onclick="App.toast('Access request sent to ${A.esc(A.user(r.ownerId).name)}')">Request access</button>` : ""}<span class="small muted mono">${A.esc(r.url)}</span></div>`}
          </div>
          <div class="card mb"><h2>Used in (${A.linksOf(r.id).length})</h2>
            <table>${A.linksOf(r.id).map((l) => `<tr><td>${A.targetLabel(l)}</td><td>${A.badge(l.relation)}</td><td class="small">${A.isKnowledgeArea(l.targetType, l.targetId) ? A.badge("knowledge area", "ai") : ""}</td><td class="small muted">${A.who(l.by)} · ${l.at}</td></tr>`).join("") || '<tr><td class="muted small">Not linked anywhere.</td></tr>'}</table>
          </div>
        </div>
        <div>
          <div class="card mb"><h2>Access</h2>
            <table class="small">
              <tr><th>Metadata & link</th><td>🌐 Visible to everyone in app</td></tr>
              <tr><th>General access</th><td>${A.accessLabel(r)}</td></tr>
              <tr><th>Grants</th><td>${(r.grants || []).map((g) => `${g.userId ? A.who(g.userId) : "role " + A.esc(A.role(g.roleId).name)} · ${g.level}`).join("<br>") || "—"}</td></tr>
              <tr><th>You (internal)</th><td>${acc.internal ? "✅ allowed" : "❌ not granted"}</td></tr>
              <tr><th>You (provider)</th><td>${acc.external ? "✅ ok" : "❌ " + A.esc(acc.reason)}</td></tr>
            </table>
            ${isOwner ? `<button class="btn sm mt" onclick="App.toast('Prototype: share dialog (users, roles, general access)')">Share…</button>` : ""}
          </div>
          <div class="card mb ${status === "needs_ai_version" ? "" : "ai-panel"}"><h2>Knowledge ${A.ksBadge(r)}</h2>
            <p class="small">File type <b>${A.esc(ft.name)}</b> is ${ft.aiReadable ? "AI-readable ✅" : "not AI-readable ❌"}.</p>
            ${status === "needs_ai_version" ? `<div class="callout red small">This file is a knowledge source but AI cannot read it. Upload an AI-readable version (e.g. PDF export, transcript).
              <div class="mt-s"><a class="btn sm primary" href="#/files/new?companion=${r.id}">Upload AI-readable version</a></div></div>` : ""}
            ${comp ? `<p class="small">AI-readable version: ${A.resLink(comp)}</p>` : ""}
            ${status === "undecided" ? `<p class="small">Not linked to a knowledge area. Use as knowledge source?</p>
              <button class="btn sm" onclick="App.screens._setKS('${r.id}',true)">Yes</button> <button class="btn sm" onclick="App.screens._setKS('${r.id}',false)">No</button>` : ""}
          </div>
          <div class="card"><h2>Storage</h2><table class="small">
            <tr><th>URL</th><td class="mono">${A.esc(r.url)}</td></tr>
            ${r.storage ? `<tr><th>Bucket</th><td class="mono">${A.esc(r.storage.bucket)} / ${A.esc(r.storage.key)} (${A.esc(r.storage.region)})</td></tr>` : ""}
            <tr><th>Size</th><td>${fmtSize(r.size)}</td></tr><tr><th>Health</th><td>${A.badge(r.health, r.health === "ok" ? "pass" : "fail")}</td></tr></table></div>
        </div>
      </div>`;
  };

  App.screens._setKS = (rid, v) => { A.find("resources", rid).knowledgeSource = v; A.toast(v ? "Marked as knowledge source — AI-readability checked" : "Not a knowledge source — no check needed"); A.render(); };

  // Attach targets (current project).
  function targetOptions() {
    const pid = A.state.projectId, opts = [];
    DB.items.filter((i) => i.projectId === pid).forEach((i) => {
      opts.push([`item|${i.id}`, `${i.id} ${i.title}`]);
      A.stagesOf(i).forEach((s) => opts.push([`item_stage|${i.id}/${s}`, `  ↳ ${i.id} · ${A.stage(s).name}`]));
    });
    DB.incidents.filter((x) => x.projectId === pid).forEach((x) => opts.push([`incident|${x.id}`, `Incident ${x.id}`]));
    DB.wikiPages.filter((w) => w.projectId === pid || !w.projectId).forEach((w) => opts.push([`wiki_page|${w.id}`, `Wiki: ${w.title}`]));
    DB.tasks.filter((t) => t.projectId === pid).forEach((t) => opts.push([`task|${t.id}`, `Task: ${t.title}`]));
    return opts;
  }

  App.screens.newResource = ({ tt, tid, companion }) => {
    const comp = companion && A.find("resources", companion);
    const pre = tt ? `${tt}|${tid}` : "";
    return `
      <h1>${comp ? `AI-readable version of “${A.esc(comp.title)}”` : "Add file / link"}</h1>
      <form class="card" id="resForm" style="max-width:760px">
        <div class="grid g3">
          <label>Kind<br><select name="kind" style="width:100%">${comp ? `<option value="uploaded">📎 Upload</option>` : `<option value="uploaded">📎 Upload</option><option value="external_file">☁ External file</option><option value="web_link">🔗 Web link</option>`}</select></label>
          <label>Provider<br><select name="provider" style="width:100%"></select></label>
          <label>File type<br><select name="fileType" style="width:100%">${DB.fileTypes.filter((f) => !comp || f.aiReadable).map((f) => `<option value="${f.id}">${f.name}${f.aiReadable ? "" : " (not AI-readable)"}</option>`).join("")}</select></label>
        </div>
        <label class="mt" style="display:block">Title<br><input name="title" required style="width:100%" /></label>
        <label class="mt" style="display:block" id="urlRow">URL<br><input name="url" style="width:100%" placeholder="https://… (manual links, incl. GitHub, are not validated)" /></label>
        <label class="mt" style="display:block" id="fileRow">File<br><input type="file" name="file" /></label>

        ${comp ? "" : `<div class="grid g2 mt">
          <label>Attach to<br><select name="target" style="width:100%"><option value="">— none —</option>${targetOptions().map(([v, l]) => `<option value="${v}" ${v === pre ? "selected" : ""}>${A.esc(l)}</option>`).join("")}</select></label>
          <label>Relation<br><select name="relation" style="width:100%">${["attachment", "evidence", "spec", "design", "source"].map((x) => `<option>${x}</option>`).join("")}</select></label>
        </div>
        <div class="grid g2 mt">
          <label>General access<br><select name="access" style="width:100%"><option value="inherit">↳ Inherit from project (default)</option><option value="anyone_in_app">🌐 Anyone in app can open</option><option value="restricted">🔒 Restricted — only people I add</option></select></label>
          <label id="grantRow">Grant access to<br><select name="grants" multiple size="4" style="width:100%">${DB.roles.map((r) => `<option value="role:${r.id}">Role: ${r.name}</option>`).join("")}${DB.users.map((u) => `<option value="user:${u.id}">${u.name}</option>`).join("")}</select></label>
        </div>
        <div class="card mt" id="ksBox"></div>`}
        <div class="mt" id="policyBox"></div>
        <div class="mt"><button class="btn primary">Save</button></div>
      </form>`;
  };

  App.after.newResource = ({ companion }) => {
    const f = document.getElementById("resForm");
    if (!f) return;
    const sync = () => {
      f.provider.innerHTML = DB.resourceProviders.filter((p) => p.kind === f.kind.value).map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
      document.getElementById("fileRow").style.display = f.kind.value === "uploaded" ? "" : "none";
      document.getElementById("urlRow").style.display = f.kind.value === "uploaded" ? "none" : "";
      if (companion) { document.getElementById("policyBox").innerHTML = ""; return; }
      document.getElementById("grantRow").style.display = f.access.value === "anyone_in_app" ? "none" : "";
      // Project file policy (ADR-010): Delta PMT is the source of truth; external/uploads are the exception.
      const pol = A.project(A.state.projectId).filePolicy, ft = f.fileType.value;
      const violation = f.kind.value === "uploaded" ? (!pol.allowUploads ? "Uploads are disabled for this project" : !pol.allowedUploadTypes.includes(ft) ? `Uploading ${A.fileType(ft).name} is not allowed (allowed: ${pol.allowedUploadTypes.join(", ")})` : "")
        : !pol.allowExternalLinks ? "External links are disabled for this project" : "";
      document.getElementById("policyBox").innerHTML = violation ? `<div class="callout red small">⛔ ${violation}. Policy is set per project in Backoffice → Projects.</div>`
        : ft === "png" ? "" : `<div class="callout small">💡 Prefer keeping this inside Delta PMT (rich text, built-in flowchart) so it stays the source of truth. External files/links are for things we don't provide yet (e.g. complex ERD).</div>`;
      f.dataset.violation = violation;
      // Knowledge flow (ADR-009 §4)
      const [tt, tid] = (f.target.value || "|").split("|");
      const inArea = tt && A.isKnowledgeArea(tt, tid);
      const ksChoice = f.querySelector("[name=ks]:checked")?.value;
      const isKS = inArea || ksChoice === "yes";
      const readable = A.fileType(f.fileType.value).aiReadable;
      document.getElementById("ksBox").innerHTML = `<h3>📚 Knowledge</h3>
        ${inArea ? `<p class="small">Attached to a <b>knowledge area</b> → this file is automatically a knowledge source.</p>`
          : `<p class="small">Not a knowledge area. Treat this file as a knowledge source?</p>
             <label><input type="radio" name="ks" value="yes" ${ksChoice === "yes" ? "checked" : ""}> Yes</label> &nbsp; <label><input type="radio" name="ks" value="no" ${ksChoice === "no" ? "checked" : ""}> No — skip checks</label>`}
        ${isKS ? (readable ? `<p class="small">✅ ${A.esc(A.fileType(f.fileType.value).name)} is AI-readable.</p>`
          : `<div class="callout red small">❌ ${A.esc(A.fileType(f.fileType.value).name)} is not AI-readable. <b>Upload an AI-readable version</b> (PDF export, transcript, markdown):
              <div class="row mt-s"><input name="compTitle" placeholder="Title of AI-readable version" style="flex:1"><select name="compType">${DB.fileTypes.filter((x) => x.aiReadable).map((x) => `<option value="${x.id}">${x.name}</option>`).join("")}</select><input type="file" name="compFile"></div></div>`) : ""}`;
      f.querySelectorAll("[name=ks]").forEach((x) => (x.onchange = sync));
    };
    ["kind", "fileType", "access"].forEach((n) => f[n] && (f[n].onchange = sync));
    if (f.target) f.target.onchange = sync;
    sync();

    f.onsubmit = (e) => {
      e.preventDefault();
      if (f.dataset.violation) return A.toast("⛔ " + f.dataset.violation);
      const me = A.persona(), id = "R" + (DB.resources.length + 1);
      const base = { id, projectId: A.state.projectId, title: f.title.value, kind: f.kind.value, provider: f.provider.value, fileType: f.fileType.value,
        url: f.kind.value === "uploaded" ? `s3://delta-files/${id}` : f.url.value, ownerId: me.id, created: App.today, health: "ok" };
      if (companion) {
        DB.resources.push({ ...base, access: A.find("resources", companion).access, grants: A.find("resources", companion).grants, companionOf: companion });
        A.toast("AI-readable version uploaded — knowledge source is now AI-ready");
        location.hash = `/files/${companion}`;
        return;
      }
      const [tt, tid] = (f.target.value || "|").split("|");
      const inArea = tt && A.isKnowledgeArea(tt, tid);
      const ks = f.querySelector("[name=ks]:checked")?.value;
      if (!inArea && !ks) return A.toast("Please answer: treat as knowledge source?");
      const isKS = inArea || ks === "yes";
      if (isKS && !A.fileType(f.fileType.value).aiReadable && !f.compTitle?.value) return A.toast("Knowledge source needs an AI-readable version");
      const grants = [...(f.grants?.selectedOptions || [])].map((o) => { const [k, v] = o.value.split(":"); return k === "role" ? { roleId: v, level: "view" } : { userId: v, level: "view" }; });
      DB.resources.push({ ...base, access: f.access.value, grants, knowledgeSource: inArea ? null : ks === "yes" });
      if (tt) DB.resourceLinks.push({ resourceId: id, targetType: tt, targetId: tid, relation: f.relation.value, by: me.id, at: App.today });
      if (f.compTitle?.value) DB.resources.push({ ...base, id: id + "-ai", title: f.compTitle.value, kind: "uploaded", provider: "s3", fileType: f.compType.value, url: `s3://delta-files/${id}-ai`, access: f.access.value, grants, companionOf: id });
      A.toast(`${id} saved${tt ? " and attached" : ""}`);
      location.hash = `/files/${id}`;
    };
  };
})();
