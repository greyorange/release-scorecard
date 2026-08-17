// Tiny JSON-file store. Good enough for v1; swap for SQLite later without
// changing the surface: getReleases / getRelease / putReleases / putCapa.

import fs from "node:fs";
import path from "node:path";

const STORE_PATH = process.env.STORE_PATH
  ? path.resolve(process.env.STORE_PATH)
  : path.resolve("data/store.json");

function readRaw() {
  if (!fs.existsSync(STORE_PATH)) {
    return { releases: [], capa: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
  } catch (err) {
    console.error(`[store] corrupt JSON at ${STORE_PATH}: ${err.message}`);
    return { releases: [], capa: {} };
  }
}

function writeRaw(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function getStorePath() {
  return STORE_PATH;
}

export function getReleases() {
  return readRaw().releases || [];
}

export function getRelease(id) {
  return getReleases().find((r) => r.id === id) || null;
}

// Group releases by projectName + return latest (by releaseDate) per project.
export function getProjectsLatest() {
  const releases = getReleases();
  const byProject = new Map();
  for (const r of releases) {
    const cur = byProject.get(r.projectName);
    if (!cur || (r.releaseDate || "") > (cur.releaseDate || "")) {
      byProject.set(r.projectName, r);
    }
  }
  return [...byProject.values()];
}

export function getProjectHistory(projectName) {
  return getReleases()
    .filter((r) => r.projectName === projectName)
    .sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
}

export function putReleases(records) {
  const data = readRaw();
  // Replace any existing record with the same id.
  const byId = new Map(data.releases.map((r) => [r.id, r]));
  for (const rec of records) byId.set(rec.id, rec);
  data.releases = [...byId.values()];
  writeRaw(data);
  return data.releases.length;
}

// Full-sync write used by the folder-scan ingest. Records whose source CSV
// has been removed disappear here — the upsert-only `putReleases` left
// them orphaned. CAPA entries (stored separately) survive.
export function replaceAllReleases(records) {
  const data = readRaw();
  data.releases = records;
  writeRaw(data);
  return data.releases.length;
}

export function putCapa(releaseId, capaEntry) {
  const data = readRaw();
  data.capa[releaseId] ||= [];
  // Merge by id if provided, else push.
  if (capaEntry.id) {
    const idx = data.capa[releaseId].findIndex((c) => c.id === capaEntry.id);
    if (idx >= 0) data.capa[releaseId][idx] = capaEntry;
    else data.capa[releaseId].push(capaEntry);
  } else {
    capaEntry.id = `capa_${Date.now()}`;
    data.capa[releaseId].push(capaEntry);
  }
  writeRaw(data);
  return capaEntry;
}

export function getCapa(releaseId) {
  return readRaw().capa[releaseId] || [];
}

// Score lock + snapshot history, stored separately from the CSV-derived
// release records (same reason `capa` is separate): `replaceAllReleases`
// wipes and rebuilds `data.releases` on every re-ingest, so anything that
// needs to persist across that — a frozen score, a snapshot captured at a
// real point in time — can't live on the release record itself.

export function getScoreLock(releaseId) {
  return readRaw().scoreLocks?.[releaseId] || null;
}

export function putScoreLock(releaseId, lock) {
  const data = readRaw();
  data.scoreLocks ||= {};
  data.scoreLocks[releaseId] = lock;
  writeRaw(data);
  return lock;
}

export function getScoreSnapshots(releaseId) {
  return readRaw().scoreSnapshots?.[releaseId] || [];
}

export function appendScoreSnapshot(releaseId, snapshot) {
  const data = readRaw();
  data.scoreSnapshots ||= {};
  data.scoreSnapshots[releaseId] ||= [];
  data.scoreSnapshots[releaseId].push(snapshot);
  writeRaw(data);
  return data.scoreSnapshots[releaseId];
}
