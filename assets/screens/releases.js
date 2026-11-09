/* Releases — one release bundles many items (release train). Shows:
 * - release gate held by rewound items (ADR-013), mirrored as a GitHub required check on the release PR,
 * - shipped vs launched (feature flags, ADR-014), target vs projected date with reason. */
App.screens.releases = ({ pid }) => {
  const A = App;
  const p = A.project(pid);
  const rels = A.where("releases", (r) => r.projectId === pid).sort((a, b) => b.target.localeCompare(a.target));
  return `
    <div class="spread mb"><div><h1>${A.esc(p.name)} releases</h1><div class="small muted">Production branch <span class="mono">${A.esc(p.releaseConfig.productionBranch)}</span> · gate fail mode <b>${p.releaseConfig.failMode}</b></div></div>
      ${A.btn("release.manage", "+ Plan release", "App.toast('Prototype: plan release')", "primary")}</div>
    ${rels.map((r) => {
      const g = A.releaseGate(r);
      const launches = (r.launches || []).map((id) => A.find("items", id));
      return `<div class="card mb">
      <div class="spread"><h2>🚀 ${A.esc(r.version)} ${A.badge(r.state, r.state === "released" ? "pass" : "")} ${g.blocked ? A.badge("⛔ release held", "fail") : g.overridden ? A.badge("override", "blocked") : ""}</h2>
        <div class="small">target <b>${r.target}</b> · projected <b>${r.projected}</b> ${r.state === "planned" ? A.badge((r.confidence || "?") + " confidence", r.confidence === "high" ? "pass" : "blocked") : ""}</div></div>
      ${r.reason ? `<p class="small">${r.projected !== r.target ? "⚠ " : ""}${A.esc(r.reason)}</p>` : ""}
      ${g.reasons.length ? `<div class="callout ${g.blocked ? "red" : ""} small mb"><b>${g.blocked ? "Release held" : "Held — overridden"}:</b><ul>${g.reasons.map((x) => `<li>${A.itemLink(x.it.id)} ${A.esc(x.text.replace(x.it.id, ""))}</li>`).join("")}</ul>
        ${r.releasePR ? `<div class="mono">⎇ ${A.esc(r.releasePR.from)} → ${A.esc(r.releasePR.to)} · ${A.esc(r.releasePR.repo)}#${r.releasePR.number} · <b>Delta PMT / release gate</b> ${g.blocked ? "❌ failing (required) — merge blocked" : "✅ passing (override)"}</div>` : ""}
        ${g.blocked ? `<div class="row mt-s">${A.btn("release.manage", "Override with reason", `App.screens._overrideRelease('${r.id}')`, "sm")}<span class="muted">or wait until the item re-passes QA</span></div>` : r.override ? `<div class="mt-s">Override by ${A.who(r.override.by)}: “${A.esc(r.override.reason)}”</div>` : ""}</div>`
        : r.releasePR && r.state === "planned" ? `<div class="small mono mb">⎇ ${A.esc(r.releasePR.from)} → ${A.esc(r.releasePR.to)} · ${A.esc(r.releasePR.repo)}#${r.releasePR.number} · Delta PMT / release gate ✅</div>` : ""}
      <h3>Shipped in this release (${r.itemIds.length})</h3>
      <table>${r.itemIds.map((id) => { const i = A.find("items", id), c = A.conformance(i);
        return `<tr><td>${A.itemLink(id)}</td><td>${A.esc(i.title)} ${A.typeBadge(i.typeId)} ${i.rev > 1 ? A.badge("rev " + i.rev, "blocked") : ""}
            ${i.releaseBranches ? `<div class="small mono muted">⎇ ${A.esc(i.releaseBranches.base)} → ${A.esc(i.releaseBranches.target)}</div>` : ""}
            ${(i.flags || []).map((f) => `<div class="small">${A.flagBadge(f)} ${f.state !== "on" && f.plannedLaunch ? `launch ${f.plannedLaunch}${f.launchReleaseId ? " in " + A.ref(f.launchReleaseId) : ""}` : ""}</div>`).join("")}</td>
          <td>${A.stageBadge(i.stage)}</td><td style="width:140px"><div class="bar"><span style="width:${A.progress(i) * 100}%"></span></div></td>
          <td class="small">${c ? `AC ${c.met}/${c.total}` : ""}</td></tr>`; }).join("") || '<tr><td class="muted small">No code shipped — flag-only release.</td></tr>'}</table>
      ${launches.length ? `<h3 class="mt">Launched in this release (feature flags) (${launches.length})</h3>
        <table>${launches.map((i) => `<tr><td>${A.itemLink(i.id)}</td><td>${A.esc(i.title)}</td><td>${i.flags.map(A.flagBadge).join(" ")} → ON</td><td class="small muted">code shipped in ${A.ref(i.releaseId)}</td></tr>`).join("")}</table>` : ""}
    </div>`; }).join("") || '<p class="muted">No releases.</p>'}`;
};

App.screens._overrideRelease = (rid) => {
  const reason = prompt("Override reason (recorded on the release and item threads):");
  if (!reason) return;
  App.find("releases", rid).override = { by: App.persona().id, at: App.today, reason };
  App.toast("Release gate overridden — GitHub check set to passing; logged");
  App.render();
};
