/* Incidents — backtracking along recorded thread links, facts vs hypotheses vs confirmed,
 * and prevention actions that feed back into knowledge. */
(function () {
  const A = App;

  App.screens.incidents = ({ pid }) => {
    const list = A.where("incidents", (i) => i.projectId === pid);
    return `<div class="spread mb"><h1>${A.esc(A.project(pid).name)} incidents</h1><button class="btn primary" onclick="App.toast('Prototype: report incident')">+ Report incident</button></div>
      <div class="card">${list.length ? `<table>${list.map((i) => `<tr><td class="mono">${i.id}</td><td><a href="#/p/${pid}/incident/${i.id}">${A.esc(i.title)}</a></td><td>${A.badge(i.severity, "critical")}</td><td>${A.badge(i.status)}</td><td class="small">${i.at}</td></tr>`).join("")}</table>` : '<p class="muted">No incidents.</p>'}</div>`;
  };

  function chainRef(b) {
    if (b.kind === "stage") { const [iid, s] = b.ref.split("/"); return `${A.itemLink(iid)} · stage <b>${A.stage(s).name}</b>`; }
    if (b.kind === "test") return `<span class="mono">${A.esc(b.ref)}</span>`;
    return A.ref(b.ref);
  }

  App.screens.incident = ({ pid, incid }) => {
    const x = A.find("incidents", incid);
    if (!x) return "<p>Incident not found.</p>";
    return `
      <div class="muted small">${x.id} · ${x.at}</div>
      <h1>🔥 ${A.esc(x.title)}</h1>
      <div class="row mb">${A.badge(x.severity, "critical")}${A.badge(x.status)}<span class="muted">${A.esc(x.impact)}</span></div>
      <div class="callout small mb">Illustrative scenario (Bug A masks Bug B). Replace with the real incident.</div>

      <div class="grid g2">
        <div class="card">
          <h2>Backtrack ${A.badge("from recorded thread links", "pass")}</h2>
          <div class="chain">
            <div class="link">🔥 <b>${x.id}</b> ${A.esc(x.title)}</div>
            ${x.backtrack.map((b) => `<div class="arrow">↑</div><div class="link">${chainRef(b)}<div class="small muted">${A.esc(b.note)}</div></div>`).join("")}
          </div>
          <h3 class="mt">Files & evidence</h3>${A.attachments("incident", x.id)}
          <p class="small muted mt">Revealed by ${A.itemLink(x.revealedBy)} · fixed by ${A.itemLink(x.fixedBy)} · postmortem ${A.ref(x.postmortem)}</p>
        </div>

        <div>
          <div class="card mb"><h2>Facts ${A.badge("from systems", "pass")}</h2><ul>${x.facts.map((f) => `<li>${A.esc(f)}</li>`).join("")}</ul></div>
          <div class="card ai-panel mb"><h2>${A.badge("AI", "ai")} Hypotheses</h2>${x.hypotheses.map((h) => `<div class="ai-item">${A.esc(h.text)} <span class="conf">${Math.round(h.confidence * 100)}% · correlation, needs confirmation</span></div>`).join("")}</div>
          <div class="card mb"><h2>Confirmed ${A.badge("by human", "pass")}</h2><ul>${x.confirmed.map((c) => `<li>${A.esc(c)}</li>`).join("")}</ul></div>
          <div class="card"><h2>Prevention → back into knowledge</h2>
            ${x.prevention.map((p) => `<div class="mb">${p.done ? "☑" : "☐"} ${A.esc(p.text)} ${p.ref ? A.ref(p.ref) : A.btn("item.create", "Create item", "App.toast('Prototype: creates a tech-debt item linked to " + x.id + "')", "sm")}</div>`).join("")}
            <p class="small muted">Future items touching the same area (e.g. ${A.itemLink("PAY-12")}) automatically surface this incident.</p></div>
        </div>
      </div>`;
  };
})();
