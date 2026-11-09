/* Items (threads) pipeline by stage, and the New item / request form. */
(function () {
  const A = App;

  App.screens.items = ({ pid, type }) => {
    const items = A.where("items", (i) => i.projectId === pid && (!type || i.typeId === type));
    return `
      <div class="spread mb"><h1>${A.esc(A.project(pid).name)} — items</h1>
        ${A.btn(A.can("item.create") ? "item.create" : "item.request", A.can("item.create") ? "+ New item" : "+ Submit request", `location.hash='/p/${pid}/${A.can("item.create") ? "new" : "requests/new"}'`, "primary")}</div>
      <div class="row mb"><a class="btn sm ${!type ? "primary" : ""}" href="#/p/${pid}/items">All</a>${DB.itemTypes.map((t) => `<a class="btn sm ${type === t.id ? "primary" : ""}" href="#/p/${pid}/items?type=${t.id}">${A.esc(t.name)}</a>`).join("")}</div>
      <div class="pipeline">${DB.stages.map((s) => {
        const col = items.filter((i) => i.stage === s.id);
        return `<div class="col"><h3>${s.name}<span class="muted">${col.length}</span></h3>${col.map((i) => {
          const g = A.gate(i), gaps = A.gaps(i).length, c = A.conformance(i);
          return `<div class="icard"><div class="spread">${A.itemLink(i.id)}${A.typeBadge(i.typeId)}</div>
            <div>${A.esc(i.title)}</div>
            <div class="row small mt-s">${g.ok ? "" : A.badge("gate ✕", "blocked")}${gaps ? A.badge(gaps + " gap", "gap") : ""}${c ? A.badge(`AC ${c.met}/${c.total}`) : ""}</div>
            <div class="small mt-s">${A.planBadge(i.id)}</div>
            <div class="small muted">${A.who(i.ownerId)}</div></div>`;
        }).join("")}</div>`;
      }).join("")}</div>`;
  };

  App.screens.newItem = ({ pid, fromReq }) => {
    const src = fromReq && A.find("requests", fromReq);
    const full = A.can("item.create");
    if (!full && !A.can("item.request")) return `<h1>New item</h1><div class="callout">${A.esc(A.whyNot("item.request"))}</div>`;
    // Requesters (Business, QA) may only submit Feature/Enhancement/Bug fix requests; gate mode follows the type default.
    const types = full ? DB.itemTypes : DB.itemTypes.filter((t) => ["feature", "enhancement", "bugfix"].includes(t.id));
    return `
      <h1>${full ? "New item" : "Submit a request"} — ${A.esc(A.project(pid).name)}</h1>
      <p class="muted mb">${src ? `From request ${A.requestLink(src.id)} — the item is linked to it on create.` : full ? "Creates a thread starting at the first stage of its type. Customer asks belong in Requests." : `Customer or team asks go to <a href="#/p/${pid}/requests/new">Requests</a>; a PM turns them into items.`}</p>
      <form class="card" id="newItemForm" data-req="${src ? src.id : ""}" style="max-width:720px">
        <div class="grid g2">
          <label>Type<br><select name="type" style="width:100%">${types.map((t) => `<option value="${t.id}">${A.esc(t.name)}</option>`).join("")}</select></label>
          <label>Gate mode<br><select name="gate" style="width:100%" ${full ? "" : "disabled"}><option value="strict">Strict — cannot advance until gate passes</option><option value="advisory">Advisory — warn only</option></select></label>
        </div>
        <div class="small muted mt-s" id="typeStages"></div>
        <div class="grid g2 mt">
          <label>Priority<br><select name="priority" style="width:100%">${["urgent", "high", "medium", "low"].map((x) => `<option ${x === "medium" ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          ${A.project(pid).itemFields.map((fd) => `<label>${A.esc(fd.label)}${fd.required ? " *" : ""}<br><select name="field_${fd.key}" style="width:100%">${fd.options.map((o) => `<option value="${A.esc(o.value)}">${A.esc(o.value)} (${o.code})</option>`).join("")}</select></label>`).join("")}
        </div>
        <div class="small mt-s">Code will be: <b class="mono" id="codePreview"></b> <span class="muted">· format <span class="mono">${A.esc(A.project(pid).codeFormat.template)}</span></span></div>
        <label class="mt" style="display:block">Title<br><input name="title" required style="width:100%" placeholder="e.g. Allow customers to pause a subscription" value="${src ? A.esc(src.title) : ""}" /></label>
        ${full ? `<div class="mt"><b>Requests this item solves</b> <span class="small muted">(optional, many)</span>
          <div class="small" style="max-height:160px;overflow:auto;border:1px solid #e5e7eb;border-radius:6px;padding:6px">
          ${DB.requests.filter((r) => r.projectId === pid && r.status !== "declined").map((r) => `<label style="display:block"><input type="checkbox" name="reqs" value="${r.id}" ${src && src.id === r.id ? "checked" : ""}> <span class="mono">${r.id}</span> ${A.esc(r.title)} <span class="muted">· ${r.customerId ? A.esc(A.find("customers", r.customerId).name) : "internal"} · ${A.esc(r.urgency || "")}</span></label>`).join("") || '<span class="muted">No requests in this project.</span>'}</div>
          <button class="btn sm mt-s" type="button" id="genDesc">✨ Generate description from selected requests</button></div>` : ""}
        <label class="mt" style="display:block">Problem / why<br><textarea name="why" rows="3" style="width:100%" placeholder="Who is affected and why it matters">${src ? A.esc([src.answers.today, src.answers.outcome].filter(Boolean).join(" → ")) : ""}</textarea></label>
        <div class="card ai-panel mt small" id="similar">${A.badge("AI", "ai")} Similar items & knowledge will appear as you type the title.</div>
        <div class="mt"><button class="btn primary">Create</button></div>
      </form>`;
  };

  App.after.newItem = ({ pid }) => {
    const f = document.getElementById("newItemForm");
    if (!f) return;
    const showType = () => {
      const t = A.itemType(f.type.value);
      f.gate.value = t.defaultGate;
      document.getElementById("typeStages").innerHTML = "Stages: " + t.stages.map((s) => A.stage(s).name).join(" → ");
    };
    const p = A.project(pid);
    const attrs = () => ({ typeId: f.type.value, priority: f.priority.value, fields: Object.fromEntries(p.itemFields.map((fd) => [fd.key, f["field_" + fd.key].value])) });
    const showCode = () => (document.getElementById("codePreview").textContent = A.previewCode(p, p.codeFormat.template, p.codeFormat.seqScope, attrs()));
    f.type.onchange = () => { showType(); showCode(); };
    f.priority.onchange = showCode;
    p.itemFields.forEach((fd) => (f["field_" + fd.key].onchange = showCode));
    showType(); showCode();
    const picked = () => [...f.querySelectorAll("[name=reqs]:checked")].map((x) => A.find("requests", x.value));
    const gen = document.getElementById("genDesc");
    if (gen) gen.onclick = () => {
      const rs = picked();
      if (!rs.length) return A.toast("Select at least one request");
      // Prototype: deterministic summary. Real app: LLM summarises the selected requests' answers.
      const cust = [...new Set(rs.map((r) => r.customerId && A.find("customers", r.customerId).name).filter(Boolean))];
      const line = (k) => rs.map((r) => r.answers[k]).filter(Boolean);
      f.why.value = [`Requested ${rs.length}× (${rs.map((r) => r.id).join(", ")})${cust.length ? " by " + cust.join(", ") : ""}.`,
        line("today").length ? "Today: " + line("today").join(" / ") : "", line("outcome").length ? "Desired outcome: " + line("outcome").join(" / ") : "",
        `Impact: ${[...new Set(rs.map((r) => r.impact).filter(Boolean))].join(", ") || "—"} · highest urgency: ${rs.map((r) => r.urgency).sort((a, b) => ["Critical", "High", "Medium", "Low", "Unknown"].indexOf(a) - ["Critical", "High", "Medium", "Low", "Unknown"].indexOf(b))[0]}.`].filter(Boolean).join("\n");
      if (!f.title.value) f.title.value = rs[0].title;
      A.toast("Draft description generated — review before creating");
    };
    f.title.oninput = () => {
      const q = f.title.value.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const hits = DB.items.filter((i) => q.some((w) => i.title.toLowerCase().includes(w)));
      const pages = DB.wikiPages.filter((w) => A.canRead(w) && q.some((x) => (w.title + w.body).toLowerCase().includes(x)));
      document.getElementById("similar").innerHTML = `${A.badge("AI", "ai")} ${hits.length || pages.length ? `Before you create — related: ${[...hits.map((i) => A.itemLink(i.id)), ...pages.slice(0, 4).map((w) => A.ref(w.id))].join(" · ")}` : "No similar items found."}`;
    };
    f.onsubmit = (e) => {
      e.preventDefault();
      const p = A.project(pid), me = A.persona();
      const a = attrs(), id = A.nextItemCode(p, a);
      DB.items.push({ id, projectId: pid, typeId: f.type.value, priority: a.priority, fields: a.fields, title: f.title.value, stage: A.itemType(f.type.value).stages[0], gateMode: f.gate.value, requesterId: me.id, ownerId: A.can("item.create") ? me.id : null,
        created: App.today, releaseId: null, wikiIds: [], log: { request: { by: me.id, at: App.today, summary: f.why.value || "(no description)" } }, acceptance: [], prs: [], tests: [], relatedIncidentIds: [] });
      const reqs = picked();
      reqs.forEach((r) => { DB.requestItemLinks.push({ requestId: r.id, itemId: id }); if (r.status !== "declined") r.status = "accepted"; });
      A.toast(`${id} created${reqs.length ? " · linked to " + reqs.map((r) => r.id).join(", ") : ""}`);
      location.hash = `/p/${pid}/item/${id}`;
    };
  };
})();
