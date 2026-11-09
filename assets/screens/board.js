/* Task board — workflow statuses from master data; moves can be manual (drag) or automatic
 * (automation rules reacting to GitHub events). The simulator fires fake GitHub events. */
(function () {
  const A = App;

  const card = (t) => `<div class="tcard" draggable="true" data-id="${t.id}">
    <div class="spread"><span class="k">${A.itemLink(t.itemId)} · ${t.id}</span>${t.kind === "qa_finding" ? A.badge("QA finding", "fail") : ""}</div>
    <div>${A.esc(t.title)}</div>
    <div class="small mono muted">${t.issue ? "◎ " + t.issue : "no issue"}${t.pr ? `<br>⇄ ${t.pr.ref} (${t.pr.state})` : ""}</div>
    <div class="small muted">${A.who(t.assigneeId)}</div></div>`;

  App.screens.board = ({ pid }) => {
    const tasks = A.where("tasks", (t) => t.projectId === pid);
    const prTasks = tasks.filter((t) => t.pr && t.pr.state === "open");
    const testing = tasks.filter((t) => t.status === "testing");
    const log = DB.automationLog.filter((l) => tasks.some((t) => t.id === l.taskId)).slice(0, 6);
    return `
      <div class="spread mb"><div><h1>${A.esc(A.project(pid).name)} task board</h1><div class="muted small">Tasks are children of items; each can be synced to a GitHub Issue.</div></div>
        ${A.can("admin.manage") ? `<a class="btn sm" href="#/admin/automation">⚙ Automation rules</a>` : ""}</div>
      <div class="board" style="grid-template-columns:repeat(${DB.taskStatuses.length},minmax(170px,1fr))">
        ${DB.taskStatuses.map((s) => { const col = tasks.filter((t) => t.status === s.id);
          return `<div class="col" data-status="${s.id}"><h3>${s.name}<span class="muted">${col.length}</span></h3>${col.map(card).join("")}</div>`; }).join("")}
      </div>

      <div class="grid g2 mt">
        <div class="card">
          <h2>⚡ Simulate GitHub events</h2>
          <p class="small muted">In the real app these arrive via GitHub webhooks. Enabled rules move tasks automatically — nobody drags the card.</p>
          ${prTasks.map((t) => `<div class="spread mb"><span class="small"><span class="mono">${t.pr.ref}</span> closes ${t.pr.closes} <span class="muted">(${A.esc(t.title)} · ${A.find("taskStatuses", t.status).name})</span></span>
            <button class="btn sm" data-merge="${t.id}">Merge PR</button></div>`).join("") || '<p class="muted small">No open PRs.</p>'}
          ${testing.map((t) => `<div class="spread mb"><span class="small">QA retest of <b>${A.esc(t.title)}</b></span><button class="btn sm" data-fail="${t.id}">Mark retest failed</button></div>`).join("")}
        </div>
        <div class="card">
          <h2>Automation log</h2>
          ${log.map((l) => `<div class="small mb">${A.badge(l.ruleId, "ai")} ${A.esc(l.text)} <span class="muted">· ${l.at}</span></div>`).join("") || '<p class="muted small">No automated moves yet.</p>'}
        </div>
      </div>`;
  };

  App.after.board = () => {
    document.querySelectorAll(".tcard").forEach((el) => (el.ondragstart = (e) => e.dataTransfer.setData("text/plain", el.dataset.id)));
    document.querySelectorAll(".col[data-status]").forEach((col) => {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add("over"); };
      col.ondragleave = () => col.classList.remove("over");
      col.ondrop = (e) => {
        e.preventDefault();
        const t = A.find("tasks", e.dataTransfer.getData("text/plain"));
        if (t && t.status !== col.dataset.status) {
          DB.automationLog.unshift({ at: "just now", ruleId: "manual", taskId: t.id, text: `${A.persona().name} moved ${t.id} ${A.find("taskStatuses", t.status).name} → ${A.find("taskStatuses", col.dataset.status).name}` });
          t.status = col.dataset.status;
          if (t.issue) A.toast(`Synced to GitHub issue ${t.issue}`);
        }
        A.render();
      };
    });
    document.querySelectorAll("[data-merge]").forEach((b) => (b.onclick = () => {
      const t = A.find("tasks", b.dataset.merge);
      t.pr.state = "merged";
      const lines = A.fireEvent("pr_merged", t);
      A.toast(lines.length ? "⚡ " + lines[0] : `${t.pr.ref} merged — no rule matched (${A.find("taskStatuses", t.status).name})`);
      A.render();
    }));
    document.querySelectorAll("[data-fail]").forEach((b) => (b.onclick = () => {
      const lines = A.fireEvent("retest_failed", A.find("tasks", b.dataset.fail));
      A.toast(lines.length ? "⚡ " + lines[0] : "No rule matched");
      A.render();
    }));
  };
})();
