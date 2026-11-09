/* Backoffice — master data: item types & stages, roles × permissions, employment types,
 * users, automation rules, integrations. Edits are in-memory only. */
(function () {
  const A = App;
  const TABS = { types: "Item types & stages", roles: "Roles & permissions", projects: "Projects & file policy", users: "Users", automation: "Automation rules", lenses: "Lens & panels", integrations: "Integrations" };

  const views = {
    types: () => `
      <div class="card mb"><h2>Item types</h2><p class="small muted">Which stages each type goes through and its default gate mode. Gate mode can be changed per item at creation.</p>
        <table><tr><th>Type</th><th>Default gate</th>${DB.stages.map((s) => `<th class="small">${s.name}</th>`).join("")}</tr>
        ${DB.itemTypes.map((t) => `<tr><td>${A.typeBadge(t.id)}</td><td>${A.badge(t.defaultGate)}</td>${DB.stages.map((s) => `<td><input type="checkbox" data-type="${t.id}" data-stage="${s.id}" ${t.stages.includes(s.id) ? "checked" : ""}></td>`).join("")}</tr>`).join("")}</table>
        <button class="btn sm mt" onclick="App.toast('Prototype: add item type')">+ Add type</button></div>
      <div class="card"><h2>Stages & gates</h2><table><tr><th>Stage</th><th>Default owner role</th><th>Gate</th></tr>
        ${DB.stages.map((s) => `<tr><td>${s.name}</td><td>${A.role(s.ownerRole).name}</td><td class="small">${A.esc(s.gate)}</td></tr>`).join("")}</table></div>`,

    roles: () => `
      <div class="card mb"><h2>Roles × permissions</h2><p class="small muted">Users can hold multiple roles. Effective = union of role permissions − employment-type restrictions.</p>
        <table><tr><th>Permission</th>${DB.roles.map((r) => `<th class="small">${r.name}</th>`).join("")}</tr>
        ${DB.permissions.map((p) => `<tr><td class="small">${p.label} <span class="mono muted">${p.key}</span></td>${DB.roles.map((r) => `<td><input type="checkbox" data-role="${r.id}" data-perm="${p.key}" ${r.perms.includes(p.key) ? "checked" : ""}></td>`).join("")}</tr>`).join("")}</table>
        <form class="row mt" id="addRole"><input name="name" placeholder="New role name, e.g. Data Analyst" required>
          <label class="small">copy permissions from <select name="from"><option value="">— none —</option>${DB.roles.map((r) => `<option value="${r.id}">${A.esc(r.name)}</option>`).join("")}</select></label>
          <label class="small">lens <select name="lens">${DB.lenses.filter((l) => l.id !== "default").map((l) => `<option value="${l.id}">${A.esc(l.name)}</option>`).join("")}</select></label>
          <button class="btn sm primary">+ Add role</button></form>
        <p class="small muted">Roles are data (dynamic). Permissions and panels are code — a new role combines existing permissions and an existing lens.</p></div>
      <div class="card"><h2>Employment types</h2><table><tr><th>Type</th><th>Denied permissions</th><th>Note</th></tr>
        ${DB.employmentTypes.map((e) => `<tr><td>${e.name}</td><td class="small mono">${e.deny.join(", ") || "—"}</td><td class="small">${A.esc(e.note || "")}</td></tr>`).join("")}</table></div>`,

    projects: () => `
      <div class="card mb"><h2>Projects</h2><p class="small muted">Files inherit project access by default. A project can register related projects whose members may also open its private files. Files can override (anyone in app / restricted).</p>
        <table><tr><th>Project</th><th>Visibility</th><th>Related projects (granted access)</th><th>Production branch</th><th>Release gate fail mode</th><th>Members</th></tr>
        ${DB.projects.map((p) => `<tr><td><b>${A.esc(p.name)}</b></td><td>${A.badge(p.visibility)}</td><td>${p.relatedProjectIds.map((x) => A.badge(A.project(x).name, "ai")).join(" ") || "—"} <button class="btn sm" onclick="App.toast('Prototype: register related project')">+</button></td>
          <td class="mono">${A.esc(p.releaseConfig.productionBranch)}</td><td>${A.badge(p.releaseConfig.failMode === "closed" ? "closed — hold if unreachable" : "open — pass with warning", p.releaseConfig.failMode === "closed" ? "critical" : "")}</td><td class="small">${p.memberIds.length}</td></tr>`).join("")}</table></div>
      <div class="card"><h2>File policy per project</h2><p class="small muted">Delta PMT aims to be the source of truth: uploads & external links are the exception (images mostly). </p>
        <table><tr><th>Project</th><th>Uploads</th><th>Allowed upload types</th><th>External links</th><th>Max file</th><th>Quota</th><th>Retention</th><th>Versioning</th></tr>
        ${DB.projects.map((p) => { const f = p.filePolicy; return `<tr><td>${A.esc(p.name)}</td><td><input type="checkbox" data-pol="${p.id}" data-key="allowUploads" ${f.allowUploads ? "checked" : ""}></td>
          <td class="small mono">${f.allowedUploadTypes.join(", ")}</td><td><input type="checkbox" data-pol="${p.id}" data-key="allowExternalLinks" ${f.allowExternalLinks ? "checked" : ""}></td>
          <td>${f.maxFileMB} MB</td><td>${f.quotaGB} GB</td><td>${f.retentionDays} d</td><td>${f.versioning ? "✅" : "—"}</td></tr>`; }).join("")}</table></div>`,

    users: () => `
      <div class="card"><h2>Users</h2><table><tr><th>Name</th><th>Email</th><th>Roles</th><th>Employment</th><th>Projects</th><th>Effective permissions</th></tr>
        ${DB.users.map((u) => `<tr><td>${A.who(u.id)}${u.mentorId ? `<div class="small muted">mentor ${A.esc(A.user(u.mentorId).name)}</div>` : ""}</td>
          <td class="small">${A.esc(u.email)}${u.email.endsWith("@deltahq.com") ? "" : " " + A.badge("personal", "blocked")}</td>
          <td>${u.roleIds.map((r) => A.badge(A.role(r).name)).join(" ")}</td><td>${A.find("employmentTypes", u.employment).name}</td>
          <td class="small">${DB.projects.filter((p) => p.memberIds.includes(u.id)).map((p) => p.key).join(", ")}</td>
          <td class="small muted">${[...A.permsOf(u)].length} perms</td></tr>`).join("")}</table></div>`,

    automation: () => `
      <div class="card mb"><h2>Automation rules</h2><p class="small muted">When a GitHub/Delta event matches, the task moves by itself. Try it on the <a href="#/p/p-payflow/board">PayFlow board</a> → “Merge PR” on <span class="mono">payflow-web#166</span>.</p>
        <table><tr><th>On</th><th>Rule</th><th>When (trigger)</th><th>If (condition)</th><th>Then (action)</th></tr>
        ${DB.automationRules.map((r) => `<tr><td><input type="checkbox" data-rule="${r.id}" ${r.enabled ? "checked" : ""}></td><td><b>${A.esc(r.name)}</b><div class="mono small muted">${r.id}</div></td>
          <td class="mono small">${A.esc(r.trigger)}</td><td class="small">${A.esc(r.condition)}</td><td class="small">${A.esc(r.action)}</td></tr>`).join("")}</table>
        <button class="btn sm mt" onclick="App.toast('Prototype: rule builder — trigger → condition → action')">+ New rule</button></div>
      <div class="card"><h2>Board workflow statuses</h2><div class="row">${DB.taskStatuses.map((s) => A.badge(s.name)).join(" → ")}</div></div>`,

    integrations: () => `
      <div class="grid g2">
        <div class="card"><div class="spread"><h2>${A.badge("GH", "gh")} GitHub</h2>${A.badge("connected (mock)", "pass")}</div>
          <p class="small">GitHub App on org <span class="mono">deltahq</span>: Issues (2-way), PRs, Actions, Wiki (knowledge source).</p>
          <table>${DB.repos.map((r) => `<tr><td class="mono small">${A.esc(r.fullName)}</td><td class="small">${r.projectId ? A.project(r.projectId).name : "Company-wide"}</td><td>${r.wiki ? A.badge("wiki indexed", "pass") : ""}</td></tr>`).join("")}</table></div>
        <div class="card"><h2>AI provider ${A.badge("policy pending", "blocked")}</h2><p class="small">Data policy for external LLMs is undecided. All AI output in this prototype is static sample data.</p>
          <h3 class="mt">Other knowledge sources</h3><p class="small muted">Notion, Google Docs — later.</p></div>
      </div>`,
  };

  App.screens.backoffice = ({ tab }) => {
    if (!A.can("admin.manage")) return `<h1>Backoffice</h1><div class="callout">${A.esc(A.whyNot("admin.manage"))}</div>`;
    return `<h1>Backoffice — ${TABS[tab] || ""}</h1>
      ${(views[tab] || views.types)()}`;
  };

  App.after.backoffice = () => {
    const ar = document.getElementById("addRole");
    if (ar && ar.name) ar.onsubmit = (e) => {
      e.preventDefault();
      const id = ar.name.value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      if (A.role(id)) return A.toast("Role already exists");
      DB.roles.push({ id, name: ar.name.value, lensId: ar.lens.value, perms: ar.from.value ? [...A.role(ar.from.value).perms] : [] });
      A.toast(`Role “${ar.name.value}” added`); A.render();
    };
    document.querySelectorAll("[data-perm]").forEach((c) => (c.onchange = () => {
      const r = A.role(c.dataset.role);
      r.perms = c.checked ? [...r.perms, c.dataset.perm] : r.perms.filter((p) => p !== c.dataset.perm);
      A.toast(`${r.name}: ${c.dataset.perm} ${c.checked ? "granted" : "revoked"}`);
    }));
    document.querySelectorAll("[data-type]").forEach((c) => (c.onchange = () => {
      const t = A.itemType(c.dataset.type);
      t.stages = DB.stages.map((s) => s.id).filter((s) => (s === c.dataset.stage ? c.checked : t.stages.includes(s)));
      A.toast(`${t.name} stages updated`);
    }));
    document.querySelectorAll("[data-pol]").forEach((c) => (c.onchange = () => {
      A.project(c.dataset.pol).filePolicy[c.dataset.key] = c.checked;
      A.toast(`${A.project(c.dataset.pol).name}: ${c.dataset.key} ${c.checked ? "on" : "off"}`);
    }));
    document.querySelectorAll("[data-rule]").forEach((c) => (c.onchange = () => {
      A.find("automationRules", c.dataset.rule).enabled = c.checked;
      A.toast(`${c.dataset.rule} ${c.checked ? "enabled" : "disabled"}`);
    }));
  };
})();
