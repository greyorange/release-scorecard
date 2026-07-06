import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getReleases } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = path.join(__dirname, "backups");
const HISTORY_LOG = path.join(__dirname, "rollback-history.json");

// Ensure directories exist
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// ===== FEATURE FLAGS =====
export const FEATURES = {
  // Phase 1
  USE_SOP_COMPLIANCE: process.env.FEATURE_SOP_COMPLIANCE === "true",
  USE_LEAKAGE_METRICS: process.env.FEATURE_LEAKAGE === "true",
  USE_RELEASE_TYPE: process.env.FEATURE_RELEASE_TYPE === "true",
  USE_TIME_WINDOW_SCORING: process.env.FEATURE_TIME_WINDOW === "true",

  // Phase 2
  USE_BUG_ATTRIBUTION: process.env.FEATURE_BUG_ATTR === "true",
  USE_RELEASE_HIERARCHY: process.env.FEATURE_HIERARCHY === "true",
  USE_SCORE_SNAPSHOTS: process.env.FEATURE_SNAPSHOTS === "true",
  USE_FOUR_ASPECT_SCORING: process.env.FEATURE_ASPECTS === "true",
};

export const FEATURE_LIST = [
  // Phase 1
  {
    name: "USE_SOP_COMPLIANCE",
    phase: 1,
    description: "Track SOP compliance: pre-release checks, approvals, signoffs",
    enabled: FEATURES.USE_SOP_COMPLIANCE,
  },
  {
    name: "USE_LEAKAGE_METRICS",
    phase: 1,
    description: "Calculate stage-to-stage bug leakage rates",
    enabled: FEATURES.USE_LEAKAGE_METRICS,
  },
  {
    name: "USE_RELEASE_TYPE",
    phase: 1,
    description: "Categorise releases: major, minor, hotfix, patch, weekly",
    enabled: FEATURES.USE_RELEASE_TYPE,
  },
  {
    name: "USE_TIME_WINDOW_SCORING",
    phase: 1,
    description: "Calculate scores in fixed time window (1 week post-release)",
    enabled: FEATURES.USE_TIME_WINDOW_SCORING,
  },
  // Phase 2
  {
    name: "USE_BUG_ATTRIBUTION",
    phase: 2,
    description: "Attribute bugs to injection release, not discovery release",
    enabled: FEATURES.USE_BUG_ATTRIBUTION,
  },
  {
    name: "USE_RELEASE_HIERARCHY",
    phase: 2,
    description: "Organise releases hierarchically (major contains weekly, etc.)",
    enabled: FEATURES.USE_RELEASE_HIERARCHY,
  },
  {
    name: "USE_SCORE_SNAPSHOTS",
    phase: 2,
    description: "Calculate and store score snapshots at 24h, 72h, 7d, 14d",
    enabled: FEATURES.USE_SCORE_SNAPSHOTS,
  },
  {
    name: "USE_FOUR_ASPECT_SCORING",
    phase: 2,
    description: "Show separate scores for automation, health, compliance, features",
    enabled: FEATURES.USE_FOUR_ASPECT_SCORING,
  },
];

// ===== BACKUP MANAGEMENT =====
export function createBackup(reason = null, user = "system") {
  const timestamp = new Date().toISOString();
  const backupId = `backup-${timestamp.replace(/[:.]/g, "-")}`;
  const backupPath = path.join(BACKUPS_DIR, `${backupId}.json`);

  // Copy store.json
  const storeData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/store.json"), "utf8"));
  const backupData = {
    id: backupId,
    createdAt: timestamp,
    user,
    reason,
    releaseCount: storeData.releases?.length || 0,
    capaCount: storeData.capa?.length || 0,
    sizeBytes: JSON.stringify(storeData).length,
    data: storeData,
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  logHistory("backup_created", `Created backup: ${backupId}`, user, "success", reason);

  return backupData;
}

export function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const files = fs.readdirSync(BACKUPS_DIR);
  return files
    .map((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, file), "utf8"));
        return data;
      } catch (err) {
        console.error(`Failed to read backup ${file}:`, err);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function restoreBackup(backupId, user = "system") {
  const backupPath = path.join(BACKUPS_DIR, `${backupId}.json`);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  try {
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));

    // Create a pre-restore backup first
    createBackup(`Pre-restore backup before restoring ${backupId}`, user);

    // Restore the data
    const storePath = path.join(__dirname, "data/store.json");
    fs.writeFileSync(storePath, JSON.stringify(backup.data, null, 2));

    logHistory("backup_restored", `Restored from backup: ${backupId}`, user, "success");

    return {
      ok: true,
      message: `Restored from ${backupId}`,
      restoredReleases: backup.releaseCount,
    };
  } catch (err) {
    logHistory("backup_restored", `Failed to restore ${backupId}: ${err.message}`, user, "error");
    throw err;
  }
}

// ===== FEATURE FLAG MANAGEMENT =====
export function toggleFeatureFlag(featureName, enabled, user = "system") {
  const envVar = featureName;
  process.env[envVar] = enabled ? "true" : "false";

  // Also update FEATURES object
  FEATURES[featureName] = enabled;

  logHistory(
    "feature_flag",
    `${enabled ? "Enabled" : "Disabled"} feature: ${featureName}`,
    user,
    "success"
  );

  return {
    ok: true,
    feature: featureName,
    enabled,
    message: `Feature ${featureName} is now ${enabled ? "enabled" : "disabled"}`,
  };
}

export function getFeatureStatus() {
  return {
    phase1: FEATURE_LIST.filter((f) => f.phase === 1),
    phase2: FEATURE_LIST.filter((f) => f.phase === 2),
  };
}

// ===== SCORE VERSION MANAGEMENT =====
let currentVersion = process.env.SCORE_VERSION || "v2";
let versionChangedAt = new Date().toISOString();

export function setScoreVersion(version, user = "system") {
  if (!["v1", "v2", "v3"].includes(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  currentVersion = version;
  versionChangedAt = new Date().toISOString();
  process.env.SCORE_VERSION = version;

  logHistory(
    "version_change",
    `Changed scoring version to ${version}`,
    user,
    "success"
  );

  return {
    ok: true,
    version,
    changedAt: versionChangedAt,
  };
}

export function getVersionStatus() {
  return {
    currentVersion,
    versionChangedAt,
    availableVersions: [
      {
        version: "v1",
        description: "Legacy 5-factor model",
        releaseDate: "2024-01-01",
      },
      {
        version: "v2",
        description: "New 3-factor quality model (SOP, Product Quality, Features)",
        releaseDate: "2026-06-01",
      },
      {
        version: "v3",
        description: "Future: Extended 4-aspect model (Automation, Health, Compliance, Features)",
        releaseDate: "TBD",
      },
    ],
  };
}

// ===== METRICS & HEALTH CHECKS =====
export function getMetrics() {
  const releases = getReleases();

  // Calculate score health
  const scoredReleases = releases.filter((r) => r.scorecard?.score != null);
  const successRate = releases.length > 0 ? ((scoredReleases.length / releases.length) * 100).toFixed(1) : 0;

  // Phase usage
  const phase1Usage = releases.filter((r) => r.sopCompliance || r.leakageMetrics).length;
  const phase2Usage = releases.filter((r) => r.parentReleaseId || r.scoreSnapshots?.length).length;

  // Performance (mock)
  const p99LatencyMs = Math.random() * 200 + 100;

  return {
    scoreHealth: {
      successRate: parseFloat(successRate),
      details: `${scoredReleases.length}/${releases.length} releases with scores`,
    },
    usage: {
      totalReleases: releases.length,
      phase1Releases: phase1Usage,
      phase1Percentage: releases.length > 0 ? ((phase1Usage / releases.length) * 100).toFixed(0) : 0,
      phase2Releases: phase2Usage,
      phase2Percentage: releases.length > 0 ? ((phase2Usage / releases.length) * 100).toFixed(0) : 0,
    },
    performance: {
      p99LatencyMs: Math.round(p99LatencyMs),
    },
    healthChecks: [
      {
        name: "Data Integrity",
        status: releases.length > 0 ? "ok" : "warning",
        message: `${releases.length} releases in store`,
      },
      {
        name: "Backup System",
        status: fs.existsSync(BACKUPS_DIR) ? "ok" : "warning",
        message: `${listBackups().length} backups available`,
      },
      {
        name: "Scoring Engine",
        status: scoredReleases.length > releases.length * 0.8 ? "ok" : "warning",
        message: `${(successRate)}% releases scored`,
      },
      {
        name: "Phase 1 Features",
        status: Object.values(FEATURES).slice(0, 4).some((v) => v) ? "ok" : "warning",
        message: Object.values(FEATURES).slice(0, 4).filter((v) => v).length + "/4 enabled",
      },
    ],
  };
}

export function getVersionComparison() {
  // Mock data: show how v1 vs v2 scores differ
  const releases = getReleases().slice(0, 5);
  return releases.map((r) => ({
    id: r.id,
    name: `${r.projectName} ${r.releaseVersion}`,
    v1: r.scorecard?.scoreV1 || Math.floor(Math.random() * 100),
    v2: r.scorecard?.score || Math.floor(Math.random() * 100),
  }));
}

// ===== HISTORY LOG =====
function logHistory(type, action, user, status, reason = null) {
  let history = [];
  if (fs.existsSync(HISTORY_LOG)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_LOG, "utf8"));
    } catch (err) {
      console.error("Failed to read history log:", err);
    }
  }

  history.unshift({
    type,
    action,
    user,
    status,
    reason,
    timestamp: new Date().toISOString(),
  });

  // Keep last 100 entries
  history = history.slice(0, 100);

  try {
    fs.writeFileSync(HISTORY_LOG, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("Failed to write history log:", err);
  }
}

export function getHistory() {
  if (!fs.existsSync(HISTORY_LOG)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_LOG, "utf8"));
  } catch (err) {
    console.error("Failed to read history log:", err);
    return [];
  }
}

// ===== MAIN STATUS ENDPOINT =====
export function getStatus() {
  return {
    currentVersion,
    versionChangedAt,
    features: getFeatureStatus(),
    history: getHistory(),
  };
}
