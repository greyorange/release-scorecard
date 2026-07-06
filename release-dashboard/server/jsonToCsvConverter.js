// Shared JSON → CSV converter, used by both the CLI script and the upload
// endpoint. Keeping it ESM so both contexts can import it directly.
//
// Shape of one release (everything except project + version is optional):
//
//   {
//     project: "...", version: "...", customer: "...", owner: "...",
//     releaseType: "major|minor|hotfix|patch|weekly",
//     plannedReleaseDate: "YYYY-MM-DD",
//     releaseDate: "YYYY-MM-DD",
//     metrics:  { testPassRate, automationCoverage, mttrHours },
//     bugs:     { sqa, sit, production, criticalOpen },
//     sopCompliance: { preReleaseSopCompleted, releaseNotesReady, signoffObtained, rollbackPlanReady },
//     requirements: { planned: [...], delivered: [...], deferred: [...] },
//     jiraIds:  ["GM-1001", ...],
//     issues:   [{ jiraId, title, severity, rca, capa, owner, dueDate }],
//     learnings:[{ team, note, owner, dueDate }],
//   }

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildHeaders(maxIssues, maxLearnings) {
  const base = [
    "Project Name", "Customer Name", "Release Version", "Release Type", "Planned Release Date",
    "Owner", "Release Date",
    "Test Pass Rate %", "Automation Coverage %", "MTTR (hrs)",
    "SQA Bugs", "SIT Bugs", "Production Bugs", "Critical Bugs Open",
    "Pre-release SOP Completed", "Release Notes Ready", "Signoff Obtained", "Rollback Plan Ready",
    "Planned Features", "Delivered Features", "Deferred Features",
    "Bug Class - Total", "Bug Class - New Requirements", "Bug Class - Duplicates",
    "Bug Class - Leaks from Testing", "Bug Class - TBD",
    "JIRA IDs", "CAPA Action IDs",
  ];
  for (let n = 1; n <= maxIssues; n++) {
    base.push(
      `Issue ${n} JIRA ID`, `Issue ${n} Title`, `Issue ${n} Severity`,
      `Issue ${n} RCA`, `Issue ${n} CAPA`, `Issue ${n} Owner`, `Issue ${n} Due Date`,
    );
  }
  for (let n = 1; n <= maxLearnings; n++) {
    base.push(
      `Learning ${n} Team`, `Learning ${n} Note`,
      `Learning ${n} Owner`, `Learning ${n} Due Date`,
    );
  }
  return base;
}

function releaseToRow(rel, maxIssues, maxLearnings) {
  const m = rel.metrics || {};
  const b = rel.bugs || {};
  const sop = rel.sopCompliance || {};
  const req = rel.requirements || {};
  const bc = rel.bugClassification || {};
  const row = [
    rel.project, rel.customer, rel.version, rel.releaseType, rel.plannedReleaseDate,
    rel.owner, rel.releaseDate,
    m.testPassRate, m.automationCoverage, m.mttrHours,
    b.sqa, b.sit, b.production, b.criticalOpen,
    sop.preReleaseSopCompleted, sop.releaseNotesReady, sop.signoffObtained, sop.rollbackPlanReady,
    Array.isArray(req.planned) ? req.planned.join(", ") : "",
    Array.isArray(req.delivered) ? req.delivered.join(", ") : "",
    Array.isArray(req.deferred) ? req.deferred.join(", ") : "",
    bc.total, bc.newRequirements, bc.duplicates, bc.leaksFromTesting, bc.tbd,
    Array.isArray(rel.jiraIds) ? rel.jiraIds.join(", ") : "",
    Array.isArray(rel.storyIds) ? rel.storyIds.join(", ") : "",
  ];
  const issues = rel.issues || [];
  for (let n = 0; n < maxIssues; n++) {
    const i = issues[n] || {};
    row.push(i.jiraId, i.title, i.severity, i.rca, i.capa, i.owner, i.dueDate);
  }
  const learnings = rel.learnings || [];
  for (let n = 0; n < maxLearnings; n++) {
    const l = learnings[n] || {};
    row.push(l.team, l.note, l.owner, l.dueDate);
  }
  return row;
}

function validate(rel, idx) {
  const where = `release[${idx}]`;
  if (!rel || typeof rel !== "object") throw new Error(`${where} must be an object`);
  if (!rel.project) throw new Error(`${where}.project is required`);
  if (!rel.version) throw new Error(`${where}.version is required`);
}

// Accepts either a single release object or an array; returns CSV text.
export function jsonToCsv(input) {
  const releases = Array.isArray(input) ? input : [input];
  if (!releases.length) throw new Error("JSON contained no releases");
  releases.forEach(validate);
  const maxIssues = Math.max(0, ...releases.map((r) => (r.issues || []).length));
  const maxLearnings = Math.max(0, ...releases.map((r) => (r.learnings || []).length));
  const headers = buildHeaders(maxIssues, maxLearnings);
  const rows = [headers.join(",")];
  for (const r of releases) {
    rows.push(releaseToRow(r, maxIssues, maxLearnings).map(csvEscape).join(","));
  }
  return rows.join("\n") + "\n";
}
