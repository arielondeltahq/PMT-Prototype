/* Feedback widget — floating "💬 Feedback" button on every page while the feedback period is open.
 * Admin turns it on/off and sets the period (Backoffice → Feedback widget). #/feedback always works, so the link can be shared
 * any time even when the floating button is hidden. Each entry records the page / item stage it was sent from. */
(function () {
  const A = App;
  const CATS = { missing: "Something is missing", better: "Better to have", confusing: "Confusing", bug: "Bug" };
  const TODAY = App.today;
  const active = () => { const c = DB.feedbackConfig; return c.enabled && (!c.from || TODAY >= c.from) && (!c.to || TODAY <= c.to); };
  let last = { area: "", route: "" }, open = false, lastM = null;
  const redraw = () => lastM && (document.getElementById("feedbackWidget").innerHTML = App.screens.feedbackWidget(lastM));

  function areaOf(m) {
    const it = m.params.iid && A.find("items", m.params.iid);
    const label = { thread: "Item", prd: "PRD", requests: "Requests", newRequest: "Requests · New request", request: "Request detail", newItem: "New item", board: "Task board",
      releases: "Releases", dashboard: "My view", knowledge: "Knowledge", files: "Files", lensManager: "Lens & panels", projectSettings: "Project settings" }[m.name] || m.name;
    return it ? `${label} · ${A.stage(it.stage).name}` : label;
  }

  const form = (id) => `<form id="${id}" onsubmit="event.preventDefault();App.fbSend(this)">
      <div class="small muted">${A.esc(DB.feedbackConfig.prompt)}</div>
      <div class="small mt-s">About: <input name="area" value="${A.esc(last.area)}" style="width:100%"></div>
      <div class="small mt-s">${Object.entries(CATS).map(([k, v], i) => `<label style="display:inline-block;margin-right:8px"><input type="radio" name="cat" value="${k}" ${i ? "" : "checked"}> ${v}</label>`).join("")}</div>
      <textarea name="text" rows="4" required style="width:100%" class="mt-s" placeholder="Tell us what would make this step better"></textarea>
      <div class="row mt-s"><button class="btn primary sm">Send</button><span class="small muted">as ${A.esc(A.persona().name)}</span></div></form>`;

  App.screens.feedbackWidget = (m) => {
    lastM = m;
    last = { area: areaOf(m), route: location.hash.slice(1).split("?")[0] };
    if (m.name === "feedbackPage" || !(active() || m.params.feedback)) return "";
    return `<button class="btn primary fb-fab" onclick="App.fbToggle()">💬 Feedback</button>${open ? `<div class="fb-pop"><div class="row" style="justify-content:space-between"><b>Feedback</b><a href="javascript:App.fbToggle()">✕</a></div>${form("fbPop")}</div>` : ""}`;
  };
  App.fbToggle = () => { open = !open; redraw(); };
  App.fbSend = (f) => {
    DB.feedback.push({ id: "FB-" + (DB.feedback.length + 1), by: A.persona().id, at: TODAY, route: last.route, area: f.area.value, category: f.cat.value, text: f.text.value });
    open = false; A.toast("Thanks — feedback sent"); f.id === "fbPage" ? A.render() : redraw();
  };

  // Always-available page (shareable link), independent of the on/off switch.
  App.screens.feedbackPage = () => `<h1>Feedback</h1><p class="muted mb">This page is always open, even when the floating button is turned off. ${active() ? "" : A.badge("floating button currently off")}</p><div class="card" style="max-width:520px">${form("fbPage")}</div>`;

  App.screens.feedbackAdmin = ({ cat = "all" }) => {
    if (!A.can("admin.manage")) return `<h1>Feedback widget</h1><div class="callout">${A.esc(A.whyNot("admin.manage"))}</div>`;
    const c = DB.feedbackConfig, rows = DB.feedback.filter((f) => cat === "all" || f.category === cat);
    const byArea = rows.reduce((m, f) => ((m[f.area] = m[f.area] || []).push(f), m), {});
    return `<h1>Backoffice — Feedback widget</h1>
      <form class="card" style="max-width:640px" onsubmit="event.preventDefault();Object.assign(DB.feedbackConfig,{enabled:this.en.checked,from:this.from.value,to:this.to.value,prompt:this.prompt.value});App.toast('Saved');App.render()">
        <label><input type="checkbox" name="en" ${c.enabled ? "checked" : ""}> Show floating feedback button</label>
        <div class="row mt-s small">Open period: <input type="date" name="from" value="${c.from}"> → <input type="date" name="to" value="${c.to}"> <span class="muted">(empty = no limit)</span></div>
        <div class="mt-s small">Prompt<br><input name="prompt" value="${A.esc(c.prompt)}" style="width:100%"></div>
        <div class="row mt"><button class="btn primary sm">Save</button> ${active() ? A.badge("Active now", "pass") : A.badge("Hidden now")}
          <span class="small">Always-on link: <a href="#/feedback" class="mono">#/feedback</a> · force the button on any page with <span class="mono">?feedback=1</span></span></div>
      </form>
      <div class="row mt mb">${[["all", "All"], ...Object.entries(CATS)].map(([k, v]) => `<a class="btn sm ${k === cat ? "primary" : ""}" href="#/admin/feedback?cat=${k}">${v}</a>`).join("")}</div>
      ${Object.entries(byArea).map(([area, fs]) => `<div class="card mb"><h2>${A.esc(area)} <span class="muted small">(${fs.length})</span></h2>
        ${fs.map((f) => `<div class="small mt-s">${A.badge(CATS[f.category])} ${A.esc(f.text)} <span class="muted">— ${A.who(f.by)}, ${f.at} · <a href="#${f.route}">open page</a></span></div>`).join("")}</div>`).join("") || '<p class="muted">No feedback yet.</p>'}`;
  };
})();
