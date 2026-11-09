/* Projects — create (PM / Admin) and per-project settings (project leads + Admin):
 * general, members & relations, item code format, custom item fields, release, files. */
(function () {
  const A = App;
  const TABS = { general: "General", members: "Members & relations", code: "Item code format", release: "Release & flags", files: "File policy", lens: "Lens & panels" };

  // Reusable code-format editor (used in create + settings).
  function codeEditor(p) {
    return `
      <label style="display:block">Template<br><input name="tpl" value="${A.esc(p.codeFormat.template)}" class="mono" style="width:100%"></label>
      <div class="row small mt-s">${A.CODE_TOKENS.map(([t, d]) => `<button type="button" class="btn sm tok" data-tok="${t}" title="${A.esc(d)}">${t}</button>`).join("")}</div>
      <label class="mt" style="display:block">Sequence resets<br><select name="scope">${Object.entries(A.SEQ_SCOPES).map(([k, v]) => `<option value="${k}" ${k === p.codeFormat.seqScope ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <h3 class="mt">Amendment code (Mode A)</h3>
      <p class="small muted">Appended to the item's code when a new version is created. The base code is locked — only the suffix is configurable.</p>
      <div class="row"><span class="mono muted" id="sfxBase">{base code}</span><input name="sfx" value="${A.esc(p.codeFormat.amendSuffix || "-AM-{SEQ}")}" class="mono" style="width:220px"></div>
      <div class="row small mt-s">${A.SUFFIX_TOKENS.map(([t, d]) => `<button type="button" class="btn sm stok" data-tok="${t}" title="${A.esc(d)}">${t}</button>`).join("")}</div>
      <div class="card mt" id="codePrev"></div>`;
  }
  function wireCodeEditor(f, p) {
    const draw = () => {
      const tpl = f.tpl.value, scope = f.scope.value, tmp = Object.assign({}, p, { key: (f.key?.value || p.key).toUpperCase() });
      const v = A.validateFormat(tmp, tpl, scope);
      const samples = [["feature", "high", "2026-11-05"], ["bugfix", "urgent", "2026-11-05"], ["feature", "low", "2027-01-03"]];
      const field = tmp.itemFields[0];
      document.getElementById("codePrev").innerHTML = `<h3>Preview (next codes)</h3>
        ${v.errs.length ? `<div class="callout red small">${v.errs.map((e) => "⛔ " + A.esc(e)).join("<br>")}</div>` : `<table class="small">${samples.map(([t, pr, d]) => {
          const fields = field ? { [field.key]: field.options[0].value } : {};
          return `<tr><td>${A.typeBadge(t)} · ${pr} · ${d}${field ? ` · ${A.esc(field.label)}: ${A.esc(field.options[0].value)}` : ""}</td><td class="mono"><b>${A.esc(A.previewCode(tmp, tpl, scope, { typeId: t, priority: pr, date: d, fields }))}</b></td></tr>`;
        }).join("")}</table>`}
        ${(() => { const se = A.validateSuffix(f.sfx.value); const base = v.errs.length ? "INV-001" : A.previewCode(tmp, tpl, scope, { typeId: "feature", priority: "high", fields: field ? { [field.key]: field.options[0].value } : {} });
          document.getElementById("sfxBase").textContent = base;
          return se.length ? `<div class="callout red small mt-s">${se.map((e) => "⛔ " + A.esc(e)).join("<br>")}</div>`
            : `<div class="small mt-s">Amendments: <span class="mono">${A.esc(base)}</span> → <b class="mono">${A.esc(base + A.renderSuffix(f.sfx.value, 1))}</b> → <b class="mono">${A.esc(base + A.renderSuffix(f.sfx.value, 2))}</b></div>`; })()}
        ${v.warns.map((w) => `<div class="small muted">⚠ ${A.esc(w)}</div>`).join("")}
        <p class="small muted">Applies to <b>new</b> items only — existing codes never change (links, branches and GitHub references stay valid).</p>`;
      f.dataset.invalid = v.errs.length || A.validateSuffix(f.sfx.value).length ? "1" : "";
    };
    f.tpl.oninput = draw; f.scope.onchange = draw; f.sfx.oninput = draw;
    f.querySelectorAll(".stok").forEach((b) => (b.onclick = () => { f.sfx.value += b.dataset.tok; draw(); })); if (f.key) f.key.addEventListener("input", draw);
    f.querySelectorAll(".tok").forEach((b) => (b.onclick = () => { const i = f.tpl.selectionStart ?? f.tpl.value.length; f.tpl.value = f.tpl.value.slice(0, i) + b.dataset.tok + f.tpl.value.slice(i); draw(); f.tpl.focus(); }));
    draw();
  }

  // ---------- Create project ----------
  App.screens.newProject = () => {
    if (!A.can("project.create")) return `<h1>New project</h1><div class="callout">${A.esc(A.whyNot("project.create"))}</div>`;
    const blank = { key: "NEW", itemFields: [], codeFormat: { template: "{KEY}-{SEQ}", seqScope: "project", amendSuffix: "-AM-{SEQ}" }, codeCounters: {} };
    return `<h1>New project</h1><p class="muted mb">You become the project lead and can change everything later in Project settings.</p>
      <form class="card" id="projForm" style="max-width:820px">
        <div class="grid g3">
          <label>Name<br><input name="name" required style="width:100%"></label>
          <label>Key (code prefix)<br><input name="key" required maxlength="6" style="width:100%;text-transform:uppercase" placeholder="e.g. INV"></label>
          <label>Type<br><select name="type" style="width:100%"><option value="saas">SaaS</option></select></label>
        </div>
        <label class="mt" style="display:block">Description<br><input name="desc" style="width:100%"></label>
        <div class="grid g3 mt">
          <label>Visibility<br><select name="visibility" style="width:100%"><option value="private">Private (members + related projects)</option><option value="internal">Internal (everyone)</option></select></label>
          <label>Production branch *<br><input name="prod" value="main" required class="mono" style="width:100%"></label>
          <label>Uses feature flags (GrowthBook)<br><select name="flags" style="width:100%"><option value="false">No</option><option value="true">Yes</option></select></label>
        </div>
        <label class="mt" style="display:block">Members<br><select name="members" multiple size="5" style="width:100%">${DB.users.map((u) => `<option value="${u.id}" ${u.id === A.persona().id ? "selected" : ""}>${A.esc(u.name)} — ${u.roleIds.map((r) => A.role(r).name).join(", ")}</option>`).join("")}</select></label>
        <h3 class="mt">Item code format</h3>${codeEditor(blank)}
        <div class="mt"><button class="btn primary">Create project</button></div>
      </form>`;
  };
  App.after.newProject = () => {
    const f = document.getElementById("projForm");
    if (!f || !f.tpl) return;
    const blank = { key: "NEW", itemFields: [], codeFormat: { template: "{KEY}-{SEQ}", seqScope: "project", amendSuffix: "-AM-{SEQ}" }, codeCounters: {} };
    wireCodeEditor(f, blank);
    f.onsubmit = (e) => {
      e.preventDefault();
      if (f.dataset.invalid) return A.toast("Fix the code format first");
      const key = f.key.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (DB.projects.some((p) => p.key === key)) return A.toast(`Key ${key} is already used`);
      const me = A.persona(), id = "p-" + key.toLowerCase();
      const members = [...new Set([me.id, ...[...f.members.selectedOptions].map((o) => o.value)])];
      DB.projects.push({ id, key, name: f.name.value, type: f.type.value, desc: f.desc.value, leadIds: [me.id], usesFeatureFlags: f.flags.value === "true",
        codeFormat: { template: f.tpl.value, seqScope: f.scope.value, amendSuffix: f.sfx.value }, codeCounters: {}, itemFields: [], knowledgeSharing: "shared", visibility: f.visibility.value, relatedProjectIds: [],
        releaseConfig: { productionBranch: f.prod.value, failMode: "closed" }, filePolicy: { allowUploads: true, allowedUploadTypes: ["png"], allowExternalLinks: true, maxFileMB: 10, quotaGB: 5, retentionDays: 365, versioning: false }, memberIds: members });
      A.toast(`Project ${f.name.value} created`);
      location.hash = `/p/${id}/settings`;
    };
  };

  // ---------- Project settings ----------
  const views = {
    general: (p) => `<form class="card" id="setForm"><div class="grid g3">
        <label>Name<br><input name="name" value="${A.esc(p.name)}" style="width:100%"></label>
        <label>Key<br><input value="${A.esc(p.key)}" disabled style="width:100%" title="Key is locked after creation — existing codes depend on it"></label>
        <label>Visibility<br><select name="visibility" style="width:100%">${["private", "internal"].map((v) => `<option ${v === p.visibility ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
        <label class="mt" style="display:block">Description<br><input name="desc" value="${A.esc(p.desc)}" style="width:100%"></label>
        <p class="small muted">Knowledge sharing: <b>${p.knowledgeSharing}</b> (all projects shared for now).</p>
        <button class="btn primary mt">Save</button></form>`,
    members: (p) => `<div class="grid g2">
        <div class="card"><h2>Members (${p.memberIds.length})</h2><table>${p.memberIds.map((id) => { const u = A.user(id); return `<tr><td>${A.who(id)} ${p.leadIds.includes(id) ? A.badge("lead", "ai") : ""}</td><td class="small">${u.roleIds.map((r) => A.role(r).name).join(", ")}</td></tr>`; }).join("")}</table>
          <button class="btn sm mt" onclick="App.toast('Prototype: add member')">+ Add member</button></div>
        <div class="card"><h2>Related projects</h2><p class="small muted">Members of these projects can open this project's private files.</p>
          ${p.relatedProjectIds.map((x) => A.badge(A.project(x).name, "ai")).join(" ") || '<span class="muted">None</span>'}
          <div class="mt"><select id="relSel">${DB.projects.filter((x) => x.id !== p.id && !p.relatedProjectIds.includes(x.id)).map((x) => `<option value="${x.id}">${A.esc(x.name)}</option>`).join("")}</select>
          <button class="btn sm" onclick="App.screens._addRel('${p.id}')">Register relation</button></div></div></div>`,
    code: (p) => `<form class="card" id="codeForm" style="max-width:860px">
        <h2>Item code format</h2><p class="small muted">Current: <span class="mono">${A.esc(p.codeFormat.template)}</span> · amendment suffix <span class="mono">${A.esc(p.codeFormat.amendSuffix)}</span> · resets ${A.esc(A.SEQ_SCOPES[p.codeFormat.seqScope].toLowerCase())} · counters ${A.esc(JSON.stringify(p.codeCounters))}</p>
        ${codeEditor(p)}<button class="btn primary mt">Save format</button></form>
      <div class="card mt" style="max-width:860px"><h2>Custom item fields</h2><p class="small muted">Fields asked when creating an item. Each option has a short code usable as <span class="mono">{FIELD:key}</span>.</p>
        ${p.itemFields.map((fd) => `<div class="mb"><b>${A.esc(fd.label)}</b> <span class="mono muted">${fd.key}</span> ${fd.required ? A.badge("required") : ""}<div class="row small mt-s">${fd.options.map((o) => `${A.badge(o.value + " → " + o.code)}`).join("")}</div></div>`).join("") || '<p class="muted small">No custom fields.</p>'}
        <button class="btn sm" onclick="App.toast('Prototype: add custom field (label, key, options with codes)')">+ Add field</button></div>`,
    release: (p) => `<div class="card" style="max-width:720px"><h2>Release</h2><table>
        <tr><th>Production branch (default release target)</th><td class="mono">${A.esc(p.releaseConfig.productionBranch)}</td></tr>
        <tr><th>Release gate when Delta PMT unreachable</th><td>${A.badge(p.releaseConfig.failMode)}</td></tr>
        <tr><th>Uses feature flags (GrowthBook)</th><td>${p.usesFeatureFlags ? "Yes — flag checklist asked when a release is created" : "No"}</td></tr></table>
        <p class="small muted">Release sequence & checklists: to be detailed (ADR-013/014).</p></div>`,
    lens: (p) => `<div class="card" style="max-width:760px"><h2>Lens & panel override</h2>
        <p>Same feature as <a href="#/admin/lenses?tab=panels">Backoffice → Lens & panels → Panel management</a>, but scoped to <b>${A.esc(p.name)}</b>: per lens and stage, add, hide or reorder panels for this project only.</p>
        <p class="small muted">Resolution order: user preference → <b>project override</b> → lens layout → default. Example: a project that doesn't use feature flags hides the flag section of “Release & flags”.</p>
        <p class="small">${A.badge("planned", "blocked")} Not interactive in the prototype.</p></div>`,
    files: (p) => { const f = p.filePolicy; return `<div class="card" style="max-width:720px"><h2>File policy</h2><table>
        <tr><th>Uploads</th><td>${f.allowUploads ? "allowed" : "disabled"} · types <span class="mono">${f.allowedUploadTypes.join(", ")}</span></td></tr>
        <tr><th>External links</th><td>${f.allowExternalLinks ? "allowed" : "disabled"}</td></tr>
        <tr><th>Limits</th><td>${f.maxFileMB} MB / file · ${f.quotaGB} GB · retention ${f.retentionDays} d · versioning ${f.versioning ? "on" : "off"}</td></tr></table></div>`; },
  };

  App.screens.projectSettings = ({ pid, tab = "general" }) => {
    const p = A.project(pid);
    if (!A.canManageProject(p)) return `<h1>Project settings</h1><div class="callout">Only the project lead(s) (${p.leadIds.map((x) => A.esc(A.user(x).name)).join(", ")}) or an Admin can change ${A.esc(p.name)} settings.</div>`;
    return `<h1>${A.esc(p.name)} — settings</h1>
      <div class="row mb">${Object.entries(TABS).map(([k, v]) => `<a class="btn sm ${k === tab ? "primary" : ""}" href="#/p/${pid}/settings/${k}">${v}</a>`).join("")}</div>
      ${views[tab](p)}`;
  };
  App.after.projectSettings = ({ pid, tab = "general" }) => {
    const p = A.project(pid);
    if (tab === "code") {
      const f = document.getElementById("codeForm");
      if (!f || !f.tpl) return;
      wireCodeEditor(f, p);
      f.onsubmit = (e) => { e.preventDefault(); if (f.dataset.invalid) return A.toast("Fix the errors first");
        p.codeFormat = { template: f.tpl.value, seqScope: f.scope.value, amendSuffix: f.sfx.value }; A.toast("Format saved — applies to new items"); A.render(); };
    }
    if (tab === "general") {
      const f = document.getElementById("setForm");
      if (f && f.name) f.onsubmit = (e) => { e.preventDefault(); Object.assign(p, { name: f.name.value, desc: f.desc.value, visibility: f.visibility.value }); A.toast("Saved"); A.render(); };
    }
  };
  App.screens._addRel = (pid) => { const v = document.getElementById("relSel").value; if (!v) return; A.project(pid).relatedProjectIds.push(v); A.toast("Relation registered"); A.render(); };
})();
