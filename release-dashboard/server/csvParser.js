// Schema-agnostic CSV → release-record mapper.
// Handles the two known scorecard shapes in this repo (DHL Figgs + the generic
// sprint scorecard), and falls back gracefully on unknown columns.

import Papa from "papaparse";
import fs from "node:fs";
import path from "node:path";

function num(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace("%", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pct(v) {
  const n = num(v);
  return n == null ? null : n;
}

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return null;
}

function parseStringList(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function makeId(projectName, releaseVersion, index) {
  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const base = `${slug(projectName)}_${slug(releaseVersion)}`;
  return base.replace(/^_|_$/g, "") || `release-${index}`;
}

// Convert one CSV row into the canonical release record schema described in
// the project plan. Missing fields are left as null / empty arrays.
export function rowToRelease(row, index = 0) {
  const projectName = pick(row, "Project Name") || "Untitled Project";
  const releaseVersion =
    pick(row, "Released Build Version", "Release Version") || `Release ${index + 1}`;

  // ---------- Stage bug totals (DHL schema + simple schema) ----------
  // Accept both "SQA Bugs Total" (rich DHL CSV) and "SQA Bugs" (simple CSV),
  // and fall back to summing the Product/Module/SA-SI breakdown.
  const sqaTotal =
    num(row["SQA Bugs Total"]) ??
    num(row["SQA Bugs"]) ??
    sum(num(row["SQA Bugs - Product"]), num(row["SQA Bugs - Module"]), num(row["SQA Bugs - SA/SI"]));
  const sitTotal =
    num(row["SIT/UAT/HAT Bugs Total"]) ??
    num(row["SIT Bugs"]) ??
    num(row["SIT/UAT/HAT Bugs"]) ??
    sum(
      num(row["SIT/UAT/HAT Bugs - Product"]),
      num(row["SIT/UAT/HAT Bugs - Module"]),
      num(row["SIT/UAT/HAT Bugs - SA/SI"]),
    );
  const prodTotal =
    num(row["Production Bugs Total"]) ??
    num(row["Production Bugs"]) ??
    sum(
      num(row["Production Bugs - Product"]),
      num(row["Production Bugs - Module"]),
      num(row["Production Bugs - SA/SI"]),
    );

  // Generic scorecard fallback fields. "Critical Bugs Open" is the simple
  // schema's name for the same thing.
  const internalBugs = num(row["Bugs Found (Internal QA)"]);
  const customerBugs = num(row["Bugs Raised by Customer"]);
  const criticalCustBugs =
    num(row["Critical Bugs Open"]) ?? num(row["Critical Bugs by Customer"]);
  const customerPending = num(row["Customer Bugs Pending"]);

  // Test/coverage rollups. Simple schema: a single "Test Pass Rate %" cell
  // (0–100). Rich schema: counts of passed/executed test cases.
  const tcExecuted = num(row["Test Cases Executed"]);
  const tcPassed = num(row["Test Cases Passed"]);
  const tcFailed = num(row["Test Cases Failed"]);
  const testPassRate =
    num(row["Test Pass Rate %"]) ??
    num(row["Test Pass Rate"]) ??
    (tcExecuted && tcPassed != null
      ? Math.round((tcPassed / tcExecuted) * 1000) / 10
      : null);

  const automationCoverage =
    pct(row["Automation Coverage %"]) ?? pct(row["Automation Coverage"]);

  // Compose the "issues" list. Two sources, with explicit CAPA slots taking
  // priority — when the row has rich CAPA N {Stage, Title, Severity, RCA,
  // Action, Owner, Due Date} columns we emit those. Otherwise fall back to
  // one synthetic card per stage built from the narrative CAPA cell.
  const baseId = makeId(projectName, releaseVersion, index);
  const issues = [];
  const explicitCapas = capaSlotsFromRow(row);
  if (explicitCapas.length > 0) {
    for (const c of explicitCapas) {
      issues.push({
        id: `${baseId}_capa_${c.n}`,
        title: c.title,
        severity: c.severity,
        rca: c.rca,
        capa: c.action,
        owner: c.owner || pick(row, "Owner") || null,
        dueDate: c.dueDate,
        team: teamForStage(c.stage),
        stage: c.stage,
        jiraId: c.jiraId,
        jiraUrl: c.jiraUrl,
        status: c.status,
        completedDate: c.completedDate,
      });
    }
  } else {
    const capaSources = [
      { stage: "SQA", capa: row["SQA Bugs Learning (CAPA)"], count: sqaTotal },
      { stage: "SIT/UAT/HAT", capa: row["SIT Bugs Learning (CAPA)"], count: sitTotal },
      { stage: "Production", capa: row["Production Bugs Learning (CAPA)"], count: prodTotal },
    ];
    let issueIdx = 0;
    for (const { stage, capa, count } of capaSources) {
      if (!capa || !String(capa).trim()) continue;
      issues.push({
        id: `${baseId}_issue_${issueIdx++}`,
        title: `${stage} CAPA — ${count ?? "?"} bugs`,
        severity: stage === "Production" ? "critical" : stage === "SIT/UAT/HAT" ? "high" : "medium",
        rca: null,
        capa: String(capa).trim(),
        owner: pick(row, "Owner") || null,
        dueDate: null,
        team: teamForStage(stage),
        stage,
      });
    }
  }

  // Team learnings — two sources, merged:
  //   1. Flexible "Learning N Team/Note/Owner/Due Date" slots (DHL schema).
  //   2. Legacy retro columns from the older sprint scorecard.
  const teamLearnings = [...learningSlotsFromRow(row)];
  for (const [team, col] of [
    ["QA", "What Didn't Go Well"],
    ["Engineering", "Action Items"],
  ]) {
    const v = row[col];
    if (v && String(v).trim()) {
      teamLearnings.push({
        team,
        learning: String(v).trim(),
        owner: row["Owner (Action Items)"] || row["Owner"] || null,
        dueDate: null,
      });
    }
  }

  // Phase 1: SOP Compliance tracking
  const sopCompliance = {
    plannedReleaseDate: row["Planned Release Date"] || null,
    actualReleaseDate: row["Release Date"] || row["Released Date"] || null,
    preReleaseSopCompleted: row["Pre-release SOP Completed"] === "true" || row["Pre-release SOP Completed"] === "TRUE" || row["Pre-release SOP Completed"] === "1",
    releaseNotesReady: row["Release Notes Ready"] === "true" || row["Release Notes Ready"] === "TRUE" || row["Release Notes Ready"] === "1",
    signoffObtained: row["Signoff Obtained"] === "true" || row["Signoff Obtained"] === "TRUE" || row["Signoff Obtained"] === "1",
    rollbackPlanReady: row["Rollback Plan Ready"] === "true" || row["Rollback Plan Ready"] === "TRUE" || row["Rollback Plan Ready"] === "1",
  };

  // Phase 1: Requirements/Feature delivery tracking
  const requirements = {
    planned: parseStringList(row["Planned Features"]),
    delivered: parseStringList(row["Delivered Features"]),
    deferred: parseStringList(row["Deferred Features"]),
  };

  // Phase 1: Release type categorization
  const releaseType = (row["Release Type"] || "minor").toLowerCase();

  return {
    id: makeId(projectName, releaseVersion, index),
    projectName,
    releaseVersion,
    releaseType: ["major", "minor", "hotfix", "patch", "weekly"].includes(releaseType) ? releaseType : "minor",
    currentBuildVersion: row["Current Build Version"] || null,
    customerName: row["Customer Name"] || null,
    owner: row["Owner"] || null,
    releaseDate: row["Released Date"] || row["Release Date"] || null,

    // Score-engine inputs (any nulls treated as missing).
    testPassRate,
    automationCoverage,
    criticalBugsOpen: criticalCustBugs ?? null,
    totalBugs: sum(sqaTotal, sitTotal, prodTotal, internalBugs, customerBugs) || null,
    escapedDefects: prodTotal ?? customerPending ?? null,
    mttr: num(row["MTTR (hrs)"]) ?? num(row["Mean Time to Resolve (hrs)"]),
    slaAdherence: null, // not present in current CSVs

    // Stage breakdowns (preserved for UI).
    stages: {
      sqa: stageBlock(row, "SQA"),
      sit: stageBlock(row, "SIT/UAT/HAT"),
      production: stageBlock(row, "Production"),
    },

    // Phase 1: SOP & timeline compliance
    sopCompliance,

    // Phase 1: Requirements tracking
    requirements,

    // Legacy fields exposed so the UI can render the older schema too.
    legacy: {
      storiesPlanned: num(row["Total Stories Planned"]),
      storiesDelivered: num(row["Total Stories Delivered"]),
      storiesCarriedOver: num(row["Stories Carried Over"]),
      deliveryPct: pct(row["Delivery %"]),
      bugsFoundInternal: internalBugs,
      bugsFixedBeforeRelease: num(row["Bugs Fixed Before Release"]),
      customerBugs,
      customerBugsCritical: criticalCustBugs,
      hotfixes: num(row["Hotfixes Post Release"]),
      rollbacks: num(row["Rollbacks"]),
      prodIncidents: num(row["Production Incidents"]),
      qualityScore: num(row["Quality Score (0-10)"]) ?? num(row["Release Quality Score (0-10)"]),
      deliveryScore: num(row["Delivery Score (0-10)"]),
      csatScore: num(row["Customer Satisfaction Score (0-10)"]),
      overallScore: num(row["Overall Release Score (0-10)"]),
    },

    // Bug classification matrix — input-driven counts by reason/source.
    // Independent of the SQA / SIT / Production stage breakdown above.
    bugClassification: bugClassificationFromRow(row),

    // JIRA links — three sources, merged + deduped:
    //   1. The top-level "JIRA IDs" column (simple schema).
    //   2. Per-issue "Issue N JIRA ID" / "CAPA N JIRA ID" columns.
    //   3. Any IDs mentioned in CAPA narrative text fields.
    jiraIds: collectJiraIds(row, issues),
    // Separate list — JIRA story keys for the release's stories table.
    storyIds: storyIdsFromRow(row),

    issues,
    teamLearnings,
    source: "csv",
  };
}

function collectJiraIds(row, issues) {
  const seen = new Map();
  const add = (id) => {
    if (!id) return;
    const trimmed = String(id).trim();
    if (!trimmed) return;
    if (!seen.has(trimmed)) seen.set(trimmed, { id: trimmed, url: jiraUrlFor(trimmed) });
  };
  for (const entry of jiraIdsFromRow(row)) add(entry.id);
  for (const i of issues) if (i.jiraId) add(i.jiraId);
  // Scan narrative cells for stray "GM-1234" style references so the user
  // doesn't need to also list them in the JIRA IDs column.
  const NARRATIVE_FIELDS = [
    "SQA Bugs Learning (CAPA)",
    "SIT Bugs Learning (CAPA)",
    "Production Bugs Learning (CAPA)",
    "Comments / Notes",
  ];
  for (const f of NARRATIVE_FIELDS) {
    for (const id of extractJiraIds(row[f])) add(id);
  }
  return [...seen.values()];
}

// JIRA URL builder. Returns null when JIRA_BASE_URL isn't set so the
// frontend can render plain text (and add the link lazily later if config
// arrives via /api/config).
const JIRA_ID_RE = /\b[A-Z][A-Z0-9_]+-\d+\b/g;
function jiraUrlFor(id) {
  const base = (process.env.JIRA_BASE_URL || "").replace(/\/+$/, "");
  if (!base || !id) return null;
  return `${base}/browse/${id}`;
}

function extractJiraIds(text) {
  if (!text) return [];
  const matches = String(text).match(JIRA_ID_RE);
  return matches ? [...new Set(matches)] : [];
}

// Pull every issue slot from a row.  Accepts either:
//   - Simple schema:   "Issue N Title / Severity / RCA / CAPA / Owner / Due Date / JIRA ID"
//   - DHL schema:      "CAPA N Stage / Title / Severity / RCA / Action / Owner / Due Date"
// Either prefix can have a "JIRA ID" column whose value becomes a clickable
// link in the UI. Stage / severity are *data* (free strings) so new stages
// or severities don't need code changes. A slot without a Title is skipped.
function capaSlotsFromRow(row) {
  const slotNums = new Set();
  // Detect slots by their "Title" column under either prefix.
  for (const col of Object.keys(row)) {
    const m = col.match(/^(?:CAPA|Issue)\s+(\d+)\s+Title$/i);
    if (m) slotNums.add(Number(m[1]));
  }
  // Also catch DHL rows that only define "CAPA N Stage" without a Title.
  for (const col of Object.keys(row)) {
    const m = col.match(/^CAPA\s+(\d+)\s+Stage$/i);
    if (m) slotNums.add(Number(m[1]));
  }

  const out = [];
  for (const n of [...slotNums].sort((a, b) => a - b)) {
    // Prefer "Issue N <field>" when present, fall back to "CAPA N <field>".
    const get = (field) =>
      pick(row, `Issue ${n} ${field}`, `CAPA ${n} ${field}`);
    const title = get("Title");
    if (!title || !String(title).trim()) continue;

    const jiraId = (get("JIRA ID") || "").toString().trim() || null;
    // Simple schema uses "CAPA" as the corrective-action column on each issue
    // (`Issue N CAPA`). Rich schema uses "Action". Try both.
    const action =
      (pick(row, `Issue ${n} CAPA`, `CAPA ${n} Action`) || "").toString().trim() ||
      null;
    out.push({
      n,
      stage: (get("Stage") || "").toString().trim() || null,
      title: String(title).trim(),
      severity:
        (get("Severity") || "medium").toString().trim().toLowerCase() || "medium",
      rca: (get("RCA") || "").toString().trim() || null,
      action,
      owner: (get("Owner") || "").toString().trim() || null,
      dueDate: (get("Due Date") || "").toString().trim() || null,
      jiraId,
      jiraUrl: jiraUrlFor(jiraId),
      status:
        ["open", "in-progress", "closed"].find(
          (s) => s === (get("Status") || "").toString().trim().toLowerCase(),
        ) || "open",
      completedDate: (get("Completed Date") || "").toString().trim() || null,
    });
  }
  return out;
}

// Top-level "JIRA IDs" column — comma-separated list shown as a row of
// clickable badges on the release card, independent of issue slots.
function jiraIdsFromRow(row) {
  return idListFromCell(pick(row, "JIRA IDs", "Jira IDs", "JIRA Issues"));
}

// Sibling list — JIRA keys for the release's "CAPA Actions" table.
// (Older CSVs may use "Story IDs" / "Stories"; both names still parse.)
function storyIdsFromRow(row) {
  return idListFromCell(
    pick(row, "CAPA Action IDs", "CAPA Actions", "Story IDs", "JIRA Story IDs", "Stories"),
  );
}

// Bug classification matrix. The 5 cells are independent counts; null means
// the cell wasn't supplied in the CSV/JSON. Each column has a couple of
// alternate spellings so the user can write "Bugs - Duplicates" or
// "Bug Class - Duplicates" and either works.
function bugClassificationFromRow(row) {
  return {
    total: num(row["Bug Class - Total"]) ?? num(row["Total Bugs (Classification)"]),
    newRequirements:
      num(row["Bug Class - New Requirements"]) ?? num(row["Bugs - New Requirements"]),
    duplicates: num(row["Bug Class - Duplicates"]) ?? num(row["Bugs - Duplicates"]),
    leaksFromTesting:
      num(row["Bug Class - Leaks from Testing"]) ?? num(row["Bugs - Leaks from Testing"]),
    tbd: num(row["Bug Class - TBD"]) ?? num(row["Bugs - TBD"]),
  };
}

function idListFromCell(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => ({ id, url: jiraUrlFor(id) }));
}

function teamForStage(stage) {
  const s = String(stage || "").toLowerCase();
  if (s.includes("prod")) return "Engineering";
  if (s.includes("sit") || s.includes("uat") || s.includes("hat")) return "QA";
  if (s.includes("sqa") || s.includes("qa")) return "QA";
  return "Engineering";
}

// Pull every "Learning N Team / Note / Owner / Due Date" group from a row.
// The team name is *data*, not schema — callers can add slots or rename teams
// just by editing the CSV. Slots with no team or no note are skipped.
function learningSlotsFromRow(row) {
  const slotNums = new Set();
  const pattern = /^Learning\s+(\d+)\s+Team$/i;
  for (const col of Object.keys(row)) {
    const m = col.match(pattern);
    if (m) slotNums.add(Number(m[1]));
  }
  const learnings = [];
  for (const n of [...slotNums].sort((a, b) => a - b)) {
    const team = row[`Learning ${n} Team`];
    const note = row[`Learning ${n} Note`];
    if (!team || !String(team).trim()) continue;
    if (!note || !String(note).trim()) continue;
    learnings.push({
      team: String(team).trim(),
      learning: String(note).trim(),
      owner: (row[`Learning ${n} Owner`] || "").toString().trim() || null,
      dueDate: (row[`Learning ${n} Due Date`] || "").toString().trim() || null,
    });
  }
  return learnings;
}

function stageBlock(row, stage) {
  const prefix =
    stage === "SQA" ? "SQA Bugs" : stage === "Production" ? "Production Bugs" : "SIT/UAT/HAT Bugs";
  const capaCol =
    stage === "SQA"
      ? "SQA Bugs Learning (CAPA)"
      : stage === "Production"
        ? "Production Bugs Learning (CAPA)"
        : "SIT Bugs Learning (CAPA)";
  const product = num(row[`${prefix} - Product`]);
  const module = num(row[`${prefix} - Module`]);
  const saSi = num(row[`${prefix} - SA/SI`]);
  // Total can come from three sources, in priority order:
  //   1. "<prefix> Total" (DHL rich schema)
  //   2. "SQA Bugs" / "Production Bugs" / "SIT Bugs" (simple schema)
  //   3. Sum of the per-category breakdown
  const total =
    num(row[`${prefix} Total`]) ??
    num(row[prefix]) ??
    (stage === "SIT/UAT/HAT" ? num(row["SIT Bugs"]) : null) ??
    sum(product, module, saSi);
  return { product, module, saSi, total, capa: row[capaCol] || null };
}

function sum(...vals) {
  let total = 0;
  let seen = false;
  for (const v of vals) {
    if (v == null || Number.isNaN(v)) continue;
    total += v;
    seen = true;
  }
  return seen ? total : null;
}

// Read a single CSV file → array of release records.
export function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    for (const e of parsed.errors) {
      console.warn(`[csvParser] ${path.basename(filePath)}: ${e.message}`);
    }
  }
  return parsed.data.map((row, i) => rowToRelease(row, i));
}

// Read every *.csv under a directory → flat array of release records.
export function parseCsvDir(dirPath) {
  const out = [];
  if (!fs.existsSync(dirPath)) return out;
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.toLowerCase().endsWith(".csv"));
  for (const f of files) {
    out.push(...parseCsvFile(path.join(dirPath, f)));
  }
  return out;
}
