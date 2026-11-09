/* Knowledge Center — GitHub Wiki pages (primary source) + knowledge captured from threads
 * (decisions, stage records) + incidents. Global (/knowledge) or per project. */
(function () {
  const A = App;
  const CAT = { product_context: "Product context", business_rule: "Business rules", glossary: "Glossary", prd: "PRD", decision: "Decisions", architecture: "Architecture", runbook: "Runbooks", postmortem: "Postmortems", standard: "Company standards" };

  App.screens.knowledge = ({ pid, q = "", cat }) => {
    const ql = q.toLowerCase();
    const inScope = (projectId) => !pid || projectId === pid || projectId === null;
    const pages = A.where("wikiPages", (w) => inScope(w.projectId) && (!cat || w.category === cat) && (!ql || (w.title + " " + w.body).toLowerCase().includes(ql)));
    // Decisions captured from threads (not written separately).
    const decisions = DB.items.filter((i) => inScope(i.projectId)).flatMap((i) => Object.entries(i.log).flatMap(([s, r]) => (r.decisions || []).map((d) => ({ i, s, d, r }))))
      .filter((x) => !ql || x.d.toLowerCase().includes(ql));
    const items = ql ? DB.items.filter((i) => inScope(i.projectId) && (i.title + " " + Object.values(i.log).map((r) => r.summary).join(" ")).toLowerCase().includes(ql)) : [];
    const base = pid ? `/p/${pid}/knowledge` : "/knowledge";

    return `
      <h1>${pid ? A.esc(A.project(pid).name) + " knowledge" : "Knowledge Center"}</h1>
      <p class="muted mb">Primary source: GitHub Wiki. Plus everything captured along item threads. ${pid ? "" : "All projects are <b>shared</b> for now."}</p>
      ${A.askBox()}
      <form class="row mb" onsubmit="event.preventDefault();location.hash='${base}?q='+encodeURIComponent(this.q.value)">
        <input name="q" value="${A.esc(q)}" placeholder="Search…" style="width:320px" /><button class="btn">Search</button>
        <a class="btn sm ${!cat ? "primary" : ""}" href="#${base}">All</a>
        ${Object.entries(CAT).map(([k, v]) => `<a class="btn sm ${cat === k ? "primary" : ""}" href="#${base}?cat=${k}">${v}</a>`).join("")}
      </form>

      <div class="grid" style="grid-template-columns:2fr 1fr">
        <div class="card">
          <h2>Wiki pages (${pages.length})</h2>
          <table>${pages.map((w) => {
            const stale = A.daysSince(w.updated) > 180;
            return `<tr><td>${A.ref(w.id)}${w.sensitive ? " " + A.badge("sensitive", "critical") : ""}<div class="small muted">${w.projectId ? A.esc(A.project(w.projectId).name) : "Company-wide"} · ${A.esc(A.find("repos", w.repoId).fullName)}.wiki</div></td>
              <td>${A.badge(CAT[w.category])}</td><td class="small">${w.updated}${stale ? "<br>" + A.badge("possibly outdated", "blocked") : ""}</td></tr>`;
          }).join("") || '<tr><td class="muted">No pages.</td></tr>'}</table>
        </div>
        <div>
          <div class="card mb"><h2>🧭 Decisions from threads</h2>
            ${decisions.map((x) => `<div class="small mb">${A.esc(x.d)}<div class="muted">${A.itemLink(x.i.id)} · ${A.stage(x.s).name} · ${A.who(x.r.by)}</div></div>`).join("") || '<p class="muted small">None.</p>'}</div>
          ${items.length ? `<div class="card"><h2>Matching items</h2>${items.map((i) => `<div class="small">${A.itemLink(i.id)} ${A.esc(i.title)}</div>`).join("")}</div>` : ""}
        </div>
      </div>`;
  };

  App.screens.wiki = ({ wid }) => {
    const w = A.find("wikiPages", wid);
    if (!w) return "<p>Page not found.</p>";
    if (!A.canRead(w)) return `<h1>🔒 Restricted page</h1><div class="callout">${A.esc(A.whyNot("knowledge.sensitive"))}</div>`;
    const backlinks = DB.items.filter((i) => i.wikiIds.includes(w.id) || Object.values(i.log).some((r) => (r.artifacts || []).some((a) => a.ref === w.id)));
    const stale = A.daysSince(w.updated) > 180;
    return `
      <div class="muted small">${A.esc(A.find("repos", w.repoId).fullName)}.wiki · ${A.badge(CAT[w.category])} · updated ${w.updated} by ${A.who(w.by)}</div>
      <div class="spread"><h1>${A.esc(w.title)}</h1><div class="row">${A.btn("knowledge.edit", "Edit", "App.toast('Prototype: edit & push to GitHub Wiki')", "sm")}<a class="btn sm" href="#" onclick="App.toast('Prototype: opens GitHub Wiki');return false">Open on GitHub ↗</a></div></div>
      ${stale ? `<div class="callout mb small">⚠ Possibly outdated: ${A.daysSince(w.updated)} days since last update, while related items changed since. <button class="btn sm" onclick="App.toast('Prototype: AI proposes an update diff for review')">Ask AI to propose update</button></div>` : ""}
      <div class="grid" style="grid-template-columns:2fr 1fr">
        <div class="card">${w.body.split("\n").map((l) => `<p>${A.esc(l)}</p>`).join("")}</div>
        <div class="card"><h2>Attached files</h2>${A.attachments("wiki_page", w.id)}<h2 class="mt">Used by items</h2>${backlinks.map((i) => `<div>${A.itemLink(i.id)} ${A.esc(i.title)} ${A.stageBadge(i.stage)}</div>`).join("") || '<p class="muted small">No links.</p>'}</div>
      </div>`;
  };
})();
