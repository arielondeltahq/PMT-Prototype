/* Sprints & quarters (ADR-021).
 * - Sprints are per project (each team has its own calendar and length).
 * - Sprints are usually 2 weeks; quarter (Q1–Q4) is derived from the sprint's start date.
 * - Every item has a current sprint (and so a quarter). itemSprints keeps one row per sprint the item was in.
 * - Closing a sprint: unfinished items are carried over to the next sprint with a reason (default), or marked done / moved back to backlog.
 *   History stays visible: "carried over ×2" on the item, with each reason. */
(function () {
  const A = App;
  const OUT = { planned: ["planned", ""], active: ["in sprint", "ai"], done: ["done", "pass"], carried_over: ["carried over", "blocked"] };

  App.screens.sprints = ({ pid, s: sel }) => {
    const items = DB.items.filter((i) => i.projectId === pid);
    const mine = DB.sprints.filter((s) => s.projectId === pid);
    const byQ = mine.reduce((m, s) => ((m[A.quarterOf(s.start)] = m[A.quarterOf(s.start)] || []).push(s), m), {});
    const active = mine.find((s) => s.state === "active") || mine[0], cur = mine.find((s) => s.id === sel) || active;
    if (!cur) return `<h1>Sprints — ${A.esc(A.project(pid).name)}</h1><p class="muted">No sprints set up for this project.</p>`;
    const rows = DB.itemSprints.filter((r) => r.sprintId === cur.id && items.some((i) => i.id === r.itemId));
    const unplanned = items.filter((i) => !A.planOf(i.id));
    const next = mine.find((s) => s.start > cur.start);
    const closing = cur.state === "active" && A.can("sprint.manage");
    return `<h1>Sprints & quarters — ${A.esc(A.project(pid).name)}</h1>
      <p class="small muted mb">Every item has a quarter and a sprint. Unfinished items are carried over to the next sprint — with a reason — and the history stays on the item.</p>
      ${Object.entries(byQ).map(([q, ss]) => `<div class="row mb"><b style="width:80px">${q}</b>${ss.map((s) => { const n = DB.itemSprints.filter((r) => r.sprintId === s.id && items.some((i) => i.id === r.itemId)).length;
        return `<a class="btn sm ${s.id === cur.id ? "primary" : ""}" href="#/p/${pid}/sprints?s=${s.id}">${s.name} <span class="muted">${s.start.slice(5)}–${s.end.slice(5)} · ${n}</span>${s.state === "active" ? " ●" : ""}</a>`; }).join("")}</div>`).join("")}
      <div class="card"><div class="spread"><h2>${cur.name} <span class="small muted">${cur.start} → ${cur.end} · ${A.quarterOf(cur.start)} · ${cur.state}</span></h2></div>
        <table><tr><th>Item</th><th>Stage</th><th>In this sprint</th><th>Sprint history</th>${closing ? "<th>At sprint close</th>" : ""}</tr>
        ${rows.map((r) => { const it = A.find("items", r.itemId), pl = A.planOf(it.id), finished = A.isReleased(it) || r.outcome === "done";
          return `<tr><td>${A.itemLink(it.id)} ${A.esc(it.title)}</td><td>${A.stageBadge(it.stage)}</td><td>${A.badge(...OUT[r.outcome])}${r.reason ? `<div class="small muted">${A.esc(r.reason)}</div>` : ""}</td>
            <td class="small">${pl.rows.map((x) => `${x.sprint.name} ${A.badge(...OUT[x.outcome])}`).join(" → ")}</td>
            ${closing ? `<td>${r.outcome === "active" ? `<select data-item="${A.esc(it.id)}" class="closeAct"><option value="carry" ${finished ? "" : "selected"}>Carry over → ${next ? next.name : "next"}</option><option value="done" ${finished ? "selected" : ""}>Done</option><option value="backlog">Back to backlog</option></select>
              <input class="closeWhy" data-item="${A.esc(it.id)}" placeholder="Reason (required to carry over)" style="width:100%;margin-top:4px">` : ""}</td>` : ""}</tr>`; }).join("") || `<tr><td colspan="5" class="muted">No items.</td></tr>`}</table>
        ${closing && rows.length ? `<button class="btn primary mt" onclick="App.closeSprint('${pid}','${cur.id}','${next?.id || ""}')">Close ${cur.name}</button>` : ""}</div>
      <div class="card mt"><h2>Not in any sprint (${unplanned.length})</h2>
        ${unplanned.map((i) => `<div class="row small mt-s">${A.itemLink(i.id)} ${A.esc(i.title)} ${A.btn("sprint.manage", `+ Add to ${cur.name}`, `App.planItem('${A.esc(i.id)}','${cur.id}')`, "sm")}</div>`).join("") || '<p class="small muted">All items are planned.</p>'}</div>`;
  };

  App.planItem = (iid, sid) => { DB.itemSprints.push({ itemId: iid, sprintId: sid, outcome: A.find("sprints", sid).state === "active" ? "active" : "planned" }); A.toast(`${iid} → ${A.find("sprints", sid).name}`); A.render(); };

  App.closeSprint = (pid, sid, nextId) => {
    const acts = [...document.querySelectorAll(".closeAct")].map((el) => ({ iid: el.dataset.item, act: el.value, why: document.querySelector(`.closeWhy[data-item="${el.dataset.item}"]`).value.trim() }));
    const missing = acts.filter((a) => a.act === "carry" && !a.why);
    if (missing.length) return A.toast(`Reason required to carry over: ${missing.map((a) => a.iid).join(", ")}`);
    acts.forEach(({ iid, act, why }) => {
      const row = DB.itemSprints.find((r) => r.itemId === iid && r.sprintId === sid);
      if (act === "done") row.outcome = "done";
      if (act === "carry") { Object.assign(row, { outcome: "carried_over", reason: why }); if (nextId) DB.itemSprints.push({ itemId: iid, sprintId: nextId, outcome: "active" }); }
      if (act === "backlog") Object.assign(row, { outcome: "carried_over", reason: "Moved back to backlog" + (why ? ": " + why : "") });
    });
    A.find("sprints", sid).state = "closed";
    if (nextId) A.find("sprints", nextId).state = "active";
    A.toast(`${A.find("sprints", sid).name} closed · ${acts.filter((a) => a.act === "carry").length} carried over`);
    location.hash = `/p/${pid}/sprints?s=${nextId || sid}`;
  };
})();
