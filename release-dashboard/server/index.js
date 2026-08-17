// Express API + (in production) static serving of the built React app.

import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import express from "express";
import cors from "cors";

import {
  getReleases,
  getRelease,
  getProjectsLatest,
  getProjectHistory,
  putCapa,
  getCapa,
  putReleases,
  replaceAllReleases,
  getScoreLock,
  putScoreLock,
  getScoreSnapshots,
  appendScoreSnapshot,
} from "./store.js";
import { scoreRelease } from "./scorecard.js";
import { calculateAspectScores, createScoreSnapshot, finalizeScore } from "./phase2-scorecard.js";
import { fetchBugsFor, fetchIssuesByIds, syncRelease, startPolling } from "./jira.js";
import { renderReleasePdf } from "./pdf.js";
import { parseCsvDir } from "./csvParser.js";
import { jsonToCsv } from "./jsonToCsvConverter.js";
import {
  getStatus,
  getFeatureStatus,
  toggleFeatureFlag,
  listBackups,
  createBackup,
  restoreBackup,
  getVersionStatus,
  setScoreVersion,
  getMetrics,
  getVersionComparison,
  getHistory,
} from "./rollbackControl.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.DASHBOARD_PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------- helpers ----------------------------------------------------- //

const OBSERVATION_WINDOW_DAYS = 7;
const SNAPSHOT_INTERVAL_DAYS = [1, 3, 7, 14];

function rationaleFor(score, breakdown) {
  if (score == null) return "Not enough scoring inputs available.";
  return `Quality score ${score}/100 (SOP: ${breakdown?.sopAdherence?.value ?? "—"}, Product: ${breakdown?.productQuality?.value ?? "—"}, Features: ${breakdown?.featureDelivery?.value ?? "—"})`;
}

// Captures a real snapshot the first time each 1/3/7/14-day mark actually
// passes, and freezes ("locks") the score once the 7-day observation window
// closes. Both are persisted outside the CSV-derived release record — like
// `capa` — because `replaceAllReleases` rebuilds `data.releases` from disk
// on every re-ingest and would otherwise wipe them.
//
// Known limitation: a snapshot necessarily reflects whatever data is current
// *at the moment its mark passes* — there's no change-log of past field
// values to rewind to. For a release backfilled with a `releaseDate`
// already weeks old, every mark passes at once on first read and all
// snapshots end up identical (today's data, relabeled by day). Snapshots
// taken as real time elapses on an active release are accurate.
function reconcileScoreState(release) {
  if (!release.releaseDate) return { lock: null, snapshots: [], finalization: null };

  const releaseDate = new Date(release.releaseDate);
  if (Number.isNaN(releaseDate.getTime())) {
    return { lock: null, snapshots: [], finalization: null };
  }

  const daysSince = (Date.now() - releaseDate.getTime()) / 86_400_000;

  let snapshots = getScoreSnapshots(release.id);
  const captured = new Set(snapshots.map((s) => s.daysSinceRelease));
  for (const days of SNAPSHOT_INTERVAL_DAYS) {
    if (daysSince >= days && !captured.has(days)) {
      snapshots = appendScoreSnapshot(release.id, createScoreSnapshot(release, days));
    }
  }

  const finalization = finalizeScore(release, OBSERVATION_WINDOW_DAYS);
  let lock = getScoreLock(release.id);
  if (finalization?.isScoringFinalized && !lock) {
    lock = putScoreLock(release.id, {
      ...createScoreSnapshot(release, OBSERVATION_WINDOW_DAYS),
      frozenAt: finalization.frozenAt,
    });
  }

  return { lock, snapshots, finalization };
}

function withScore(release) {
  if (!release) return null;

  const live = scoreRelease(release);
  live.aspectScores = calculateAspectScores(release);

  const { lock, snapshots, finalization } = reconcileScoreState(release);

  // Once locked, the frozen values are what's shown by default — the number
  // that doesn't silently drift if a later JIRA sync changes bug counts.
  // `scorecard.live` is always included so the UI can offer "view live
  // score instead" without a second request.
  const scorecard = lock
    ? {
        score: lock.score,
        recommendation: lock.recommendation,
        breakdown: lock.breakdown,
        qualityDimensions: lock.qualityDimensions,
        aspectScores: lock.aspectScores,
        rationale: rationaleFor(lock.score, lock.breakdown),
      }
    : { ...live };

  scorecard.isLocked = Boolean(lock);
  scorecard.frozenAt = lock?.frozenAt ?? null;
  scorecard.finalization = finalization;
  scorecard.snapshots = snapshots;
  scorecard.live = {
    score: live.score,
    recommendation: live.recommendation,
    breakdown: live.breakdown,
    qualityDimensions: live.qualityDimensions,
    aspectScores: live.aspectScores,
    rationale: live.rationale,
  };

  return { ...release, scorecard };
}

// ---------- API --------------------------------------------------------- //

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, releases: getReleases().length });
});

// Frontend config — base URL for JIRA links, etc. Kept tiny on purpose:
// anything the SPA needs to render server-derived URLs goes here.
app.get("/api/config", (_req, res) => {
  res.json({
    jiraBaseUrl: (process.env.JIRA_BASE_URL || "").replace(/\/+$/, "") || null,
    jiraConfigured: Boolean(process.env.JIRA_API_TOKEN && process.env.JIRA_EMAIL),
  });
});

// Sample CSV download — the "fill this in" template that the upload UI
// links to. Served as a real .csv download so spreadsheet apps open it
// nicely on click.
app.get("/api/sample/release-csv", (_req, res) => {
  const sample = path.resolve(__dirname, "../data/sample_release_simple.csv");
  if (!fs.existsSync(sample)) {
    return res.status(404).json({ error: "sample CSV missing on server" });
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="release_template.csv"');
  fs.createReadStream(sample).pipe(res);
});

// Helper shared by POST /api/releases and PUT /api/releases/:id. Returns
// {error,status} on failure, or {id, savedAs, release} on success.
function writeReleaseFromJson(body, { replaceCsvName = null } = {}) {
  let csv;
  try {
    csv = jsonToCsv(body);
  } catch (err) {
    return { error: err.message, status: 400 };
  }

  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const newSlug = `${slug(body.project)}_${slug(body.version)}`;
  const safeName = `${newSlug}.csv` || "release.csv";
  const dataDir = path.resolve(__dirname, "../data");
  const dest = path.resolve(dataDir, safeName);

  // If the caller is editing and the identity changed, remove the old CSV
  // so the same release doesn't appear twice.
  if (replaceCsvName && replaceCsvName !== safeName) {
    const oldPath = path.resolve(dataDir, replaceCsvName);
    if (oldPath.startsWith(dataDir + path.sep) && fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch { /* best effort */ }
    }
  }

  try {
    fs.writeFileSync(dest, csv, "utf-8");
  } catch (err) {
    return { error: `write failed: ${err.message}`, status: 500 };
  }
  try {
    const records = parseCsvDir(dataDir);
    replaceAllReleases(records);
  } catch (err) {
    return { error: `ingest failed: ${err.message}`, status: 500 };
  }

  const release = getRelease(newSlug);
  return {
    id: newSlug,
    savedAs: safeName,
    release: withScore(release),
  };
}

// Create one release from JSON form input. Body is the simple release
// schema (see jsonToCsvConverter.js for fields). We convert to a single-
// row CSV, write it to data/<project>_<version>.csv, re-ingest, and
// return the new release id so the SPA can navigate straight to its
// scorecard.
app.post("/api/releases", (req, res) => {
  const result = writeReleaseFromJson(req.body || {});
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(201).json({ ok: true, ...result });
});

// Update an existing release. If body.project / body.version change such
// that the slug differs, the old CSV is removed so the release isn't
// duplicated under two ids.
app.put("/api/releases/:id", (req, res) => {
  const existing = getRelease(req.params.id);
  if (!existing) return res.status(404).json({ error: "Release not found" });
  const result = writeReleaseFromJson(req.body || {}, {
    replaceCsvName: `${req.params.id}.csv`,
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, ...result });
});

// Upload a CSV. The body is `{ filename, content }` — content is the raw
// CSV text. We write it into data/, the fs.watch listener re-ingests, and
// the response includes the post-ingest release count so the caller can
// confirm at a glance.
app.post("/api/upload", (req, res) => {
  const { filename, content } = req.body || {};
  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "filename is required" });
  }
  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "content (CSV text) is required" });
  }
  // Reject anything that tries to escape data/.
  const safe = path.basename(filename).replace(/[^A-Za-z0-9._-]/g, "_");
  if (!safe.toLowerCase().endsWith(".csv")) {
    return res.status(400).json({ error: "filename must end in .csv" });
  }
  const dest = path.resolve(__dirname, "../data", safe);
  try {
    fs.writeFileSync(dest, content, "utf-8");
  } catch (err) {
    return res.status(500).json({ error: `write failed: ${err.message}` });
  }
  // Don't rely on the watcher alone — also ingest synchronously so the
  // response can include the new count.
  let ingestedCount = null;
  try {
    const records = parseCsvDir(path.resolve(__dirname, "../data"));
    replaceAllReleases(records);
    ingestedCount = records.length;
  } catch (err) {
    console.warn(`[upload] re-ingest failed: ${err.message}`);
  }
  res.status(201).json({ ok: true, savedAs: safe, ingestedCount });
});

// List projects + latest release scorecard for each.
app.get("/api/projects", (_req, res) => {
  const latest = getProjectsLatest().map(withScore);
  res.json(latest);
});

// Flat list of every release across every CSV in data/.
// Sorted by releaseDate desc so the newest is first.
app.get("/api/releases", (_req, res) => {
  const all = getReleases()
    .map(withScore)
    .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
  res.json(all);
});

// Full scorecard for a single release id.
app.get("/api/projects/:id", (req, res) => {
  const release = getRelease(req.params.id);
  if (!release) return res.status(404).json({ error: "Release not found" });
  const capa = getCapa(release.id);
  res.json({ ...withScore(release), capa });
});

// Score-trend history across releases for a project (looked up by projectName
// of the given release id, so callers can pass either an id or a slug).
app.get("/api/projects/:id/history", (req, res) => {
  const release = getRelease(req.params.id);
  const projectName = release ? release.projectName : req.params.id;
  const history = getProjectHistory(projectName).map(withScore);
  res.json({ projectName, history });
});

// Submit / update a CAPA entry for a release.
app.post("/api/projects/:id/capa", (req, res) => {
  const release = getRelease(req.params.id);
  if (!release) return res.status(404).json({ error: "Release not found" });
  const body = req.body || {};
  if (!body.capa || !String(body.capa).trim()) {
    return res.status(400).json({ error: "Field 'capa' is required" });
  }
  const entry = putCapa(release.id, {
    id: body.id,
    issueId: body.issueId || null,
    rca: body.rca || null,
    capa: String(body.capa).trim(),
    owner: body.owner || null,
    dueDate: body.dueDate || null,
    team: body.team || null,
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json(entry);
});

// On-demand JIRA sync (writes back into the store).
app.post("/api/projects/:id/sync", async (req, res) => {
  const release = getRelease(req.params.id);
  if (!release) return res.status(404).json({ error: "Release not found" });
  const updated = await syncRelease(release, { forceRefresh: true });
  putReleases([updated]);
  res.json(withScore(updated));
});

// Direct JIRA fetch (for debugging / preview without writing).
app.get("/api/jira/:projectKey/:fixVersion", async (req, res) => {
  const result = await fetchBugsFor(req.params.projectKey, req.params.fixVersion);
  res.json(result);
});

// Resolve a list of JIRA IDs to {id, title, status, severity, owner, url}.
// Used by the release page to render the attached-JIRA table with live
// status from JIRA (rather than just rendering the IDs as static text).
app.post("/api/jira/issues", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: "body.ids must be an array of JIRA keys" });
  const result = await fetchIssuesByIds(ids);
  res.json(result);
});

// PDF export — renders /projects/:id?print=true via puppeteer.
app.get("/api/export/:id/pdf", async (req, res) => {
  const release = getRelease(req.params.id);
  if (!release) return res.status(404).json({ error: "Release not found" });
  try {
    const url = `http://localhost:${PORT}/projects/${release.id}?print=true`;
    const pdf = await renderReleasePdf(url);
    const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${release.id}-scorecard.pdf"`,
    );
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (err) {
    console.error(`[pdf] failed for ${release.id}: ${err.message}`);
    res.status(500).json({ error: `PDF export failed: ${err.message}` });
  }
});

// ---------- admin/rollback control -------------------------------------- //

// Get overall rollback status: current version, features, history
app.get("/api/admin/rollback/status", (_req, res) => {
  res.json(getStatus());
});

// Get all feature flags (Phase 1 + Phase 2)
app.get("/api/admin/rollback/features", (_req, res) => {
  res.json(getFeatureStatus());
});

// Toggle a feature flag on/off
app.post("/api/admin/rollback/feature-flags", (req, res) => {
  const { feature, enabled } = req.body || {};
  if (!feature || typeof enabled !== "boolean") {
    return res.status(400).json({ error: "feature and enabled (boolean) required" });
  }
  try {
    const result = toggleFeatureFlag(feature, enabled, req.user?.email || "unknown");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all backups
app.get("/api/admin/rollback/backups", (req, res) => {
  try {
    res.json(listBackups());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new backup
app.post("/api/admin/rollback/backup", (req, res) => {
  const { reason } = req.body || {};
  try {
    const backup = createBackup(reason, req.user?.email || "system");
    res.status(201).json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore from a backup
app.post("/api/admin/rollback/restore", (req, res) => {
  const { backupId } = req.body || {};
  if (!backupId) {
    return res.status(400).json({ error: "backupId required" });
  }
  try {
    const result = restoreBackup(backupId, req.user?.email || "system");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get version status (current version + available versions)
app.get("/api/admin/rollback/version", (_req, res) => {
  res.json(getVersionStatus());
});

// Change scoring version (v1, v2, v3)
app.post("/api/admin/rollback/version", (req, res) => {
  const { version } = req.body || {};
  if (!version) {
    return res.status(400).json({ error: "version required" });
  }
  try {
    const result = setScoreVersion(version, req.user?.email || "system");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get system metrics + health checks
app.get("/api/admin/rollback/metrics", (_req, res) => {
  res.json(getMetrics());
});

// Get version comparison (v1 vs v2 scores)
app.get("/api/admin/rollback/version-comparison", (_req, res) => {
  res.json(getVersionComparison());
});

// Get rollback history log
app.get("/api/admin/rollback/history", (_req, res) => {
  res.json(getHistory());
});

// ---------- static frontend (production) -------------------------------- //

const distDir = path.resolve(__dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback for /projects/:id deep links.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

// ---------- auto-ingest + file watch ------------------------------------ //
//
// On boot we re-parse every CSV in data/ so the store always reflects the
// folder. While running, fs.watch fires re-ingests whenever a *.csv file is
// added, edited or deleted. fs.watch on macOS can emit duplicate events for
// a single save, so we debounce to coalesce bursts into one ingest.

const DATA_DIR = path.resolve(__dirname, "../data");

function ingestNow(reason = "manual") {
  try {
    const records = parseCsvDir(DATA_DIR);
    // Use full-replace so a deleted CSV drops its records too.  CAPA
    // entries (stored under store.capa[]) are untouched.
    replaceAllReleases(records);
    console.log(`[ingest] ${records.length} record(s) loaded from ${DATA_DIR} (${reason})`);
  } catch (err) {
    console.error(`[ingest] failed (${reason}): ${err.message}`);
  }
}

ingestNow("startup");

let watchTimer = null;
function scheduleIngest(filename) {
  if (!filename || !filename.toLowerCase().endsWith(".csv")) return;
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => ingestNow(`watch:${filename}`), 400);
}

try {
  fs.watch(DATA_DIR, { persistent: true }, (_event, filename) => scheduleIngest(filename));
  console.log(`[watch] watching ${DATA_DIR} for CSV changes`);
} catch (err) {
  console.warn(`[watch] could not watch ${DATA_DIR}: ${err.message}`);
}

// ---------- start ------------------------------------------------------- //

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  if (!fs.existsSync(distDir)) {
    console.log(`[api] no dist/ yet — run \`npm run build\` to serve the SPA from this server`);
  }
});

// Wire JIRA polling. The sync routine walks every stored release.
startPolling(async () => {
  const releases = getReleases();
  for (const r of releases) {
    const updated = await syncRelease(r);
    if (updated !== r) putReleases([updated]);
  }
}, Number(process.env.JIRA_POLL_INTERVAL_MS));
