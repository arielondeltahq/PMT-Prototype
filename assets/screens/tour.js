/* Tour — the landing page. Every screen and demo is reachable from here, with the right persona (?as=) per step. */
(function () {
  const A = App;
  const P = "/p/p-payflow";
  const go = (href, as, label) => `<a class="btn sm" href="#${href}${href.includes("?") ? "&" : "?"}as=${as}">${label} <span class="muted">as ${A.esc(A.user(as).name)}</span></a>`;
  const CH = [
    ["1 · Request intake", "Business, PM, Dev and QA submit requests through a form (seeded from the current Google Form). The PM triages them and links them to items (many ↔ many).", [
      go(`${P}/requests/new`, "u4", "Submit a customer request"), go(`${P}/requests`, "u2", "Triage inbox"), go(`${P}/request/REQ-6`, "u2", "REQ-6 (also sent to ShipTrack)"), go(`${P}/new?fromReq=REQ-6`, "u2", "Create item from requests + ✨ description")]],
    ["2 · Requirement / PRD", "The PRD is written in PMT: rich text, Figma embeds, comments, versions. Review is separate from publish (all approve → Publish, ≥1 → Force publish).", [
      go(`${P}/item/PAY-12/prd`, "u2", "PRD PAY-12 (published, comments, Figma)"), go(`${P}/item/PAY-12-AM-1/prd?v=draft`, "u4", "Review a PRD (approve)"), go(`${P}/item/PAY-12-AM-1/prd?v=draft`, "u2", "…then publish / force publish"), go(`${P}/item/PAY-20/prd`, "u2", "Issue out of date after rewind")]],
    ["3 · Crosscheck with discussions", "Discussions happen in meetings / Slack. Their notes are archived (read-only, context can be added). AI crosschecks them against the PRD and offers fixes.", [
      go(`${P}/item/PAY-23/prd`, "u3", "PAY-23 PRD → 🔎 Crosscheck"), go(`${P}/item/PAY-23/archive`, "u3", "Archive: highlights + context notes"), go(`${P}/archives?q=30 days`, "u2", "“Was ‘30 days’ ever discussed?”"), go(`${P}/archive/new?item=PAY-23`, "u3", "Archive a meeting (warning: no edits)")]],
    ["4 · Solution", "A structured decision card (no chat). Lead Dev approves; Eng Lead too when data/API changes.", [
      go(`${P}/item/PAY-21/solution`, "u5", "Solution PAY-21 (waiting Eng Lead)"), go(`${P}/item/PAY-21/solution`, "u1", "Approve as Eng Lead"), go(`${P}/item/PAY-12/solution`, "u5", "Approved solution PAY-12")]],
    ["5 · The thread & lenses", "One item, one thread. The same item looks different per role (lens).", [
      go(`${P}/item/PAY-20`, "u2", "PAY-20 · PM lens"), go(`${P}/item/PAY-20`, "u6", "PAY-20 · Dev lens"), go(`${P}/item/PAY-20`, "u4", "PAY-20 · Business lens"), go(`${P}/item/PAY-20`, "u9", "PAY-20 · QA lens"), go(`${P}/items`, "u2", "All items (pipeline)")]],
    ["6 · Sprints, board & automation", "Per-project sprints and quarters; carry over with a reason. Tasks sync with GitHub; rules move cards automatically.", [
      go(`${P}/sprints`, "u2", "Sprints & quarters (PAY-12 carried ×2)"), go(`${P}/board`, "u6", "Task board + automation")]],
    ["7 · QA, release & flags", "Blocked ≠ pass. Releases are held by a GitHub check when an item was rewound. Shipped ≠ launched (feature flags).", [
      go(`${P}/item/PAY-12`, "u8", "PAY-12 in QA (gate)"), go(`${P}/releases`, "u1", "Releases (held v3.8.0)")]],
    ["8 · Amendments", "Revision (rewind, same item) vs version (new item v2 after release).", [
      go(`${P}/item/PAY-20`, "u2", "PAY-20 rev 2 (rewind)"), go(`${P}/item/PAY-12/compare`, "u2", "PAY-12 v1 vs v2")]],
    ["9 · Knowledge, incidents & files", "Knowledge Center with AI answers + sources; incident back-tracking; files with access rules.", [
      go(`/knowledge?q=refund`, "u7", "Ask as a new intern"), go(`${P}/incident/INC-7`, "u1", "Incident INC-7 back-track"), go(`/files`, "u2", "Files & AI-readable knowledge")]],
    ["10 · Dashboards per role", "Each role starts from its own view.", [
      go(P, "u4", "Business"), go(P, "u2", "PM"), go(P, "u1", "Eng Lead"), go(P, "u6", "Dev"), go(P, "u9", "QA")]],
    ["11 · Backoffice (admin)", "Master data is configurable: types & stages, roles, lenses & panels, request forms, customers, feedback widget.", [
      go(`/admin/roles`, "u1", "Roles & permissions"), go(`/admin/lenses?tab=panels`, "u1", "Lens & panels"), go(`/admin/request-forms`, "u1", "Request forms"), go(`/admin/feedback`, "u1", "Feedback widget"), go(`${P}/settings/code`, "u2", "Project settings (code format)")]],
  ];

  App.screens.tour = () => `
    <h1>Delta PMT — Project Management Tools <span class="badge ai">prototype</span></h1>
    <div class="card mb">
      <p><b>One app per project for every role</b>: request → PRD → solution → tasks → code → QA → release → learning, as one traceable thread, so knowledge is not lost when people change or miscommunicate. Connected to GitHub (issues, PRs, wiki, release check).</p>
      <ul class="small">
        <li><b>View as</b> (top right) switches the person. Every button below opens the page <i>as</i> the right person.</li>
        <li>All pages share one set of example data. What you change is kept in this browser (also after reload); use <a href="javascript:App.resetData()">↺ Reset demo data</a> to start over.</li>
        <li>Today in the prototype is <b>${A.today}</b>. There is no backend and no real AI — AI output is simulated.</li>
      </ul>
      <div class="row"><a class="btn primary" href="flow-demo.html">🎬 Start with the 5-step story: request → development</a><a class="btn" href="lens-demo.html">🎬 Lens demo</a><a class="btn" href="guide.html">📖 User guide (Bahasa Indonesia)</a></div>
    </div>
    ${CH.map(([t, d, links]) => `<div class="card mb"><h2>${t}</h2><p class="small muted">${d}</p><div class="row" style="flex-wrap:wrap">${links.join("")}</div></div>`).join("")}`;
})();
