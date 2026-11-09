/* Requests (ADR-017) — intake outside the thread.
 * - Anyone with item.request submits via a form template (Backoffice → Request forms). "voc" is seeded from the current Google Form.
 * - On publish the same request can be copied to other projects the requester is a member of (shared groupId).
 * - PM triages (request.triage): needs info / accept / decline, then links to existing items or creates new ones (Request N:M Item).
 * - A request is done when every linked item is released; items show a demand signal from their requests. */
(function () {
  const A = App;
  const STATUS_TABS = { open: "Open (new + needs info)", accepted: "Accepted", in_progress: "In progress", done: "Done", declined: "Declined", all: "All" };
  const tpl = (id) => A.find("requestTemplates", id);
  const customerName = (id) => (id ? A.esc(A.find("customers", id)?.name || id) : '<span class="muted">internal</span>');
  const urg = (u) => A.badge(u || "—", (u || "").toLowerCase());

  App.screens.requests = ({ pid, status = "open" }) => {
    const all = DB.requests.filter((r) => r.projectId === pid);
    const match = (r) => { const k = A.requestStatus(r).key; return status === "all" || (status === "open" ? ["new", "needs_info"].includes(k) : k === status); };
    const rows = all.filter(match);
    return `
      <div class="row" style="justify-content:space-between"><h1>Requests — ${A.esc(A.project(pid).name)}</h1>
        ${A.btn("item.request", "+ New request", `location.hash='/p/${pid}/requests/new'`, "primary")}</div>
      <p class="muted mb">Intake from Business, PM, Dev and QA. A PM triages each request and turns it into one or more items — or links several requests to one item.</p>
      <div class="row mb">${Object.entries(STATUS_TABS).map(([k, v]) => `<a class="btn sm ${k === status ? "primary" : ""}" href="#/p/${pid}/requests?status=${k}">${v} (${all.filter((r) => { const x = A.requestStatus(r).key; return k === "all" || (k === "open" ? ["new", "needs_info"].includes(x) : x === k); }).length})</a>`).join("")}</div>
      <div class="card"><table><tr><th>ID</th><th>Request</th><th>Customer</th><th>Urgency</th><th>Status</th><th>Items</th></tr>
        ${rows.map((r) => `<tr><td>${A.requestLink(r.id)}</td><td><b>${A.esc(r.title)}</b><div class="small muted">${A.esc(tpl(r.templateId).name)} · by ${A.who(r.requesterId)} · ${r.created}${r.groupId ? ` · also in ${DB.requests.filter((x) => x.groupId === r.groupId && x.id !== r.id).map((x) => A.esc(A.project(x.projectId).name)).join(", ")}` : ""}</div></td>
          <td>${customerName(r.customerId)}</td><td>${urg(r.urgency)}</td><td>${A.requestBadge(r)}</td><td>${A.itemsOfRequest(r.id).map((i) => A.itemLink(i.id)).join(" ") || "—"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nothing here.</td></tr>`}</table></div>`;
  };

  // ---------- form rendering from a template ----------
  function field(f) {
    const req = f.required ? " *" : "", help = f.help ? `<div class="small muted">${A.esc(f.help)}</div>` : "";
    const name = `f_${f.key}`;
    let input;
    if (f.type === "customer") input = `<div class="row"><select name="${name}" style="flex:1"><option value="">— choose customer —</option>${DB.customers.map((c) => `<option value="${c.id}">${A.esc(c.name)} (${c.status === "lead" ? "Lead" : "Existing client"})</option>`).join("")}<option value="__new">+ New customer…</option></select></div>
      <div class="row mt-s" id="newCustomer" style="display:none"><input name="newCustomerName" placeholder="Company name" style="flex:1"><select name="newCustomerStatus"><option value="lead">Lead</option><option value="existing">Existing client</option></select></div>`;
    else if (f.type === "text") input = `<input name="${name}" style="width:100%">`;
    else if (f.type === "paragraph") input = `<textarea name="${name}" rows="${f.maps === "title" ? 2 : 3}" style="width:100%"></textarea>`;
    else if (f.type === "dropdown") input = `<select name="${name}"><option value="">— choose —</option>${f.options.map((o) => `<option>${A.esc(o)}</option>`).join("")}</select>`;
    else input = `<div class="small">${f.options.map((o) => `<label style="display:block"><input type="${f.type === "multi" ? "checkbox" : "radio"}" name="${name}" value="${A.esc(o)}"> ${A.esc(o)}</label>`).join("")}${f.other ? `<label style="display:block"><input type="checkbox" name="${name}" value="__other"> Other: <input name="${name}_other" style="width:240px"></label>` : ""}</div>`;
    return `<div class="mt"><b>${A.esc(f.label)}${req}</b>${help}<div class="mt-s">${input}</div></div>`;
  }

  App.screens.newRequest = ({ pid, tpl: tid }) => {
    if (!A.can("item.request")) return `<h1>New request</h1><div class="callout">${A.esc(A.whyNot("item.request"))}</div>`;
    const me = A.persona(), mine = DB.requestTemplates.filter((t) => t.forRoles.some((r) => me.roleIds.includes(r)));
    const t = tpl(tid) || mine[0] || DB.requestTemplates[0];
    const others = DB.projects.filter((p) => p.id !== pid && p.memberIds.includes(me.id));
    return `
      <h1>New request — ${A.esc(A.project(pid).name)}</h1>
      <div class="row mb">Form: ${DB.requestTemplates.map((x) => `<a class="btn sm ${x.id === t.id ? "primary" : ""}" href="#/p/${pid}/requests/new?tpl=${x.id}">${A.esc(x.name)}</a>`).join("")}</div>
      <form class="card" id="reqForm" data-tpl="${t.id}" style="max-width:780px">
        <p class="small muted">${A.esc(t.desc)}</p>
        <div class="small">Requester: <b>${A.esc(me.name)}</b> · ${A.esc(me.email)} <span class="muted">(filled automatically)</span></div>
        ${t.sections.map((s) => `<h3 class="mt">${A.esc(s.title)}</h3>${s.fields.map(field).join("")}`).join("")}
        <div class="card ai-panel mt small" id="reqSimilar">${A.badge("AI", "ai")} Similar requests & items will appear as you describe the ask.</div>
        <div class="callout mt" id="publishBox" style="display:none">
          <b>Also publish this request to other projects?</b>
          <div class="small muted">Only projects you are a member of. Each project gets its own copy (own triage & items), linked as one group.</div>
          <div class="mt-s">${others.map((p) => `<label style="display:block"><input type="checkbox" name="alsoProject" value="${p.id}"> ${A.esc(p.name)} <span class="muted small">— ${A.esc(p.desc)}</span></label>`).join("") || '<span class="muted small">You are not a member of other projects.</span>'}</div>
          <div class="row mt"><button class="btn primary" type="submit">Publish</button><button class="btn" type="button" id="backEdit">Back to edit</button></div>
        </div>
        <div class="mt" id="reviewBtnRow"><button class="btn primary" type="button" id="reviewBtn">Continue</button> <span class="small muted" id="reqErr"></span></div>
      </form>`;
  };

  App.after.newRequest = ({ pid }) => {
    const f = document.getElementById("reqForm");
    if (!f) return;
    const t = tpl(f.dataset.tpl), fields = t.sections.flatMap((s) => s.fields), me = A.persona();
    const cust = f.f_customer;
    if (cust) cust.onchange = () => (document.getElementById("newCustomer").style.display = cust.value === "__new" ? "flex" : "none");
    const value = (fd) => {
      if (fd.type === "multi" || fd.type === "single") {
        const v = [...f.querySelectorAll(`[name=f_${fd.key}]:checked`)].map((x) => (x.value === "__other" ? f[`f_${fd.key}_other`].value.trim() : x.value)).filter(Boolean);
        return fd.type === "single" ? v[0] || "" : v;
      }
      return (f[`f_${fd.key}`]?.value || "").trim();
    };
    const ask = fields.find((x) => x.maps === "title");
    f[`f_${ask.key}`].oninput = (e) => {
      const q = e.target.value.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const rs = DB.requests.filter((r) => q.some((w) => r.title.toLowerCase().includes(w))).slice(0, 5);
      const its = DB.items.filter((i) => q.some((w) => i.title.toLowerCase().includes(w))).slice(0, 5);
      document.getElementById("reqSimilar").innerHTML = `${A.badge("AI", "ai")} ${rs.length || its.length ? `Possibly already asked: ${[...rs.map((r) => A.requestLink(r.id)), ...its.map((i) => A.itemLink(i.id))].join(" · ")} — still submit; PM can link yours to the same item (it raises demand).` : "No similar requests found."}`;
    };
    const show = (review) => { document.getElementById("publishBox").style.display = review ? "block" : "none"; document.getElementById("reviewBtnRow").style.display = review ? "none" : "block"; };
    document.getElementById("reviewBtn").onclick = () => {
      const missing = fields.filter((fd) => fd.required && (fd.type === "customer" ? !cust.value || (cust.value === "__new" && !f.newCustomerName.value.trim()) : !value(fd).length));
      document.getElementById("reqErr").textContent = missing.length ? "Required: " + missing.map((m) => m.label).join(" · ") : "";
      if (!missing.length) show(true);
    };
    document.getElementById("backEdit").onclick = () => show(false);
    f.onsubmit = (e) => {
      e.preventDefault();
      let customerId = null;
      if (cust) {
        customerId = cust.value;
        if (customerId === "__new") { customerId = "C" + (DB.customers.length + 1); DB.customers.push({ id: customerId, name: f.newCustomerName.value.trim(), status: f.newCustomerStatus.value, note: "" }); }
      }
      const answers = {}, cols = {};
      fields.forEach((fd) => { if (fd.type === "customer") return; const v = value(fd); fd.maps ? (cols[fd.maps] = v) : (answers[fd.key] = v); });
      const targets = [pid, ...[...f.querySelectorAll("[name=alsoProject]:checked")].map((x) => x.value)];
      const groupId = targets.length > 1 ? "G-" + (new Set(DB.requests.map((r) => r.groupId).filter(Boolean)).size + 1) : undefined;
      const ids = targets.map((p) => {
        const id = "REQ-" + (DB.requests.length + 1);
        DB.requests.push({ id, groupId, projectId: p, templateId: t.id, customerId, requesterId: me.id, created: App.today, status: "new", urgency: cols.urgency, impact: cols.impact, title: cols.title, answers });
        return id;
      });
      A.toast(`${ids.join(", ")} submitted${ids.length > 1 ? ` to ${ids.length} projects` : ""}`);
      location.hash = `/p/${pid}/request/${ids[0]}`;
    };
  };

  // ---------- detail + triage ----------
  App.screens.request = ({ pid, rid }) => {
    const r = A.find("requests", rid);
    if (!r) return `<h1>Request not found</h1>`;
    const t = tpl(r.templateId), st = A.requestStatus(r), its = A.itemsOfRequest(r.id);
    const val = (fd) => { const v = fd.type === "customer" ? null : fd.maps ? r[fd.maps] : r.answers[fd.key]; return Array.isArray(v) ? v.join(", ") : v; };
    const siblings = r.groupId ? DB.requests.filter((x) => x.groupId === r.groupId && x.id !== r.id) : [];
    const cands = DB.items.filter((i) => i.projectId === r.projectId && !its.includes(i));
    const tri = A.can("request.triage");
    return `
      <div class="muted small"><a href="#/p/${pid}/requests">← Requests</a></div>
      <h1>${r.id} · ${A.esc(r.title)}</h1>
      <div class="row mb">${A.requestBadge(r)} ${urg(r.urgency)} ${r.impact ? A.badge(r.impact) : ""} <span class="small muted">${A.esc(t.name)} · by ${A.who(r.requesterId)} · ${r.created}</span></div>
      ${st.total ? `<div class="bar mb" style="max-width:420px"><span style="width:${(st.done / st.total) * 100}%"></span></div>` : ""}
      <div class="pcols">
        <div>
          <div class="card"><h2>Submission</h2>
            ${r.customerId ? `<div><b>Company:</b> ${customerName(r.customerId)} ${A.badge(A.find("customers", r.customerId).status === "lead" ? "Lead" : "Existing client")}</div>` : ""}
            ${t.sections.map((s) => { const rows = s.fields.filter((fd) => fd.type !== "customer" && fd.maps !== "title" && val(fd)); return rows.length ? `<h3 class="mt">${A.esc(s.title)}</h3>${rows.map((fd) => `<div class="mt-s small"><b>${A.esc(fd.label)}</b><div>${A.esc(val(fd))}</div></div>`).join("")}` : ""; }).join("")}
            <h3 class="mt">Files</h3>${A.attachments("request", r.id)}
          </div>
          ${r.triageNote ? `<div class="callout mt"><b>Triage note:</b> ${A.esc(r.triageNote)}</div>` : ""}
        </div>
        <div>
          <div class="card"><h2>Items solving this request</h2>
            ${its.map((i) => `<div class="mt-s">${A.itemLink(i.id)} ${A.esc(i.title)} ${A.stageBadge(i.stage)}</div>`).join("") || '<p class="muted small">Not linked to any item yet.</p>'}
            <p class="small muted mt-s">Done when every linked item is released. One request can need several items; one item can solve several requests.</p>
          </div>
          ${siblings.length ? `<div class="card mt"><h2>Same request in other projects</h2>${siblings.map((x) => `<div class="small mt-s">${A.requestLink(x.id)} · ${A.esc(A.project(x.projectId).name)} ${A.requestBadge(x)}</div>`).join("")}</div>` : ""}
          <div class="card mt"><h2>Triage</h2>
            ${tri ? `
              <div class="row">
                <button class="btn sm" onclick="App.reqSet('${r.id}','needs_info')">Needs info</button>
                <button class="btn sm" onclick="App.reqSet('${r.id}','accepted')">Accept</button>
                <button class="btn sm" onclick="App.reqSet('${r.id}','declined')">Decline…</button></div>
              <div class="mt"><b class="small">Link to existing item</b><div class="row mt-s"><select id="linkItem" style="flex:1">${cands.map((i) => `<option value="${A.esc(i.id)}">${A.esc(i.id)} — ${A.esc(i.title)}</option>`).join("")}</select><button class="btn sm" onclick="App.reqLink('${r.id}')">Link</button></div></div>
              <div class="mt">${A.btn("item.create", "+ Create item from this request", `location.hash='/p/${r.projectId}/new?fromReq=${r.id}'`, "primary")}
                <div class="small muted mt-s">Create more than one if the request needs several items. Item priority is set by the PM, separate from the customer's urgency.</div></div>
              ${its.length ? `<div class="mt small">${its.map((i) => `<a href="javascript:App.reqUnlink('${r.id}','${A.esc(i.id)}')">unlink ${A.esc(i.id)}</a>`).join(" · ")}</div>` : ""}`
            : `<p class="small muted">${A.esc(A.whyNot("request.triage"))}. You are notified when the status changes.</p>`}
          </div>
        </div>
      </div>`;
  };

  App.reqSet = (rid, status) => {
    const r = A.find("requests", rid);
    if (status === "declined" || status === "needs_info") {
      const note = prompt(status === "declined" ? "Reason for declining (sent to requester):" : "What information is missing?");
      if (!note) return;
      r.triageNote = (status === "declined" ? "Declined: " : "") + note;
    }
    r.status = status;
    A.toast(`${rid} → ${status.replace("_", " ")} · ${A.user(r.requesterId).name} notified`);
    A.render();
  };
  App.reqLink = (rid) => {
    const iid = document.getElementById("linkItem").value;
    if (!iid) return;
    DB.requestItemLinks.push({ requestId: rid, itemId: iid });
    const r = A.find("requests", rid); if (r.status !== "declined") r.status = "accepted";
    A.toast(`${rid} linked to ${iid}`); A.render();
  };
  App.reqUnlink = (rid, iid) => { DB.requestItemLinks = DB.requestItemLinks.filter((l) => !(l.requestId === rid && l.itemId === iid)); A.render(); };

  // ---------- Backoffice: customers & request forms ----------
  App.screens.customers = () => {
    if (!A.can("admin.manage")) return `<h1>Customers</h1><div class="callout">${A.esc(A.whyNot("admin.manage"))}</div>`;
    return `<h1>Backoffice — Customers</h1><p class="muted mb">Master customer list used by the request form (no free-text company names, so demand per customer is counted correctly).</p>
      <div class="card"><table><tr><th>ID</th><th>Company</th><th>Status</th><th>Requests</th><th>Note</th></tr>
      ${DB.customers.map((c) => { const rs = DB.requests.filter((r) => r.customerId === c.id); return `<tr><td class="mono">${c.id}</td><td><b>${A.esc(c.name)}</b></td><td>${A.badge(c.status === "lead" ? "Lead" : "Existing client")}</td><td>${rs.map((r) => A.requestLink(r.id)).join(" ") || "—"}</td><td class="small">${A.esc(c.note)}</td></tr>`; }).join("")}</table>
      <form class="row mt" onsubmit="event.preventDefault();DB.customers.push({id:'C'+(DB.customers.length+1),name:this.n.value,status:this.s.value,note:''});App.render()"><input name="n" placeholder="Company name" required><select name="s"><option value="lead">Lead</option><option value="existing">Existing client</option></select><button class="btn">+ Add customer</button></form></div>`;
  };

  App.screens.requestForms = () => {
    if (!A.can("admin.manage")) return `<h1>Request forms</h1><div class="callout">${A.esc(A.whyNot("admin.manage"))}</div>`;
    const TYPES = ["text", "paragraph", "single", "multi", "dropdown"];
    return `<h1>Backoffice — Request forms</h1>
      <p class="muted mb"><b>Customer Voice</b> is seeded from the current Google Form; the product/module question is replaced by the project + "also publish to other projects" step.
        Edit questions below; fields marked <span class="mono">maps</span> feed request columns (title, urgency, impact, customer) and cannot be deleted.</p>
      ${DB.requestTemplates.map((t) => `<div class="card mb"><h2>${A.esc(t.name)} <span class="small muted mono">${t.id}</span></h2><p class="small muted">${A.esc(t.desc)}</p>
        <div class="small">Available to: ${t.forRoles.map((r) => A.badge(A.role(r)?.name || r)).join(" ")} · <a href="#/p/${A.state.projectId}/requests/new?tpl=${t.id}">preview form →</a></div>
        ${t.sections.map((s, si) => `<h3 class="mt">${A.esc(s.title)}</h3><table><tr><th style="width:60px"></th><th>Question</th><th>Type</th><th>Required</th><th>Stored as</th><th></th></tr>
          ${s.fields.map((f, fi) => `<tr><td><a href="javascript:App.rfMove('${t.id}',${si},${fi},-1)">↑</a> <a href="javascript:App.rfMove('${t.id}',${si},${fi},1)">↓</a></td>
            <td><input value="${A.esc(f.label)}" style="width:100%" onchange="App.rfField('${t.id}',${si},${fi},'label',this.value)">${f.options ? `<input class="small mt-s" value="${A.esc(f.options.join(" | "))}" style="width:100%" title="Options, separated by |" onchange="App.rfField('${t.id}',${si},${fi},'options',this.value)">` : ""}</td>
            <td>${f.type}</td><td><input type="checkbox" ${f.required ? "checked" : ""} ${f.maps ? "disabled" : ""} onchange="App.rfField('${t.id}',${si},${fi},'required',this.checked)"></td>
            <td class="mono small">${f.maps || "answers." + f.key}</td><td>${f.maps ? "" : `<a href="javascript:App.rfDel('${t.id}',${si},${fi})">✕</a>`}</td></tr>`).join("")}</table>
          <form class="row mt-s small" onsubmit="event.preventDefault();App.rfAdd('${t.id}',${si},this)"><input name="label" placeholder="New question" required style="flex:1"><select name="type">${TYPES.map((x) => `<option>${x}</option>`).join("")}</select><input name="options" placeholder="Options a | b | c (choice types)"><label><input type="checkbox" name="required"> required</label><button class="btn sm">+ Add question</button></form>`).join("")}
      </div>`).join("")}`;
  };
  const sec = (tid, si) => tpl(tid).sections[si];
  App.rfMove = (tid, si, fi, d) => { const fs = sec(tid, si).fields, j = fi + d; if (j < 0 || j >= fs.length) return; [fs[fi], fs[j]] = [fs[j], fs[fi]]; A.render(); };
  App.rfField = (tid, si, fi, k, v) => { sec(tid, si).fields[fi][k] = k === "options" ? v.split("|").map((x) => x.trim()).filter(Boolean) : v; A.toast("Saved"); A.render(); };
  App.rfDel = (tid, si, fi) => { sec(tid, si).fields.splice(fi, 1); A.render(); };
  App.rfAdd = (tid, si, f) => {
    const choice = ["single", "multi", "dropdown"].includes(f.type.value), opts = f.options.value.split("|").map((x) => x.trim()).filter(Boolean);
    if (choice && !opts.length) return A.toast("Choice questions need options");
    sec(tid, si).fields.push({ key: "q" + Date.now().toString(36), label: f.label.value, type: f.type.value, required: f.required.checked, ...(choice ? { options: opts } : {}) });
    A.render();
  };
})();
