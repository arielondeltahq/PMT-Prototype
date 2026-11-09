/*
 * Mock data — also the DRAFT DATA MODEL (see docs/Base_Concept.md).
 * Top-level keys = future tables. Entities are flat and reference each other by id.
 * Master data (stages, itemTypes, roles, permissions, employmentTypes) is editable in Backoffice.
 */
window.DB = {
  workspace: { id: "ws-delta", name: "Delta HQ" },

  // ---------------- MASTER DATA ----------------
  stages: [
    { id: "requirement", name: "Requirement / PRD", ownerRole: "pm", gate: "PRD published after review (all reviewers approved, or ≥1 with force)" },
    { id: "solution", name: "Solution design", ownerRole: "lead_dev", gate: "Solution approved by Lead Dev" },
    { id: "breakdown", name: "Breakdown", ownerRole: "lead_dev", gate: "Every acceptance criterion has a task" },
    { id: "development", name: "Development", ownerRole: "dev", gate: "All PRs linked to the item" },
    { id: "review", name: "Review", ownerRole: "lead_dev", gate: "PRs approved; conformance checked" },
    { id: "qa", lensId: "qa", name: "QA", ownerRole: "lead_qa", gate: "All critical tests PASS (blocked/skipped ≠ pass)" },
    { id: "release", name: "Release", ownerRole: "eng_lead", gate: "Release sign-off" },
    { id: "production", name: "Production", ownerRole: "eng_lead", gate: "No new incident after 7 days" },
    { id: "learning", name: "Learning", ownerRole: "pm", gate: "Knowledge updated" },
  ],

  itemTypes: [
    { id: "feature", code: "FT", name: "Feature", color: "#4f46e5", defaultGate: "strict", stages: ["requirement", "solution", "breakdown", "development", "review", "qa", "release", "production", "learning"] },
    { id: "enhancement", code: "EN", name: "Enhancement", color: "#0891b2", defaultGate: "strict", stages: ["requirement", "solution", "breakdown", "development", "review", "qa", "release", "production", "learning"] },
    { id: "bugfix", code: "BUG", name: "Bug fix", color: "#dc2626", defaultGate: "advisory", stages: ["requirement", "development", "review", "qa", "release", "production", "learning"] },
    { id: "hotfix", code: "HF", name: "Hotfix", color: "#ea580c", defaultGate: "advisory", stages: ["development", "review", "qa", "release", "production", "learning"] },
    { id: "techdebt", code: "TD", name: "Tech debt", color: "#64748b", defaultGate: "advisory", stages: ["solution", "breakdown", "development", "review", "qa", "release"] },
    { id: "research", code: "RS", name: "Research", color: "#9333ea", defaultGate: "advisory", stages: ["requirement", "solution", "learning"] },
  ],

  permissions: [
    { key: "project.create", label: "Create project" },
    { key: "project.manage", label: "Manage settings of projects you lead (or all, for Admin)" },
    { key: "item.request", label: "Submit request (intake form)" },
    { key: "request.triage", label: "Triage requests (status, link / create items)" },
    { key: "item.create", label: "Create any item type" },
    { key: "item.amend", label: "Amend item (version / revision)" },
    { key: "item.advance", label: "Advance stage" },
    { key: "item.override_gate", label: "Override strict gate" },
    { key: "approve.requirement", label: "Approve PRD" },
    { key: "approve.solution", label: "Approve solution" },
    { key: "approve.pr", label: "Approve PR / review" },
    { key: "approve.testplan", label: "Approve test plan" },
    { key: "release.manage", label: "Manage releases" },
    { key: "knowledge.edit", label: "Edit knowledge" },
    { key: "knowledge.sensitive", label: "Read sensitive pages" },
    { key: "ai.ask", label: "Ask AI" },
    { key: "admin.manage", label: "Backoffice" },
    { key: "lens.manage", label: "Lens & panel management" },
    { key: "prd.edit", label: "Write / edit PRD" },
    { key: "solution.edit", label: "Write / edit Solution" },
    { key: "archive.add", label: "Add discussion archive" },
    { key: "sprint.manage", label: "Plan sprints & carry over items" },
  ],

  roles: [
    { id: "eng_lead", lensId: "eng_lead", name: "Engineering Lead", perms: ["prd.edit", "solution.edit", "archive.add", "sprint.manage", "item.amend", "item.request", "request.triage", "item.create", "item.advance", "item.override_gate", "approve.requirement", "approve.solution", "approve.pr", "approve.testplan", "release.manage", "knowledge.edit", "knowledge.sensitive", "ai.ask"] },
    { id: "business", lensId: "business", name: "Business", perms: ["archive.add", "item.request", "approve.requirement", "ai.ask"] },
    { id: "pm", lensId: "pm", name: "Project Manager", perms: ["prd.edit", "archive.add", "sprint.manage", "project.create", "project.manage", "item.amend", "item.request", "request.triage", "item.create", "item.advance", "approve.requirement", "knowledge.edit", "knowledge.sensitive", "ai.ask"] },
    { id: "lead_dev", lensId: "dev", name: "Lead Developer", perms: ["solution.edit", "archive.add", "sprint.manage", "item.amend", "item.create", "item.advance", "approve.solution", "approve.pr", "knowledge.edit", "knowledge.sensitive", "ai.ask"] },
    { id: "dev", lensId: "dev", name: "Developer", perms: ["archive.add", "item.advance", "knowledge.edit", "ai.ask"] },
    { id: "lead_qa", lensId: "qa", name: "Lead QA", perms: ["archive.add", "item.advance", "approve.testplan", "knowledge.edit", "knowledge.sensitive", "ai.ask"] },
    { id: "qa", name: "QA", perms: ["item.advance", "item.request", "ai.ask"] },
    { id: "admin", lensId: "admin", name: "Admin", perms: ["lens.manage", "admin.manage", "project.create", "project.manage"] },
  ],

  // ---------------- LENSES & PANEL LAYOUTS (ADR-016) ----------------
  // Panels are code (assets/screens/panels.js). Layout = data rows. column: main | side, stacked by order.
  // Resolution: lens×stage → lens×"*" → default×stage → default×"*".
  lenses: [
    { id: "default", name: "Default (fallback)" }, { id: "business", name: "Business" }, { id: "pm", name: "PM" }, { id: "eng_lead", name: "Eng Lead" },
    { id: "dev", name: "Developer" }, { id: "qa", name: "QA" }, { id: "admin", name: "Admin" },
  ],
  // [lens, stage, panel, span, order, variant?]
  layouts: [
    ["default", "*", "current_stage", "main", 1], ["default", "*", "conformance", "side", 2], ["default", "*", "ai_hint", "main", 3], ["default", "*", "traceability", "side", 4],
    ["business", "*", "plain_status", "main", 1], ["business", "*", "release_info", "side", 2], ["business", "*", "ai_hint", "side", 3, "plain"], ["business", "*", "ask_ai", "main", 4],
    ["pm", "requirement", "prd", "main", 1], ["pm", "requirement", "approvals", "side", 2], ["pm", "requirement", "ai_hint", "main", 3], ["pm", "requirement", "current_stage", "side", 4],
    ["pm", "development", "dev_progress", "main", 1], ["pm", "development", "blockers", "side", 2], ["pm", "development", "ai_hint", "main", 3], ["pm", "development", "approvals", "side", 4], ["pm", "development", "amendments", "main", 5],
    ["dev", "development", "dev_progress", "main", 1], ["dev", "development", "context_pack", "side", 2], ["dev", "development", "current_stage", "main", 3], ["dev", "development", "conformance", "side", 4],
    ["qa", "development", "qa_plan", "main", 1], ["qa", "development", "context_pack", "side", 2], ["qa", "development", "conformance", "main", 3],
    ["qa", "qa", "qa_plan", "main", 1], ["qa", "qa", "blockers", "side", 2], ["qa", "qa", "current_stage", "main", 3], ["qa", "qa", "conformance", "side", 4],
    ["eng_lead", "*", "blockers", "main", 1], ["eng_lead", "*", "release_info", "side", 2], ["eng_lead", "*", "current_stage", "main", 3], ["eng_lead", "*", "approvals", "side", 4], ["eng_lead", "*", "timeline", "main", 5],
    ["default", "*", "linked_requests", "side", 5], ["business", "*", "linked_requests", "side", 5], ["pm", "requirement", "linked_requests", "side", 5],
    ["dev", "solution", "solution", "main", 1], ["dev", "solution", "archive", "side", 2], ["dev", "solution", "prd", "main", 3], ["eng_lead", "solution", "solution", "main", 1], ["eng_lead", "solution", "archive", "side", 2], ["eng_lead", "solution", "blockers", "side", 3], ["default", "solution", "solution", "main", 1], ["default", "solution", "archive", "side", 2], ["default", "solution", "current_stage", "main", 3],
  ].map(([lens, stage, panel, column, order, variant]) => ({ lens, stage, panel, column, order, variant })),

  // deny: permissions removed regardless of role
  employmentTypes: [
    { id: "permanent", name: "Tetap", deny: [] },
    { id: "intern", name: "Intern", deny: ["item.override_gate", "approve.requirement", "approve.solution", "approve.pr", "approve.testplan", "release.manage", "knowledge.sensitive"], note: "Usually personal email; mentor required" },
  ],

  // ---------------- PEOPLE ----------------
  users: [
    { id: "u1", name: "Dewi", email: "dewi@deltahq.com", roleIds: ["eng_lead", "admin"], employment: "permanent", joined: "2021-03-01" },
    { id: "u2", name: "Rina", email: "rina@deltahq.com", roleIds: ["pm"], employment: "permanent", joined: "2023-02-01" },
    { id: "u3", name: "Yoga", email: "yoga@deltahq.com", roleIds: ["pm"], employment: "permanent", joined: "2026-10-20" },
    { id: "u4", name: "Hendra", email: "hendra@deltahq.com", roleIds: ["business"], employment: "permanent", joined: "2022-06-01" },
    { id: "u5", name: "Budi", email: "budi@deltahq.com", roleIds: ["lead_dev"], employment: "permanent", joined: "2020-08-01" },
    { id: "u6", name: "Andi", email: "andi@deltahq.com", roleIds: ["dev"], employment: "permanent", joined: "2024-01-15" },
    { id: "u7", name: "Nadia", email: "nadia.putri@gmail.com", roleIds: ["dev"], employment: "intern", joined: "2026-09-01", mentorId: "u6" },
    { id: "u8", name: "Sari", email: "sari@deltahq.com", roleIds: ["lead_qa"], employment: "permanent", joined: "2021-11-01" },
    { id: "u9", name: "Tono", email: "tono@deltahq.com", roleIds: ["qa"], employment: "permanent", joined: "2023-07-01" },
    { id: "u10", name: "Lala", email: "lala.ws@yahoo.com", roleIds: ["qa"], employment: "intern", joined: "2026-10-27", mentorId: "u9" },
  ],

  // ---------------- REQUESTS (ADR-017) ----------------
  // Intake lives outside the thread. Request N:M Item; a request is done when every linked item is released.
  customers: [
    { id: "C1", name: "PT Nusantara Hospitality", status: "existing", note: "Enterprise, 14 properties" },
    { id: "C2", name: "Bali Villas Group", status: "lead", note: "Pilot negotiation" },
    { id: "C3", name: "Grand Sentosa Hotel", status: "existing", note: "" },
    { id: "C4", name: "Kopi Kita Group", status: "existing", note: "F&B chain" },
  ],
  // Form templates are data (Backoffice). "voc" is seeded from the current Google Form (DELTA HQ — Customer Voice & Feature Request).
  // Field types: text | paragraph | single | multi | dropdown | customer. "maps" stores the answer in a first-class request column.
  // The form's "Which DELTA product/module" question is replaced by the request's project + "also publish to other projects".
  requestTemplates: [
    { id: "voc", name: "Customer Voice (VoC) & Feature Request", forRoles: ["business", "pm", "admin"],
      desc: "For Sales & Customer Success: capture customer requests, workflows, pain points, desired outcomes and commercial impact. One distinct customer issue per submission. Product reviews and prioritises; submission does not guarantee a feature or delivery date.",
      sections: [
        { title: "A — Account & product context", fields: [
          { key: "customer", label: "Company name", type: "customer", required: true, help: "Customer or prospective customer organisation (master customer; add new if missing). Status Lead / Existing Client is stored on the customer.", maps: "customerId" },
        ] },
        { title: "B — Customer job, problem & desired outcome", fields: [
          { key: "ask", label: "What exactly did the customer ask for?", type: "paragraph", required: true, help: "Record the customer's original wording or closest accurate paraphrase.", maps: "title" },
          { key: "who", label: "Who is performing the job or experiencing the problem?", type: "multi", required: true, other: true, options: ["Reservations", "Front Desk", "Housekeeping", "Accounting & Finance", "Property Manager", "Property Owner", "Guest", "Travel Agent", "Head Office"] },
          { key: "today", label: "What is the customer trying to do today, how are they handling it now, and what goes wrong?", type: "paragraph", required: true },
          { key: "outcome", label: "What outcome would the customer like to achieve?", type: "paragraph", required: true },
          { key: "scale", label: "How often does this problem occur, and how many people, properties or transactions are affected?", type: "paragraph" },
        ] },
        { title: "C — Commercial impact & customer urgency", fields: [
          { key: "impact", label: "What is the business consequence of this request?", type: "single", required: true, help: "Select the main impact.", maps: "impact",
            options: ["New business deal blocker", "Existing-client churn risk", "Expansion or upsell opportunity", "Customer operational efficiency or cost savings", "Guest experience or service quality", "Compliance, security or operational risk", "Unknown"] },
          { key: "value", label: "If known, what is the related contract value or incremental revenue impact?", type: "paragraph", help: "Leave blank when unknown." },
          { key: "urgency", label: "How urgently does the customer need a solution?", type: "dropdown", required: true, options: ["Critical", "High", "Medium", "Low", "Unknown"], maps: "urgency" },
          { key: "deadline", label: "By when does the customer need a solution, and why?", type: "paragraph" },
        ] },
        { title: "D — Proposed ideas & supporting evidence", fields: [
          { key: "idea", label: "Is there a solution or improvement suggested by the customer or Sales?", type: "paragraph" },
          { key: "links", label: "What supporting documents or links are available?", type: "paragraph", help: "Or attach files after submitting." },
        ] },
      ] },
    { id: "internal", name: "Internal request (PM / Dev / QA)", forRoles: ["pm", "eng_lead", "lead_dev", "dev", "lead_qa", "qa", "admin"],
      desc: "Ideas, tech debt, tooling or process needs from inside the team. No customer data required.",
      sections: [
        { title: "Request", fields: [
          { key: "ask", label: "What do you need?", type: "paragraph", required: true, maps: "title" },
          { key: "today", label: "What happens today and why is it a problem?", type: "paragraph", required: true },
          { key: "kind", label: "Kind", type: "single", required: true, options: ["New capability", "Improvement", "Tech debt / reliability", "Tooling / process", "Research question"] },
          { key: "urgency", label: "Urgency", type: "dropdown", required: true, options: ["Critical", "High", "Medium", "Low", "Unknown"], maps: "urgency" },
          { key: "links", label: "Links / evidence", type: "paragraph" },
        ] },
      ] },
  ],
  // status: new | needs_info | accepted | declined (stored); "in progress" / "done" are derived from linked items.
  // groupId: the same request published to several projects at once.
  requests: [
    { id: "REQ-1", projectId: "p-payflow", templateId: "voc", customerId: "C1", requesterId: "u4", created: "2026-09-01", status: "accepted", urgency: "High", impact: "Existing-client churn risk",
      title: "Refund only part of an invoice instead of full refund + re-invoice",
      answers: { who: ["Accounting & Finance", "Front Desk"], today: "Finance refunds the whole invoice and issues a new one. ~12 tickets/month, reconciliation is messy.", outcome: "Refund any amount up to what was paid, in one step.", scale: "14 properties, ~12 cases/month", value: "Renewal Rp 480jt/yr at risk" } },
    { id: "REQ-2", projectId: "p-payflow", templateId: "voc", customerId: "C3", requesterId: "u4", created: "2026-09-05", status: "accepted", urgency: "Medium", impact: "Guest experience or service quality",
      title: "Guest overpaid deposit, want to return the difference", answers: { who: ["Front Desk", "Guest"], today: "Front desk returns cash manually.", outcome: "Refund the difference to the original payment." } },
    { id: "REQ-3", projectId: "p-payflow", templateId: "voc", customerId: "C2", requesterId: "u4", created: "2026-09-12", status: "accepted", urgency: "High", impact: "New business deal blocker",
      title: "Partial refunds are a must-have for the villa pilot", answers: { who: ["Property Owner", "Accounting & Finance"], today: "Competitor supports partial refund; we don't.", outcome: "Partial refund available before pilot.", value: "Pilot Rp 300jt", deadline: "Before end of Nov 2026 — pilot contract signing" } },
    { id: "REQ-4", projectId: "p-payflow", templateId: "voc", customerId: "C1", requesterId: "u4", created: "2026-11-02", status: "accepted", urgency: "High", impact: "Existing-client churn risk",
      title: "Refunds for virtual-account payments must go back to the VA", answers: { who: ["Accounting & Finance"], today: "VA payments can't be refunded in-app.", outcome: "Refund to the VA automatically." } },
    { id: "REQ-5", projectId: "p-payflow", templateId: "voc", customerId: "C4", requesterId: "u4", created: "2026-10-20", status: "accepted", urgency: "Medium", impact: "Existing-client churn risk",
      title: "In low season we want to pause, and invoices on resume must arrive fast", answers: { who: ["Head Office", "Accounting & Finance"], today: "They cancel in low season and re-subscribe; resumed invoices take ~20s each to email in bulk.", outcome: "Pause without cancelling; invoices out within seconds on resume." } },
    { id: "REQ-6", groupId: "G-1", projectId: "p-payflow", templateId: "voc", customerId: "C1", requesterId: "u4", created: "2026-11-04", status: "new", urgency: "Medium", impact: "Guest experience or service quality",
      title: "Send WhatsApp notifications instead of only email", answers: { who: ["Guest", "Front Desk"], today: "Guests miss emails about payments and deliveries.", outcome: "WhatsApp notification for payment & shipment events." } },
    { id: "REQ-7", groupId: "G-1", projectId: "p-shiptrack", templateId: "voc", customerId: "C1", requesterId: "u4", created: "2026-11-04", status: "new", urgency: "Medium", impact: "Guest experience or service quality",
      title: "Send WhatsApp notifications instead of only email", answers: { who: ["Guest", "Front Desk"], today: "Guests miss emails about payments and deliveries.", outcome: "WhatsApp notification for payment & shipment events." } },
    { id: "REQ-8", projectId: "p-payflow", templateId: "internal", customerId: null, requesterId: "u5", created: "2026-10-11", status: "accepted", urgency: "High",
      title: "PDF rendering blocks API workers under load", answers: { today: "p95 latency spikes during month-end invoicing.", kind: "Tech debt / reliability" } },
    { id: "REQ-9", projectId: "p-payflow", templateId: "voc", customerId: "C3", requesterId: "u4", created: "2026-10-28", status: "needs_info", urgency: "Unknown", impact: "Unknown",
      title: "Customer wants 'better reports'", answers: { who: ["Head Office"], today: "Unclear.", outcome: "Unclear." }, triageNote: "Which report, which numbers? Please ask for an example." },
    { id: "REQ-10", projectId: "p-shiptrack", templateId: "internal", customerId: null, requesterId: "u9", created: "2026-10-20", status: "accepted", urgency: "High",
      title: "Recipients in WITA see ETA 1h early", answers: { today: "Found during regression; screenshot attached.", kind: "Improvement" } },
    { id: "REQ-11", projectId: "p-payflow", templateId: "voc", customerId: "C4", requesterId: "u4", created: "2026-10-15", status: "declined", urgency: "Low", impact: "Expansion or upsell opportunity",
      title: "Accept crypto payments", answers: { who: ["Head Office"], outcome: "Accept USDT." }, triageNote: "Declined: regulatory (BI) does not allow crypto as payment instrument." },
  ],
  // N:M — one request may need several items; several requests may be solved by one item.
  requestItemLinks: [
    { requestId: "REQ-1", itemId: "PAY-12" }, { requestId: "REQ-2", itemId: "PAY-12" }, { requestId: "REQ-3", itemId: "PAY-12" },
    { requestId: "REQ-4", itemId: "PAY-12-AM-1" },
    { requestId: "REQ-5", itemId: "PAY-23" }, { requestId: "REQ-5", itemId: "PAY-20" },
    { requestId: "REQ-8", itemId: "PAY-21" }, { requestId: "REQ-10", itemId: "SHP-6" },
  ],

  // ---------------- PRD (ADR-018) ----------------
  // 1 item = 1 PRD, written in-app (rich text: headings, lists, table, highlight, links, images). Export: PDF / MD / DOCX.
  // embeds: figma (live view-only embed, multiple) | link | image. Diagram block is planned (not MVP).
  prds: [
    { id: "PRD-PAY-12", itemId: "PAY-12", review: null, wikiId: "W-4", issue: { repo: "deltahq/payflow-api", number: 412, syncedVersion: 1 }, draftHtml: null, draftSavedAt: null,
      versions: [{ v: 1, by: "u2", at: "2026-09-15", note: "Initial PRD", forced: false, reviews: [{ userId: "u4", decision: "approved", at: "2026-09-15" }, { userId: "u1", decision: "approved", at: "2026-09-15" }], html: `<h2>Problem</h2><p>Enterprise customers need <b>partial refunds</b> instead of full refund + re-invoice (≈12 support tickets / month). Requested by 3 customers (REQ-1, REQ-2, REQ-3).</p>
<h2>Goals</h2><ul><li>Refund any amount up to what was paid, in one step.</li><li><mark>No double refunds</mark> on retries (see <a href="#/wiki/W-5">decision W-5</a>).</li></ul>
<h2>Acceptance criteria</h2><table><tr><th>ID</th><th>Criterion</th><th>Rule</th></tr><tr><td>AC1</td><td>Refund amount ≤ remaining refundable amount</td><td>BR-1</td></tr><tr><td>AC2</td><td>Multiple partial refunds until fully refunded</td><td>—</td></tr><tr><td>AC3</td><td>A retried refund request never refunds twice</td><td>W-5</td></tr><tr><td>AC4</td><td>Customer receives a refund email</td><td>—</td></tr><tr><td>AC5</td><td>Refund visible in invoice history</td><td>—</td></tr></table>
<h2>Out of scope</h2><p>Refund to virtual account (handled in v2, PAY-12-AM-1).</p>` }],
      comments: [
        { id: "CM-1", quote: "No double refunds", by: "u5", at: "2026-09-14", text: "Idempotency key per refund request or per invoice?", resolved: true, replies: [{ by: "u2", at: "2026-09-14", text: "Per refund request — see W-5." }] },
        { id: "CM-2", quote: "Refund email", by: "u9", at: "2026-09-16", text: "Which template? Need it for the QA test plan.", resolved: false, replies: [] },
      ],
      embeds: [
        { id: "E1", kind: "figma", title: "Refund flow — admin dashboard", url: "https://www.figma.com/design/AbC123xyz/PayFlow-Refund?node-id=12-345" },
        { id: "E2", kind: "figma", title: "Refund email template", url: "https://www.figma.com/design/AbC123xyz/PayFlow-Refund?node-id=88-1" },
        { id: "E3", kind: "link", title: "Competitor refund UX notes", url: "https://example.com/refund-benchmark" },
      ] },
    { id: "PRD-PAY-12-AM-1", itemId: "PAY-12-AM-1", wikiId: null, issue: null, comments: [], embeds: [], versions: [], draftSavedAt: "2026-11-03 16:40",
      review: { requestedBy: "u2", at: "2026-11-03", reviewers: [{ userId: "u4", decision: "pending" }, { userId: "u1", decision: "approved", at: "2026-11-04", note: "OK from engineering" }] },
      draftHtml: `<h2>Problem</h2><p>Customers paying by <b>virtual account</b> need refunds back to the VA (REQ-4).</p><h2>Acceptance criteria</h2><table><tr><th>ID</th><th>Criterion</th></tr><tr><td>AC1–AC5</td><td>Same as PAY-12 v1</td></tr><tr><td>AC6</td><td>Refund of a VA payment goes back to the VA</td></tr></table>` },
    { id: "PRD-PAY-20", itemId: "PAY-20", review: null, wikiId: null, issue: { repo: "deltahq/payflow-api", number: 398, syncedVersion: 1 }, draftHtml: null, draftSavedAt: null, comments: [], embeds: [],
      versions: [
        { v: 1, by: "u2", at: "2026-10-06", note: "Initial", forced: false, reviews: [{ userId: "u4", decision: "approved", at: "2026-10-06" }], html: `<h2>Goal</h2><p>Invoice PDF generated in under 5 seconds.</p><h2>Acceptance criteria</h2><ul><li>AC1 p95 PDF generation &lt; 5s for invoices up to 500 lines</li></ul>` },
        { v: 2, by: "u2", at: "2026-11-02", note: "Rewind (rev 2): large invoices", forced: false, reviews: [{ userId: "u4", decision: "approved", at: "2026-11-02" }, { userId: "u2", decision: "approved", at: "2026-11-02" }], html: `<h2>Goal</h2><p>Invoice PDF generated in under 5 seconds.</p><h2>Acceptance criteria</h2><ul><li>AC1 p95 PDF generation &lt; 5s for invoices up to 500 lines</li><li><mark>AC2 Invoices above 500 lines also &lt; 5s</mark></li></ul>` },
      ] },
    { id: "PRD-PAY-23", itemId: "PAY-23", review: null, wikiId: null, issue: null, versions: [], comments: [], draftSavedAt: "2026-10-24 10:12",
      draftHtml: `<h2>Problem</h2><p>Customers churn in low season instead of pausing (REQ-5).</p><h2>Proposal</h2><p><mark>TBD</mark>: pause up to 3 months, billing resumes automatically.</p>`, embeds: [] },
  ],

  // ---------------- FEEDBACK WIDGET ----------------
  // Floating "Feedback" button: on/off + open period set in Backoffice; #/feedback always works (shareable link).
  feedbackConfig: { enabled: true, from: "2026-11-01", to: "2026-11-30", prompt: "What is missing or would be better at this step?" },
  feedback: [
    { id: "FB-1", by: "u4", at: "2026-11-02", route: "/p/p-payflow/requests/new", area: "Requests · New request", category: "better", text: "Would love to save a draft and finish later." },
    { id: "FB-2", by: "u9", at: "2026-11-03", route: "/p/p-payflow/item/PAY-12", area: "Item · QA", category: "missing", text: "Need a quick way to attach a screen recording to a QA finding." },
  ],

  // ---------------- PLANNING: QUARTERS & SPRINTS (ADR-021) ----------------
  // Sprints are 2 weeks; quarter is derived from the sprint start date. An item can live in several sprints (carry over).
  // Per project: each team has its own sprint calendar.
  sprints: [
    { id: "PAY-S20", projectId: "p-payflow", name: "Sprint 20", start: "2026-09-29", end: "2026-10-12", state: "closed" },
    { id: "PAY-S21", projectId: "p-payflow", name: "Sprint 21", start: "2026-10-13", end: "2026-10-26", state: "closed" },
    { id: "PAY-S22", projectId: "p-payflow", name: "Sprint 22", start: "2026-10-27", end: "2026-11-09", state: "active" },
    { id: "PAY-S23", projectId: "p-payflow", name: "Sprint 23", start: "2026-11-10", end: "2026-11-23", state: "planned" },
    { id: "PAY-S24", projectId: "p-payflow", name: "Sprint 24", start: "2026-11-24", end: "2026-12-07", state: "planned" },
    { id: "PAY-S25", projectId: "p-payflow", name: "Sprint 25", start: "2026-12-08", end: "2026-12-21", state: "planned" },
    { id: "PAY-S26", projectId: "p-payflow", name: "Sprint 26", start: "2027-01-05", end: "2027-01-18", state: "planned" },
    { id: "SHP-S8", projectId: "p-shiptrack", name: "Sprint 8", start: "2026-10-19", end: "2026-11-01", state: "closed" },
    { id: "SHP-S9", projectId: "p-shiptrack", name: "Sprint 9", start: "2026-11-02", end: "2026-11-15", state: "active" },
    { id: "SHP-S10", projectId: "p-shiptrack", name: "Sprint 10", start: "2026-11-16", end: "2026-11-29", state: "planned" },
    { id: "HRD-S2610A", projectId: "p-hrdesk", name: "Oct-A", start: "2026-10-05", end: "2026-10-23", state: "closed" },
    { id: "HRD-S2611A", projectId: "p-hrdesk", name: "Nov-A", start: "2026-10-26", end: "2026-11-13", state: "active" },
    { id: "HRD-S2612A", projectId: "p-hrdesk", name: "Dec-A", start: "2026-11-16", end: "2026-12-04", state: "planned" },
  ],
  // One row per item per sprint. outcome: planned | active | done | carried_over (+ reason). The last row is the item's current sprint.
  itemSprints: [
    { itemId: "PAY-12", sprintId: "PAY-S20", outcome: "carried_over", reason: "QA started late — refund email template missing" },
    { itemId: "PAY-12", sprintId: "PAY-S21", outcome: "carried_over", reason: "T-111 blocked: provider sandbox down" },
    { itemId: "PAY-12", sprintId: "PAY-S22", outcome: "active" },
    { itemId: "PAY-15", sprintId: "PAY-S21", outcome: "done" }, { itemId: "PAY-18", sprintId: "PAY-S22", outcome: "done" },
    { itemId: "PAY-20", sprintId: "PAY-S21", outcome: "carried_over", reason: "Rewound to Requirement (rev 2): large invoices" },
    { itemId: "PAY-20", sprintId: "PAY-S22", outcome: "active" },
    { itemId: "PAY-12-AM-1", sprintId: "PAY-S22", outcome: "active" }, { itemId: "PAY-21", sprintId: "PAY-S22", outcome: "active" },
    { itemId: "PAY-22", sprintId: "PAY-S22", outcome: "active" }, { itemId: "PAY-23", sprintId: "PAY-S23", outcome: "planned" },
    { itemId: "SHP-5", sprintId: "SHP-S9", outcome: "active" }, { itemId: "SHP-6", sprintId: "SHP-S9", outcome: "active" },
    { itemId: "HRD-3", sprintId: "HRD-S2610A", outcome: "carried_over", reason: "Review backlog (Lead Dev on leave)" }, { itemId: "HRD-3", sprintId: "HRD-S2611A", outcome: "active" },
  ],

  // ---------------- SOLUTION (ADR-022) ----------------
  // A structured decision card per item — no chat. Discussion happens in meetings / Slack; its notes go to the archive.
  // Approval: Lead Dev; + Eng Lead when data/API changes.
  solutions: [
    { itemId: "PAY-12", status: "approved", by: "u5", updated: "2026-09-20",
      approach: "Refund service reuses the shared ledger writer; every refund request carries an idempotency key.",
      touched: "payflow-api: refunds, ledger · payflow-web: invoice page · email templates",
      dataApi: "Table refunds (invoice_id, amount, idempotency_key UNIQUE) · POST /invoices/:id/refunds",
      decisions: "Reuse ledger writer instead of a separate refund ledger.", rejected: "Separate refund ledger — two sources of truth for money.",
      risks: "Double refund on retries (see INC-7) · rounding in IDR (BR-4)", flag: "partial_refund", estimate: "M",
      acMap: { AC1: "Validation against remaining refundable amount", AC2: "refunds table, many per invoice", AC3: "Idempotency key UNIQUE", AC4: "Email template refund_done", AC5: "Invoice history query joins refunds" },
      reviewers: [{ userId: "u5", decision: "approved", at: "2026-09-20" }, { userId: "u1", decision: "approved", at: "2026-09-20" }] },
    { itemId: "PAY-21", status: "in_review", by: "u5", updated: "2026-11-07",
      approach: "Render PDFs in a background worker via a task queue; API returns 202 + poll/notify.",
      touched: "payflow-api: invoices, new worker service · infra: queue",
      dataApi: "Table pdf_jobs (status, invoice_id) · GET /invoices/:id/pdf returns 202 while rendering",
      decisions: "Use Cloud Tasks for the queue.", rejected: "Redis queue — no ops owner.",
      risks: "Clients expecting a synchronous PDF (mobile app v2.x)", flag: "", estimate: "M", acMap: {},
      reviewers: [{ userId: "u5", decision: "approved", at: "2026-11-07" }, { userId: "u1", decision: "pending" }] },
  ],

  // ---------------- DISCUSSION ARCHIVE (ADR-022) ----------------
  // PMT does not host chat. People archive meeting summaries (AI or manual), Slack threads (link + summary) and dev discussions.
  // Archive text is immutable (delete only, audit kept). Users or AI can ADD context notes: ignore an off-topic part, clarify, or tell the AI what to focus on.
  // The crosscheck (AI) decides which statements matter and highlights mismatches with the PRD / solution — no manual tagging.
  archives: [
    { id: "AR-1", projectId: "p-payflow", itemIds: ["PAY-12"], kind: "meeting_manual", title: "Refund design sync", date: "2026-09-18", by: "u5", participants: ["u5", "u6", "u2", "u8"], sourceUrl: "",
      content: "Refund design sync — 18 Sep, Google Meet\nAttendees: Budi, Andi, Rina, Sari\n\nWe agreed to reuse the shared ledger writer for refunds.\nEvery refund request must carry an idempotency key.\nA separate refund ledger was rejected (two sources of truth).\nRina: refunds are only allowed within 30 days of payment.\nStill open: who owns the refund email template?\nAction: Andi drafts the refunds table.",
      contexts: [{ id: "CX-1", by: "u2", at: "2026-09-19", kind: "clarify", text: "The 30-day limit came from Finance; it applies to card payments only." }] },
    { id: "AR-2", projectId: "p-payflow", itemIds: ["PAY-12"], kind: "slack", title: "#payflow-dev — rounding of partial refunds", date: "2026-09-19", by: "u6", participants: ["u6", "u5"], sourceUrl: "https://deltahq.slack.com/archives/C0PAYDEV/p1726734000",
      content: "Summary of the Slack thread (link above)\nWe decided to round refunds down to whole IDR (BR-4).\nShould the rounding difference be shown to the customer?", contexts: [] },
    { id: "AR-3", projectId: "p-payflow", itemIds: ["PAY-23"], kind: "meeting_ai", title: "Subscription pause kickoff", date: "2026-11-06", by: "u3", participants: ["u3", "u4", "u5"], sourceUrl: "",
      content: "AI summary — Google Meet, 6 Nov (reviewed by Yoga)\nAttendees: Yoga, Hendra, Budi\n\nCustomers can pause for a maximum of 2 months.\nWe agreed billing resumes automatically on the resume date.\nFinance must get an email when a customer pauses.\nHendra asked whether WhatsApp notifications could be sent for payment reminders.\nOpen: how do we prorate a pause that starts mid-period?",
      contexts: [{ id: "CX-2", by: "ai", at: "2026-11-06", kind: "ignore", terms: ["whatsapp"], text: "Off-topic for PAY-23: WhatsApp notifications belong to REQ-6 / REQ-7. Ignore when checking this item.", acceptedBy: "u3" }] },
    { id: "AR-4", projectId: "p-payflow", itemIds: ["PAY-21"], kind: "dev_discussion", title: "Queue choice for PDF worker", date: "2026-11-05", by: "u5", participants: ["u5", "u6", "u7"], sourceUrl: "",
      content: "Dev discussion (whiteboard), 5 Nov\nWe decided to use Cloud Tasks for the PDF queue.\nA Redis queue was rejected — no ops owner.\nMobile app v2.x must keep getting the PDF during rollout.",
      contexts: [{ id: "CX-3", by: "u5", at: "2026-11-05", kind: "focus", text: "When reading this, focus on queue choice and mobile compatibility; the whiteboard photo is not included." }] },
  ],

  // ---------------- PROJECTS ----------------
  projects: [
    { id: "p-payflow", key: "PAY", name: "PayFlow", type: "saas", desc: "Billing & payment platform", leadIds: ["u2"], usesFeatureFlags: true,
      codeFormat: { template: "{KEY}-{SEQ}", seqScope: "project", amendSuffix: "-AM-{SEQ}" }, codeCounters: {"_": 23}, itemFields: [], 
      knowledgeSharing: "shared", visibility: "private", relatedProjectIds: [], releaseConfig: { productionBranch: "main", failMode: "closed" },
      filePolicy: { allowUploads: true, allowedUploadTypes: ["png", "pdf"], allowExternalLinks: true, maxFileMB: 20, quotaGB: 10, retentionDays: 730, versioning: true },
      memberIds: ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"] },
    { id: "p-shiptrack", key: "SHP", name: "ShipTrack", type: "saas", desc: "Logistics & shipment tracking", leadIds: ["u2"], usesFeatureFlags: false,
      codeFormat: { template: "{KEY}-{TYPE}-{SEQ:3}", seqScope: "type", amendSuffix: "-AM-{SEQ}" }, codeCounters: {"FT": 5, "BUG": 6}, itemFields: [], 
      knowledgeSharing: "shared", visibility: "private", relatedProjectIds: [], releaseConfig: { productionBranch: "main", failMode: "open" },
      filePolicy: { allowUploads: true, allowedUploadTypes: ["png"], allowExternalLinks: false, maxFileMB: 10, quotaGB: 5, retentionDays: 365, versioning: false },
      memberIds: ["u1", "u2", "u4", "u5", "u6", "u8", "u9"] },
    { id: "p-hrdesk", key: "HRD", name: "HRDesk", type: "saas", desc: "HR & payroll self-service", leadIds: ["u3"], usesFeatureFlags: false,
      codeFormat: { template: "{KEY}{YY}-{FIELD:module}-{SEQ:4}", seqScope: "year", amendSuffix: ".R{SEQ:2}" }, codeCounters: {"26": 4}, itemFields: [{ key: "module", label: "Module", required: true, options: [{ value: "Payroll", code: "PAY" }, { value: "Leave", code: "LV" }, { value: "Attendance", code: "ATT" }] }], 
      knowledgeSharing: "shared", visibility: "private", relatedProjectIds: ["p-payflow"], releaseConfig: { productionBranch: "master", failMode: "closed" },
      filePolicy: { allowUploads: true, allowedUploadTypes: ["png", "pdf"], allowExternalLinks: true, maxFileMB: 20, quotaGB: 10, retentionDays: 730, versioning: true },
      memberIds: ["u1", "u3", "u4", "u5", "u7", "u8", "u10"] },
  ],

  repos: [
    { id: "r1", projectId: "p-payflow", fullName: "deltahq/payflow-api", wiki: true },
    { id: "r2", projectId: "p-payflow", fullName: "deltahq/payflow-web", wiki: false },
    { id: "r3", projectId: "p-payflow", fullName: "deltahq/payflow-e2e", wiki: false },
    { id: "r4", projectId: "p-shiptrack", fullName: "deltahq/shiptrack", wiki: true },
    { id: "r5", projectId: "p-hrdesk", fullName: "deltahq/hrdesk", wiki: true },
    { id: "r0", projectId: null, fullName: "deltahq/handbook", wiki: true },
  ],

  // ---------------- KNOWLEDGE (GitHub Wiki is the primary source) ----------------
  wikiPages: [
    { id: "W-1", projectId: "p-payflow", repoId: "r1", title: "PayFlow — Product overview", category: "product_context", updated: "2026-08-10", by: "u2",
      body: "PayFlow lets SaaS companies invoice customers, collect card/VA payments, and issue refunds.\nCore domains: Invoice, Payment, Ledger, Refund, Subscription.\nBiggest customers: enterprise plans with monthly invoicing.\nEvery money movement is written to the Ledger — the Ledger is the financial source of truth." },
    { id: "W-2", projectId: "p-payflow", repoId: "r1", title: "Business rules — Billing & refunds", category: "business_rule", updated: "2026-11-01", by: "u2",
      body: "BR-1 Σ refunds of an invoice ≤ paid amount.\nBR-2 One payment event produces at most one ledger entry (idempotency key).\nBR-3 A tenant can never read another tenant's invoices.\nBR-4 Refunds in IDR are rounded down to the nearest rupiah." },
    { id: "W-3", projectId: "p-payflow", repoId: "r1", title: "Glossary", category: "glossary", updated: "2026-05-02", by: "u5",
      body: "Invoice — a bill for a customer.\nLedger entry — immutable record of money movement.\nSettlement — payout from provider to us.\nIdempotency key — unique key ensuring a retried request has no double effect." },
    { id: "W-4", projectId: "p-payflow", repoId: "r1", title: "PRD — Partial refund", category: "prd", updated: "2026-09-15", by: "u2",
      body: "Problem: enterprise customers need partial refunds (≈12 support tickets / month).\nAC1 Refund amount ≤ remaining refundable amount.\nAC2 Multiple partial refunds allowed until fully refunded.\nAC3 A retried refund request never refunds twice.\nAC4 Customer receives a refund email.\nAC5 Refund is visible in invoice history." },
    { id: "W-5", projectId: "p-payflow", repoId: "r1", title: "Decision — Idempotency keys on all money-moving endpoints", category: "decision", updated: "2026-11-01", by: "u5",
      body: "Context: INC-7 (duplicate charges).\nDecision: every endpoint and webhook that moves money requires an idempotency key, enforced in ledger writer.\nConsequence: refund API (PAY-12) must pass the key through." },
    { id: "W-6", projectId: "p-payflow", repoId: "r1", title: "Runbook — Payment provider outage", category: "runbook", sensitive: true, updated: "2026-07-01", by: "u1",
      body: "Provider dashboard credentials are in the vault entry 'payflow/provider'.\nSwitch traffic to backup provider via feature flag pay.provider.backup." },
    { id: "W-7", projectId: "p-payflow", repoId: "r1", title: "Postmortem — INC-7 duplicate charges", category: "postmortem", updated: "2026-11-02", by: "u1",
      body: "Bug A (checkout crash, PAY-15) blocked the payment flow in E2E for 2 weeks; downstream tests were BLOCKED but the summary showed '1 failure'.\nFixing Bug A unmasked Bug B: webhook retry wrote a second ledger entry.\nPrevention: BLOCKED critical tests fail the QA gate; BR-2 added; decision W-5." },
    { id: "W-8", projectId: "p-payflow", repoId: "r1", title: "PRD — Subscription pause (draft)", category: "prd", updated: "2026-10-30", by: "u3",
      body: "Problem: customers churn instead of pausing during low season.\nAC1 Customer can pause a subscription for 1–3 months.\nAC2 No invoice is generated while paused.\nAC3 Resume restores the original billing date." },
    { id: "W-9", projectId: "p-payflow", repoId: "r1", title: "Architecture — payflow-api", category: "architecture", updated: "2025-12-01", by: "u5",
      body: "Go monolith. Modules: invoice, payment, ledger, refund, subscription.\nLedger writer is shared by payment webhooks and refunds." },
    { id: "W-20", projectId: "p-shiptrack", repoId: "r4", title: "ShipTrack — Product overview", category: "product_context", updated: "2026-09-01", by: "u2",
      body: "ShipTrack tracks shipments and couriers in real time for logistics customers." },
    { id: "W-21", projectId: "p-shiptrack", repoId: "r4", title: "Business rules — Courier SLA", category: "business_rule", updated: "2026-06-12", by: "u2",
      body: "SLA-1 Location latency ≤ 10s.\nSLA-2 ETA shown in the recipient's local timezone." },
    { id: "W-30", projectId: "p-hrdesk", repoId: "r5", title: "HRDesk — Product overview", category: "product_context", updated: "2026-04-20", by: "u3",
      body: "HRDesk provides HR & payroll self-service for SMEs." },
    { id: "W-31", projectId: "p-hrdesk", repoId: "r5", title: "Payroll tax rules 2027", category: "business_rule", sensitive: true, updated: "2026-10-15", by: "u3",
      body: "PPh21 brackets 2027 (confidential until regulation published)." },
    { id: "W-90", projectId: null, repoId: "r0", title: "Engineering standards", category: "standard", updated: "2026-06-01", by: "u1",
      body: "Every PR references an item key. Every critical business rule has an automated test. BLOCKED ≠ PASS." },
    { id: "W-91", projectId: null, repoId: "r0", title: "Release process", category: "standard", updated: "2026-11-02", by: "u1",
      body: "Releases are cut on Thursdays. Release sign-off by Engineering Lead. Hotfix may ship any day with advisory gates." },
  ],

  // ---------------- DEVELOPMENT ITEMS (the Thread) ----------------
  // log[stageId]: record left by that stage. A passed stage without a record = knowledge gap.
  // acceptance: requirement conformance. tests: evidence. prs: GitHub PRs.
  items: [
    {
      id: "PAY-12", projectId: "p-payflow", typeId: "feature", title: "Partial refund", stage: "qa", gateMode: "strict",
      requesterId: "u4", ownerId: "u2", created: "2026-09-02", releaseId: "rel-380", wikiIds: ["W-4", "W-2", "W-5"],
      releaseBranches: { base: "develop", target: "main" },
      // Shipped in v3.8.0 behind a flag; launched (flag ON) later in v3.8.1.
      flags: [{ provider: "growthbook", key: "partial-refund-ui", state: "off", rollout: 0, plannedLaunch: "2026-11-20", launchReleaseId: "rel-381" }],
      log: {
        request: { by: "u4", at: "2026-09-02", summary: "Enterprise customers ask for partial refunds instead of full refund + re-invoice (≈12 tickets/month)." },
        requirement: { by: "u2", at: "2026-09-15", summary: "PRD written with 5 acceptance criteria; Finance consulted on rounding (BR-4).", artifacts: [{ kind: "wiki", ref: "W-4" }],
          approvals: [{ by: "u4", at: "2026-09-14", decision: "approved" }, { by: "u2", at: "2026-09-15", decision: "approved" }] },
        solution: { by: "u5", at: "2026-09-20", summary: "Refund service reuses the shared ledger writer. Refund requests carry an idempotency key.", artifacts: [{ kind: "wiki", ref: "W-9" }],
          approvals: [{ by: "u5", at: "2026-09-20", decision: "approved" }], decisions: ["Reuse ledger writer instead of separate refund ledger (less duplication, shared risk with payments)"] },
        breakdown: { by: "u5", at: "2026-09-22", summary: "4 tasks synced to GitHub Issues.",
          artifacts: [{ kind: "issue", ref: "payflow-api#412", label: "Refund API" }, { kind: "issue", ref: "payflow-web#157", label: "Refund modal" }, { kind: "issue", ref: "payflow-api#413", label: "Ledger update" }, { kind: "issue", ref: "payflow-e2e#41", label: "E2E scenarios" }] },
        development: { by: "u6", at: "2026-10-28", summary: "2 PRs merged.", artifacts: [{ kind: "pr", ref: "payflow-api#415" }, { kind: "pr", ref: "payflow-web#160" }] },
        review: { by: "u5", at: "2026-10-30", summary: "PRs approved. AI conformance: 3/5 AC with full evidence.", approvals: [{ by: "u5", at: "2026-10-30", decision: "approved" }] },
        qa: { by: "u8", at: "2026-11-03", summary: "Test plan approved. 2 critical scenarios not yet validated.", approvals: [{ by: "u8", at: "2026-11-01", decision: "test plan approved" }] },
      },
      acceptance: [
        { id: "AC1", text: "Refund amount ≤ remaining refundable amount", status: "met", evidence: "T-108 PASS · payflow-api#415" },
        { id: "AC2", text: "Multiple partial refunds until fully refunded", status: "partial", evidence: "Implemented in #415 · T-109 NOT EXECUTED" },
        { id: "AC3", text: "Retried refund request never refunds twice", status: "unverified", evidence: "T-111 BLOCKED (sandbox down)" },
        { id: "AC4", text: "Customer receives refund email", status: "met", evidence: "T-130 PASS" },
        { id: "AC5", text: "Refund visible in invoice history", status: "met", evidence: "payflow-web#160 · T-131 PASS" },
      ],
      prs: [
        { repo: "payflow-api", number: 415, title: "POST /invoices/:id/refunds (partial)", authorId: "u6", state: "merged" },
        { repo: "payflow-web", number: 160, title: "Refund modal UI", authorId: "u7", state: "merged" },
      ],
      tests: [
        { id: "T-108", title: "Partial refund ≤ paid amount", critical: true, status: "pass" },
        { id: "T-109", title: "Second partial refund respects remaining", critical: true, status: "not_executed", reason: "Not selected in suite" },
        { id: "T-111", title: "Refund retry is idempotent", critical: true, status: "blocked", reason: "Prerequisite: provider sandbox unreachable" },
        { id: "T-130", title: "Refund email sent", critical: false, status: "pass" },
        { id: "T-131", title: "Refund in invoice history", critical: false, status: "pass" },
      ],
      relatedIncidentIds: ["INC-7"],
    },
    {
      id: "PAY-15", projectId: "p-payflow", typeId: "bugfix", title: "Checkout crashes on expired coupon", stage: "learning", gateMode: "advisory",
      requesterId: "u9", ownerId: "u6", created: "2026-10-14", releaseId: "rel-371", wikiIds: [],
      log: {
        request: { by: "u9", at: "2026-10-14", summary: "QA found checkout crash when coupon is expired." },
        requirement: { by: "u2", at: "2026-10-15", summary: "Bug report with repro steps. Expected: show 'coupon expired' and continue checkout." },
        development: { by: "u6", at: "2026-10-27", summary: "Fix merged.", artifacts: [{ kind: "pr", ref: "payflow-api#410" }] },
        review: { by: "u5", at: "2026-10-28", summary: "Approved." },
        qa: { by: "u9", at: "2026-10-28", summary: "Checkout tests PASS. ⚠ Downstream payment tests had been BLOCKED for 2 weeks — not flagged at the time.", gateOverride: true },
        release: { by: "u1", at: "2026-10-29", summary: "Shipped in v3.7.1.", artifacts: [{ kind: "release", ref: "rel-371" }] },
        production: { by: "u1", at: "2026-10-31", summary: "Fix unmasked a hidden bug in payment retry → INC-7.", artifacts: [{ kind: "incident", ref: "INC-7" }] },
      },
      acceptance: [{ id: "AC1", text: "Expired coupon shows message, checkout continues", status: "met", evidence: "T-102 PASS" }],
      prs: [{ repo: "payflow-api", number: 410, title: "Handle expired coupon in checkout", authorId: "u6", state: "merged" }],
      tests: [
        { id: "T-101", title: "Checkout with valid card", critical: true, status: "pass" },
        { id: "T-102", title: "Checkout with expired coupon", critical: false, status: "pass" },
        { id: "T-105", title: "Payment webhook marks invoice paid", critical: true, status: "blocked", reason: "Blocked since 2026-10-14 by Bug A" },
      ],
      relatedIncidentIds: ["INC-7"],
    },
    {
      id: "PAY-18", projectId: "p-payflow", typeId: "hotfix", title: "Duplicate charge on webhook retry", stage: "learning", gateMode: "advisory",
      requesterId: "u1", ownerId: "u6", created: "2026-10-31", releaseId: "rel-372", wikiIds: ["W-5", "W-7"],
      log: {
        request: { by: "u1", at: "2026-10-31", summary: "Opened from INC-7: customers double-charged after webhook retries.", artifacts: [{ kind: "incident", ref: "INC-7" }] },
        development: { by: "u6", at: "2026-10-31", summary: "Idempotency key enforced in ledger writer.", artifacts: [{ kind: "pr", ref: "payflow-api#420" }] },
        review: { by: "u5", at: "2026-10-31", summary: "Approved (expedited)." },
        qa: { by: "u8", at: "2026-10-31", summary: "T-111 PASS using mocked provider." },
        release: { by: "u1", at: "2026-10-31", summary: "Hotfix v3.7.2.", artifacts: [{ kind: "release", ref: "rel-372" }] },
        production: { by: "u1", at: "2026-11-02", summary: "No duplicate ledger entries since deploy." },
      },
      acceptance: [{ id: "AC1", text: "Replaying a webhook 3× creates exactly one ledger entry", status: "met", evidence: "T-111 PASS · payflow-api#420" }],
      prs: [{ repo: "payflow-api", number: 420, title: "Enforce idempotency key in ledger writer", authorId: "u6", state: "merged" }],
      tests: [{ id: "T-111", title: "Webhook retry does not double-charge", critical: true, status: "pass" }],
      relatedIncidentIds: ["INC-7"],
    },
    {
      // Mode B example: revision 2 (rewind) — same thread, same branch, one release.
      id: "PAY-20", projectId: "p-payflow", typeId: "enhancement", title: "Invoice PDF generated under 5 seconds", stage: "development", gateMode: "strict", rev: 2,
      requesterId: "u4", ownerId: "u7", created: "2026-10-05", releaseId: "rel-380", wikiIds: ["W-9"],
      releaseBranches: { base: "develop", target: "main" }, flags: [],
      log: {
        request: { rev: 1, by: "u4", at: "2026-10-05", summary: "Large invoices take ~20s to email." },
        requirement: { rev: 2, by: "u2", at: "2026-11-02", summary: "PRD amended (rev 2): invoices above 500 lines must also render fast — AC2 added.", approvals: [{ by: "u4", at: "2026-11-02", decision: "approved" }, { by: "u2", at: "2026-11-02", decision: "approved" }],
          history: [{ rev: 1, by: "u2", at: "2026-10-08", summary: "Target: PDF < 5s for invoices up to 500 lines.", approvals: [{ by: "u4", at: "2026-10-08", decision: "approved" }] }] },
        solution: { rev: 1, by: "u5", at: "2026-10-10", summary: "Stream rendering; cache templates. (Still valid for rev 2 — paging extends streaming.)", approvals: [{ by: "u5", at: "2026-10-10", decision: "approved" }] },
        breakdown: { rev: 2, by: "u5", at: "2026-11-02", summary: "Added T13 (paged rendering) for AC2.", history: [] }, // rev 1 had no breakdown record → gap stays visible in history
        development: { rev: 2, by: "u7", at: "2026-11-03", summary: "Patching the same branch feat/PAY-20-pdf-stream — no new branch needed.",
          history: [{ rev: 1, by: "u7", at: "2026-10-28", summary: "Streaming renderer done for ≤500 lines; PR #422 opened." }] },
      },
      acceptance: [
        { id: "AC1", rev: 1, text: "PDF for 500-line invoice < 5s", status: "unverified", evidence: "No test yet" },
        { id: "AC2", rev: 2, text: "PDF for 2,000-line invoice < 10s (paged)", status: "unverified", evidence: "T13 in progress" },
      ],
      prs: [{ repo: "payflow-api", number: 422, title: "Stream PDF rendering", authorId: "u7", state: "open", branch: "feat/PAY-20-pdf-stream",
        commits: [{ sha: "a1f3c2e", msg: "Stream PDF rendering", rev: 1 }, { sha: "b77d019", msg: "Cache invoice templates", rev: 1 }, { sha: "9c27e04", msg: "Paged rendering for >500 lines", rev: 2 }] }],
      tests: [],
      relatedIncidentIds: [],
    },
    {
      // Mode A example: version 2 runs in parallel; v1 (PAY-12) continues QA → release v3.8.0.
      id: "PAY-12-AM-1", versionOf: "PAY-12", version: 2, projectId: "p-payflow", typeId: "feature", title: "Partial refund", stage: "requirement", gateMode: "strict",
      requesterId: "u4", ownerId: "u2", created: "2026-11-03", releaseId: null, wikiIds: ["W-4", "W-2"],
      log: {
        request: { by: "u4", at: "2026-11-03", summary: "Amendment of v1: customers who paid by virtual account (VA) need refunds back to VA. v1 must still ship in v3.8.0." },
        requirement: { by: "u2", at: "2026-11-03", summary: "PRD v2 drafted: AC6 added, AC2 clarified, AC5 removed (moved to separate history page item).", artifacts: [{ kind: "wiki", ref: "W-4" }],
          approvals: [] },
      },
      acceptance: [
        { id: "AC1", text: "Refund amount ≤ remaining refundable amount", status: "met", evidence: "inherited from v1" },
        { id: "AC2", text: "Multiple partial refunds until fully refunded, max 10 per invoice", status: "unverified", evidence: "—" },
        { id: "AC3", text: "Retried refund request never refunds twice", status: "unverified", evidence: "—" },
        { id: "AC4", text: "Customer receives refund email", status: "met", evidence: "inherited from v1" },
        { id: "AC6", text: "Refund to virtual account (VA) for VA payments", status: "unverified", evidence: "—" },
      ],
      prs: [], tests: [], relatedIncidentIds: ["INC-7"],
    },
    {
      id: "PAY-21", projectId: "p-payflow", typeId: "techdebt", title: "Move PDF rendering to worker queue", stage: "solution", gateMode: "advisory",
      requesterId: "u5", ownerId: "u5", created: "2026-10-12", releaseId: null, wikiIds: ["W-9"],
      log: { request: { by: "u5", at: "2026-10-12", summary: "PDF rendering blocks API workers under load." } },
      acceptance: [], prs: [], tests: [], relatedIncidentIds: [],
    },
    {
      id: "PAY-22", projectId: "p-payflow", typeId: "research", title: "Evaluate a second payment provider", stage: "requirement", gateMode: "advisory",
      requesterId: "u1", ownerId: "u1", created: "2026-10-25", releaseId: null, wikiIds: ["W-6"],
      log: { request: { by: "u1", at: "2026-10-25", summary: "Reduce single-provider risk after sandbox outages." } },
      acceptance: [], prs: [], tests: [], relatedIncidentIds: [],
    },
    {
      id: "PAY-23", projectId: "p-payflow", typeId: "feature", title: "Subscription pause", stage: "requirement", gateMode: "strict",
      requesterId: "u4", ownerId: "u3", created: "2026-10-22", releaseId: null, wikiIds: ["W-8"],
      log: {
        request: { by: "u4", at: "2026-10-22", summary: "Customers churn during low season instead of pausing." },
        requirement: { by: "u3", at: "2026-10-30", summary: "PRD draft ready; waiting for Business approval.", artifacts: [{ kind: "wiki", ref: "W-8" }],
          approvals: [] },
      },
      acceptance: [
        { id: "AC1", text: "Pause for 1–3 months", status: "unverified", evidence: "—" },
        { id: "AC2", text: "No invoice while paused", status: "unverified", evidence: "—" },
        { id: "AC3", text: "Resume restores billing date", status: "unverified", evidence: "—" },
      ],
      prs: [], tests: [], relatedIncidentIds: [],
    },
    {
      id: "SHP-5", projectId: "p-shiptrack", typeId: "feature", title: "Live courier map", stage: "development", gateMode: "strict",
      requesterId: "u4", ownerId: "u6", created: "2026-09-10", releaseId: "rel-shp-112", wikiIds: ["W-20", "W-21"],
      log: {
        request: { by: "u4", at: "2026-09-10", summary: "Customers call support to ask where the courier is." },
        requirement: { by: "u2", at: "2026-09-18", summary: "Map with ≤10s latency (SLA-1).", approvals: [{ by: "u4", at: "2026-09-18", decision: "approved" }] },
        breakdown: { by: "u5", at: "2026-10-01", summary: "WebSocket stream + map clustering." },
        // solution record missing → knowledge gap
      },
      acceptance: [{ id: "AC1", text: "Location latency ≤ 10s", status: "partial", evidence: "shiptrack#88 open" }],
      prs: [{ repo: "shiptrack", number: 88, title: "WS stream for courier positions", authorId: "u6", state: "open" }],
      tests: [], relatedIncidentIds: [],
    },
    {
      id: "SHP-6", projectId: "p-shiptrack", typeId: "bugfix", title: "ETA wrong across timezones", stage: "qa", gateMode: "advisory",
      requesterId: "u9", ownerId: "u6", created: "2026-10-20", releaseId: "rel-shp-112", wikiIds: ["W-21"],
      log: {
        request: { by: "u9", at: "2026-10-20", summary: "Recipients in WITA see ETA 1h early." },
        requirement: { by: "u2", at: "2026-10-21", summary: "ETA must use recipient timezone (SLA-2)." },
        development: { by: "u6", at: "2026-10-29", summary: "Fix merged.", artifacts: [{ kind: "pr", ref: "shiptrack#90" }] },
        review: { by: "u5", at: "2026-10-30", summary: "Approved." },
      },
      acceptance: [{ id: "AC1", text: "ETA displayed in recipient timezone", status: "met", evidence: "T-S12 PASS" }],
      prs: [{ repo: "shiptrack", number: 90, title: "Use recipient tz for ETA", authorId: "u6", state: "merged" }],
      tests: [{ id: "T-S12", title: "ETA WITA/WIT recipients", critical: true, status: "pass" }, { id: "T-S13", title: "ETA across midnight", critical: false, status: "skipped", reason: "@skip flaky" }],
      relatedIncidentIds: [],
    },
    {
      id: "HRD-3", projectId: "p-hrdesk", typeId: "feature", title: "Apply 2027 PPh21 brackets", stage: "review", gateMode: "strict",
      requesterId: "u4", ownerId: "u3", created: "2026-10-01", releaseId: "rel-hrd-500", wikiIds: ["W-31"],
      log: {
        request: { by: "u4", at: "2026-10-01", summary: "New tax regulation effective Jan 2027." },
        requirement: { by: "u3", at: "2026-10-10", summary: "Brackets per W-31.", approvals: [{ by: "u4", at: "2026-10-09", decision: "approved" }, { by: "u3", at: "2026-10-10", decision: "approved" }] },
        solution: { by: "u5", at: "2026-10-12", summary: "Bracket table versioned by effective date.", approvals: [{ by: "u5", at: "2026-10-12", decision: "approved" }] },
        breakdown: { by: "u5", at: "2026-10-13", summary: "2 tasks." },
        development: { by: "u7", at: "2026-11-01", summary: "PR opened by intern, mentored by Andi.", artifacts: [{ kind: "pr", ref: "hrdesk#51" }] },
      },
      acceptance: [{ id: "AC1", text: "Payroll from Jan 2027 uses new brackets", status: "partial", evidence: "hrdesk#51 open" }],
      prs: [{ repo: "hrdesk", number: 51, title: "PPh21 2027 brackets", authorId: "u7", state: "open" }],
      tests: [], relatedIncidentIds: [],
    },
  ],

  releases: [
    { id: "rel-371", projectId: "p-payflow", version: "v3.7.1", state: "released", target: "2026-10-29", projected: "2026-10-29", itemIds: ["PAY-15"] },
    { id: "rel-372", projectId: "p-payflow", version: "v3.7.2 (hotfix)", state: "released", target: "2026-10-31", projected: "2026-10-31", itemIds: ["PAY-18"] },
    { id: "rel-380", projectId: "p-payflow", version: "v3.8.0", state: "planned", target: "2026-11-07", projected: "2026-11-12", confidence: "medium", itemIds: ["PAY-12", "PAY-20"],
      releasePR: { repo: "payflow-api", number: 440, from: "develop", to: "main" },
      reason: "PAY-12 has 2 critical scenarios without PASS evidence; PAY-20 still in development with no tests." },
    { id: "rel-381", projectId: "p-payflow", version: "v3.8.1", state: "planned", target: "2026-11-20", projected: "2026-11-20", confidence: "high", itemIds: [], launches: ["PAY-12"],
      reason: "Flag-only launch: partial refund UI opens to customers (code shipped in v3.8.0)." },
    { id: "rel-shp-112", projectId: "p-shiptrack", version: "v1.12.0", state: "planned", target: "2026-11-10", projected: "2026-11-10", confidence: "high", itemIds: ["SHP-5", "SHP-6"], reason: "On track." },
    { id: "rel-hrd-500", projectId: "p-hrdesk", version: "v5.0.0", state: "planned", target: "2026-12-15", projected: "2026-12-15", confidence: "high", itemIds: ["HRD-3"], reason: "On track; regulation deadline Jan 1." },
  ],

  // Illustrative incident modelled on brief v0.1 §2 (Bug A masks Bug B). Replace with the real one.
  incidents: [
    { id: "INC-7", projectId: "p-payflow", title: "Duplicate charges after checkout fix", severity: "SEV-1", status: "learning", at: "2026-10-31",
      impact: "~Rp 48jt double-charged across 112 customers (illustrative)", releaseId: "rel-371", revealedBy: "PAY-15", fixedBy: "PAY-18", postmortem: "W-7",
      backtrack: [
        { kind: "release", ref: "rel-371", note: "Incident started after v3.7.1" },
        { kind: "item", ref: "PAY-15", note: "Only item in v3.7.1 — checkout fix" },
        { kind: "stage", ref: "PAY-15/qa", note: "QA passed with downstream payment tests BLOCKED for 2 weeks" },
        { kind: "test", ref: "T-105 / T-111", note: "Payment & retry tests never executed while Bug A existed" },
        { kind: "wiki", ref: "W-2", note: "No business rule for idempotency existed at the time (BR-2 added after)" },
      ],
      facts: ["T-105 and T-111 were BLOCKED in every run from 2026-10-14 to 2026-10-29", "PAY-15 QA stage passed via gate override (advisory)", "PR #410 changed checkout only"],
      hypotheses: [{ text: "Bug B existed before PR #410 but was masked by Bug A", confidence: 0.8 }],
      confirmed: ["Root cause: ledger writer had no idempotency key (confirmed by Budi, 2026-11-01)"],
      prevention: [
        { text: "Hotfix PAY-18", ref: "PAY-18", done: true },
        { text: "Business rule BR-2 added to W-2", ref: "W-2", done: true },
        { text: "Decision W-5: idempotency on all money-moving endpoints", ref: "W-5", done: true },
        { text: "QA gate: BLOCKED critical tests fail the gate for all item types", ref: null, done: false },
      ],
    },
  ],

  // ---------------- AMENDMENTS (ADR-012) ----------------
  // mode: "version" (A, parallel thread) | "revision" (B, rewind same thread). prdDiff: unified-diff-like lines.
  amendments: [
    { id: "AM-1", itemId: "PAY-12", mode: "version", fromVersion: 1, toVersion: 2, by: "u2", at: "2026-11-03", decidedWith: "u5",
      reason: "VA refunds requested by enterprise customers. v1 (in QA) must still ship in v3.8.0, so the change runs as v2.",
      prdDiff: [
        { t: " ", line: "AC1 Refund amount ≤ remaining refundable amount." },
        { t: "-", line: "AC2 Multiple partial refunds allowed until fully refunded." },
        { t: "+", line: "AC2 Multiple partial refunds allowed until fully refunded, max 10 per invoice." },
        { t: " ", line: "AC3 A retried refund request never refunds twice." },
        { t: " ", line: "AC4 Customer receives a refund email." },
        { t: "-", line: "AC5 Refund is visible in invoice history." },
        { t: "+", line: "AC6 Refund to virtual account (VA) for VA payments." },
      ] },
    { id: "AM-2", itemId: "PAY-20", mode: "revision", rev: 2, by: "u2", at: "2026-11-02", decidedWith: "u5", rewindTo: "requirement",
      reason: "Enterprise invoices reach 2,000 lines; small change on the same code path — patch the same branch and ship together in v3.8.0.",
      prdDiff: [
        { t: " ", line: "Target: PDF < 5s for invoices up to 500 lines." },
        { t: "+", line: "AC2 Invoices up to 2,000 lines render in < 10s using paged rendering." },
      ] },
  ],

  // ---------------- TASKS & BOARD (children of an item; synced with GitHub Issues) ----------------
  // Board workflow is master data (Backoffice) and can differ per project later.
  taskStatuses: [
    { id: "todo", name: "To do" },
    { id: "in_progress", name: "In progress" },
    { id: "in_review", name: "In review" },
    { id: "fixing", name: "Fixing" },
    { id: "ready_to_qa", name: "Ready to QA" },
    { id: "testing", name: "Testing" },
    { id: "done", name: "Done" },
  ],

  // kind: "dev" (from breakdown) | "qa_finding" (bug reported by QA during the QA stage)
  tasks: [
    { id: "T1", projectId: "p-payflow", itemId: "PAY-12", kind: "dev", title: "Refund API", status: "done", assigneeId: "u6", issue: "payflow-api#412" },
    { id: "T2", projectId: "p-payflow", itemId: "PAY-12", kind: "dev", title: "Refund modal UI", status: "done", assigneeId: "u7", issue: "payflow-web#157" },
    { id: "T3", projectId: "p-payflow", itemId: "PAY-12", kind: "dev", title: "Ledger update for refunds", status: "done", assigneeId: "u6", issue: "payflow-api#413" },
    { id: "T4", projectId: "p-payflow", itemId: "PAY-12", kind: "dev", title: "E2E refund scenarios", status: "testing", assigneeId: "u9", issue: "payflow-e2e#41" },
    { id: "T5", projectId: "p-payflow", itemId: "PAY-12", kind: "qa_finding", title: "Refund modal allows amount with 3 decimals", status: "fixing", assigneeId: "u7", reporterId: "u10", issue: "payflow-web#165",
      pr: { ref: "payflow-web#166", title: "Round refund input to rupiah (BR-4)", closes: "payflow-web#165", state: "open" } },
    { id: "T6", projectId: "p-payflow", itemId: "PAY-12", kind: "qa_finding", title: "Refund email shows wrong currency symbol", status: "ready_to_qa", assigneeId: "u6", reporterId: "u9", issue: "payflow-api#418" },
    { id: "T7", projectId: "p-payflow", itemId: "PAY-20", kind: "dev", title: "Stream PDF rendering", status: "in_review", assigneeId: "u7", issue: "payflow-api#421",
      pr: { ref: "payflow-api#422", title: "Stream PDF rendering", closes: "payflow-api#421", state: "open" } },
    { id: "T8", projectId: "p-payflow", itemId: "PAY-20", kind: "dev", title: "Template cache", status: "todo", assigneeId: "u6", issue: null },
    { id: "T13", projectId: "p-payflow", itemId: "PAY-20", kind: "dev", rev: 2, title: "Paged rendering for >500 lines", status: "in_progress", assigneeId: "u7", issue: "payflow-api#431" },
    { id: "T9", projectId: "p-shiptrack", itemId: "SHP-5", kind: "dev", title: "WebSocket position stream", status: "in_review", assigneeId: "u6", issue: "shiptrack#77",
      pr: { ref: "shiptrack#88", title: "WS stream for courier positions", closes: "shiptrack#77", state: "open" } },
    { id: "T10", projectId: "p-shiptrack", itemId: "SHP-5", kind: "dev", title: "Map clustering", status: "todo", assigneeId: "u6", issue: "shiptrack#78" },
    { id: "T11", projectId: "p-shiptrack", itemId: "SHP-6", kind: "qa_finding", title: "ETA midnight rollover wrong", status: "fixing", assigneeId: "u6", reporterId: "u9", issue: "shiptrack#92",
      pr: { ref: "shiptrack#93", title: "Fix midnight rollover", closes: "shiptrack#92", state: "open" } },
    { id: "T12", projectId: "p-hrdesk", itemId: "HRD-3", kind: "dev", title: "Versioned bracket table", status: "in_review", assigneeId: "u7", issue: "hrdesk#33",
      pr: { ref: "hrdesk#51", title: "PPh21 2027 brackets", closes: "hrdesk#33", state: "open" } },
  ],

  // Automation: trigger (GitHub/Delta event) + condition → action. Toggle per project.
  automationRules: [
    { id: "AR-1", name: "QA finding fixed → Ready to QA", enabled: true, scope: "all",
      trigger: "pull_request.merged", condition: "PR closes an issue linked to a task of kind 'qa_finding' in status 'Fixing'",
      action: "Move task to 'Ready to QA' · notify reporter (QA)", match: { event: "pr_merged", kind: "qa_finding", from: "fixing" }, to: "ready_to_qa", notify: "reporter" },
    { id: "AR-2", name: "PR opened → In review", enabled: true, scope: "all",
      trigger: "pull_request.opened", condition: "PR closes an issue linked to a task in 'To do' or 'In progress'",
      action: "Move task to 'In review'", match: { event: "pr_opened", from: ["todo", "in_progress"] }, to: "in_review" },
    { id: "AR-3", name: "Dev PR merged → Done", enabled: true, scope: "all",
      trigger: "pull_request.merged", condition: "PR closes an issue linked to a task of kind 'dev' in 'In review'",
      action: "Move task to 'Done'", match: { event: "pr_merged", kind: "dev", from: "in_review" }, to: "done" },
    { id: "AR-4", name: "QA rejects → Fixing", enabled: true, scope: "all",
      trigger: "test.failed (QA marks retest as failed)", condition: "Task in 'Testing'",
      action: "Move task to 'Fixing' · reassign to last PR author", match: { event: "retest_failed", from: "testing" }, to: "fixing", notify: "assignee" },
    { id: "AR-5", name: "All tasks done → advance item to QA", enabled: false, scope: "all",
      trigger: "task.status_changed", condition: "Every dev task of an item in Development is 'Done' and the gate passes",
      action: "Advance item stage Development → Review (suggest only when gate is strict)", match: { event: "none" } },
  ],

  automationLog: [
    { at: "2026-11-02 14:10", ruleId: "AR-1", taskId: "T6", text: "payflow-api#419 merged (closes #418) → T6 moved Fixing → Ready to QA; notified Tono" },
    { at: "2026-11-01 09:30", ruleId: "AR-2", taskId: "T7", text: "payflow-api#422 opened (closes #421) → T7 moved In progress → In review" },
  ],

  // ---------------- RESOURCES (files & links) — see ADR-009 ----------------
  // Master data: providers, AI-readable file types, and which places count as "knowledge area".
  resourceProviders: [
    { id: "s3", name: "S3 (uploaded)", kind: "uploaded" },
    { id: "gcs", name: "GCS (uploaded)", kind: "uploaded" },
    { id: "google_drive", name: "Google Drive", kind: "external_file" },
    { id: "figma", name: "Figma", kind: "external_file" },
    { id: "loom", name: "Loom", kind: "external_file" },
    { id: "web", name: "Web link", kind: "web_link" },
  ],
  fileTypes: [
    { id: "pdf", name: "PDF", aiReadable: true }, { id: "md", name: "Markdown", aiReadable: true }, { id: "docx", name: "Word", aiReadable: true },
    { id: "sheet", name: "Spreadsheet", aiReadable: true }, { id: "html", name: "Web page", aiReadable: true }, { id: "txt", name: "Text", aiReadable: true },
    { id: "figma", name: "Figma design", aiReadable: false }, { id: "png", name: "Image", aiReadable: false }, { id: "mp4", name: "Video", aiReadable: false }, { id: "zip", name: "Archive", aiReadable: false },
  ],
  knowledgeAreas: [
    { targetType: "wiki_page" }, { targetType: "incident" },
    { targetType: "item_stage", stages: ["requirement", "solution", "learning"] },
  ],

  // access: "inherit" (default: project membership + registered related projects) | "anyone_in_app" | "restricted" (+ grants) — override like Google Drive. externalDenied: users the provider itself rejects (simulated).
  // knowledgeSource: true | false | null (null = not asked / decided by knowledge area). companionOf: AI-readable version of another resource.
  resources: [
    { id: "R1", projectId: "p-payflow", title: "Refund modal — design", kind: "external_file", provider: "figma", fileType: "figma", url: "https://figma.com/file/abc/refund-modal",
      previewUrl: "https://figma.com/embed?abc", ownerId: "u7", created: "2026-09-19", access: "inherit", grants: [], knowledgeSource: null, health: "ok" },
    { id: "R2", projectId: "p-payflow", title: "Refund modal — design spec (PDF export)", kind: "uploaded", provider: "s3", fileType: "pdf", url: "s3://delta-files/payflow/R2.pdf",
      storage: { bucket: "delta-files", key: "payflow/R2.pdf", region: "ap-southeast-3" }, size: 1820000, ownerId: "u7", created: "2026-09-19", access: "inherit", grants: [], companionOf: "R1", health: "ok" },
    { id: "R3", projectId: "p-payflow", title: "Finance refund policy 2026.pdf", kind: "uploaded", provider: "s3", fileType: "pdf", url: "s3://delta-files/payflow/R3.pdf",
      storage: { bucket: "delta-files", key: "payflow/R3.pdf", region: "ap-southeast-3" }, size: 420000, ownerId: "u2", created: "2026-09-10",
      access: "restricted", grants: [{ userId: "u4", level: "view" }, { roleId: "pm", level: "edit" }, { roleId: "eng_lead", level: "view" }], knowledgeSource: null, health: "ok" },
    { id: "R4", projectId: "p-payflow", title: "Refund support tickets Q3 (sheet)", kind: "external_file", provider: "google_drive", fileType: "sheet", url: "https://docs.google.com/spreadsheets/d/xyz",
      ownerId: "u4", created: "2026-09-02", access: "inherit", grants: [], knowledgeSource: true, health: "ok", externalDenied: ["u7", "u10"] },
    { id: "R5", projectId: "p-payflow", title: "INC-7 debugging session (recording)", kind: "external_file", provider: "loom", fileType: "mp4", url: "https://loom.com/share/inc7",
      ownerId: "u5", created: "2026-11-01", access: "inherit", grants: [], knowledgeSource: null, health: "ok" },
    { id: "R6", projectId: "p-payflow", title: "Provider docs — webhook retries", kind: "web_link", provider: "web", fileType: "html", url: "https://docs.example-pay.com/webhooks/retries",
      ownerId: "u6", created: "2026-10-31", access: "inherit", grants: [], knowledgeSource: null, health: "ok" },
    { id: "R7", projectId: "p-payflow", title: "github.com/deltahq/payflow-api/issues/405", kind: "web_link", provider: "web", fileType: "html", url: "https://github.com/deltahq/payflow-api/issues/405",
      ownerId: "u9", created: "2026-10-14", access: "anyone_in_app", grants: [], knowledgeSource: false, health: "ok", note: "Added manually — no validation for manual links" },
    { id: "R8", projectId: "p-shiptrack", title: "ETA bug screenshot.png", kind: "uploaded", provider: "gcs", fileType: "png", url: "gs://delta-shiptrack/R8.png",
      storage: { bucket: "delta-shiptrack", key: "R8.png", region: "asia-southeast2" }, size: 240000, ownerId: "u9", created: "2026-10-20", access: "inherit", grants: [], knowledgeSource: false, health: "ok" },
    { id: "R9", projectId: null, title: "Old architecture diagram (Confluence)", kind: "web_link", provider: "web", fileType: "html", url: "https://deltahq.atlassian.net/wiki/x/old-arch",
      ownerId: "u1", created: "2024-02-01", access: "anyone_in_app", grants: [], knowledgeSource: true, health: "broken" },
    { id: "R10", projectId: "p-hrdesk", title: "Payroll disbursement — PayFlow API contract.pdf", kind: "uploaded", provider: "s3", fileType: "pdf", url: "s3://delta-files/hrdesk/R10.pdf",
      storage: { bucket: "delta-files", key: "hrdesk/R10.pdf", region: "ap-southeast-3" }, size: 310000, ownerId: "u3", created: "2026-10-05", access: "inherit", grants: [], knowledgeSource: true, health: "ok",
      note: "HRDesk is private but registers PayFlow as a related project → PayFlow members can open it" },
  ],

  // target: item | item_stage ("PAY-12/solution") | task | incident | wiki_page | release | project
  resourceLinks: [
    { resourceId: "R1", targetType: "item_stage", targetId: "PAY-12/solution", relation: "design", by: "u7", at: "2026-09-19" },
    { resourceId: "R1", targetType: "task", targetId: "T2", relation: "design", by: "u7", at: "2026-09-19" },
    { resourceId: "R3", targetType: "item_stage", targetId: "PAY-12/requirement", relation: "spec", by: "u2", at: "2026-09-12" },
    { resourceId: "R3", targetType: "wiki_page", targetId: "W-2", relation: "source", by: "u2", at: "2026-09-12" },
    { resourceId: "R4", targetType: "request", targetId: "REQ-1", relation: "evidence", by: "u4", at: "2026-09-02" },
    { resourceId: "R5", targetType: "incident", targetId: "INC-7", relation: "evidence", by: "u5", at: "2026-11-01" },
    { resourceId: "R6", targetType: "item_stage", targetId: "PAY-18/development", relation: "source", by: "u6", at: "2026-10-31" },
    { resourceId: "R6", targetType: "wiki_page", targetId: "W-5", relation: "source", by: "u5", at: "2026-11-01" },
    { resourceId: "R7", targetType: "item", targetId: "PAY-15", relation: "attachment", by: "u9", at: "2026-10-14" },
    { resourceId: "R8", targetType: "request", targetId: "REQ-10", relation: "evidence", by: "u9", at: "2026-10-20" },
    { resourceId: "R8", targetType: "task", targetId: "T11", relation: "evidence", by: "u9", at: "2026-10-29" },
    { resourceId: "R9", targetType: "wiki_page", targetId: "W-9", relation: "source", by: "u1", at: "2024-02-01" },
  ],

  // Canned AI answers for the prototype (no LLM is called). Matched by keyword.
  aiAnswers: [
    { keys: ["refund", "partial"], answer: "Partial refund (PAY-12) is in QA. A refund can never exceed the paid amount (BR-1), refunds are rounded down in IDR (BR-4), and refund requests must carry an idempotency key (decision W-5, introduced after INC-7). Two critical scenarios are still unvalidated, so release v3.8.0 is projected for 12 Nov instead of 7 Nov.", sources: ["PAY-12", "W-2", "W-4", "W-5", "rel-380"] },
    { keys: ["idempoten", "duplicate", "double", "inc-7", "insiden", "incident"], answer: "INC-7: fixing a checkout bug (PAY-15) unmasked a payment-retry bug that wrote duplicate ledger entries. Root cause confirmed: no idempotency key in the ledger writer. Fixed by hotfix PAY-18; prevention captured in BR-2 and decision W-5.", sources: ["INC-7", "PAY-15", "PAY-18", "W-7", "W-5"] },
    { keys: ["kapan", "when", "release", "rilis"], answer: "PayFlow v3.8.0 was targeted for 7 Nov; projection is now 12 Nov (medium confidence) because PAY-12 is waiting on 2 critical tests and PAY-20 is still in development. ShipTrack v1.12.0 is on track for 10 Nov.", sources: ["rel-380", "PAY-12", "PAY-20", "rel-shp-112"] },
    { keys: ["edge", "case", "test", "skenario"], answer: "Suggested edge cases for refunds, from business rules and past incidents: (1) second partial refund equals remaining amount exactly; (2) refund retried after timeout (BR-2, INC-7); (3) refund of an IDR amount with decimals (BR-4); (4) refund while a payment webhook is being retried; (5) refund on another tenant's invoice (BR-3).", sources: ["W-2", "INC-7", "PAY-12"] },
    { keys: ["apa itu", "overview", "what is", "payflow", "konteks", "context"], answer: "PayFlow is our billing & payment SaaS: invoicing, card/VA payments, refunds, subscriptions. The Ledger is the financial source of truth — everything that moves money writes to it. Key rules live in 'Business rules — Billing & refunds'.", sources: ["W-1", "W-2", "W-3", "W-9"] },
    { keys: ["runbook", "outage", "provider"], answer: "Follow 'Runbook — Payment provider outage': switch to the backup provider via feature flag. A second provider is being evaluated in PAY-22.", sources: ["W-6", "PAY-22"] },
  ],
};
