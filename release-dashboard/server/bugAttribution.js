// Phase 2: Bug Attribution System
// Tracks which release injected a bug vs. which release discovered it
// Supports tracing bugs back to their root cause release across multiple versions

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATTRIBUTION_PATH = path.join(__dirname, "data/bug-attribution.json");

// Initialize attribution data structure
function readAttribution() {
  if (!fs.existsSync(ATTRIBUTION_PATH)) {
    return { bugs: [], injectionMap: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(ATTRIBUTION_PATH, "utf-8"));
  } catch (err) {
    console.error(`[bugAttribution] Failed to read: ${err.message}`);
    return { bugs: [], injectionMap: {} };
  }
}

function writeAttribution(data) {
  fs.mkdirSync(path.dirname(ATTRIBUTION_PATH), { recursive: true });
  fs.writeFileSync(ATTRIBUTION_PATH, JSON.stringify(data, null, 2));
}

// Attribute a bug to a specific injection release
// When user says "JIRA-1234 was found in v7.8 but originated in v7.7.2"
export function attributeBug(bugId, options = {}) {
  const {
    summary = null,
    injectedInReleaseId = null,
    injectedInReleaseVersion = null,
    injectionDate = null,
    discoveredInReleaseId = null,
    discoveredInReleaseVersion = null,
    discoveryDate = new Date().toISOString(),
    discoveryMethod = "manual_report", // automated_test | manual_test | customer_report
    severity = "medium", // critical | high | medium | low
    status = "open", // open | resolved | duplicate | wontfix
    resolvedDate = null,
    resolvedInReleaseId = null,
    owner = null,
    rootCauseAnalysis = null,
    preventiveMeasure = null,
    tags = [],
  } = options;

  const data = readAttribution();

  // Find or create bug record
  let bug = data.bugs.find((b) => b.bugId === bugId);
  if (!bug) {
    bug = {
      bugId,
      createdAt: new Date().toISOString(),
    };
    data.bugs.push(bug);
  }

  // Update bug fields
  Object.assign(bug, {
    summary,
    injectedInReleaseId,
    injectedInReleaseVersion,
    injectionDate,
    discoveredInReleaseId,
    discoveredInReleaseVersion,
    discoveryDate,
    discoveryMethod,
    severity,
    status,
    resolvedDate,
    resolvedInReleaseId,
    owner,
    rootCauseAnalysis,
    preventiveMeasure,
    tags,
    updatedAt: new Date().toISOString(),
  });

  // Update injection map for fast lookup
  if (injectedInReleaseId) {
    if (!data.injectionMap[injectedInReleaseId]) {
      data.injectionMap[injectedInReleaseId] = [];
    }
    if (!data.injectionMap[injectedInReleaseId].includes(bugId)) {
      data.injectionMap[injectedInReleaseId].push(bugId);
    }
  }

  writeAttribution(data);
  return bug;
}

// Get all bugs attributed to a release (by injection release, not discovery)
export function getBugsAttributedToRelease(releaseId) {
  const data = readAttribution();
  const bugIds = data.injectionMap[releaseId] || [];
  return bugIds
    .map((id) => data.bugs.find((b) => b.bugId === id))
    .filter(Boolean)
    .sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));
}

// Get bugs found within N days of a release
export function getBugsWithinWindow(releaseId, releaseDate, windowDays = 7) {
  const data = readAttribution();
  const bugIds = data.injectionMap[releaseId] || [];
  const releaseTime = new Date(releaseDate).getTime();
  const windowEnd = releaseTime + windowDays * 24 * 60 * 60 * 1000;

  return bugIds
    .map((id) => data.bugs.find((b) => b.bugId === id))
    .filter((b) => {
      if (!b) return false;
      const discoveryTime = new Date(b.discoveryDate).getTime();
      return discoveryTime <= windowEnd;
    })
    .sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));
}

// Infer injection release from bug discovery data
export function inferInjectionRelease(bugDescription, releaseHistory = []) {
  // Simple heuristic: look for "vX.X.X" pattern in bug description
  const versionMatch = bugDescription?.match(/v\d+\.\d+\.\d+/i);
  if (!versionMatch) return null;

  const mentionedVersion = versionMatch[0].toLowerCase();
  return releaseHistory.find((r) => r.releaseVersion?.toLowerCase() === mentionedVersion)?.id || null;
}

// Sync bug attribution from JIRA (Phase 2 integration with JIRA system)
export function syncBugAttributionFromJira(bugs = []) {
  // This would be called periodically or on-demand
  // Input: array of JIRA bugs with extended metadata
  // Output: updated attribution records

  let updated = 0;
  for (const bug of bugs) {
    // Extract injection release from JIRA fields (if available)
    const injectedRelease = bug.injectedInRelease || inferInjectionRelease(bug.description);

    if (injectedRelease || bug.id) {
      attributeBug(bug.id || bug.key, {
        summary: bug.summary || bug.description,
        injectedInReleaseId: injectedRelease,
        discoveredInReleaseId: bug.discoveredInRelease || null,
        discoveryDate: bug.created || new Date().toISOString(),
        discoveryMethod: "jira_sync",
        severity: mapJiraSeverity(bug.priority || bug.severity),
        status: bug.status?.toLowerCase() || "open",
        owner: bug.assignee || null,
      });
      updated++;
    }
  }

  return { updated, total: bugs.length };
}

function mapJiraSeverity(jiraSev) {
  const map = {
    blocker: "critical",
    critical: "critical",
    major: "high",
    high: "high",
    medium: "medium",
    minor: "low",
    low: "low",
    trivial: "low",
  };
  return map[String(jiraSev).toLowerCase()] || "medium";
}

// Get bug attribution stats for a release
export function getAttributionStats(releaseId, releaseDate) {
  const bugs = getBugsWithinWindow(releaseId, releaseDate, 7);

  return {
    totalAttributed: bugs.length,
    bySeverity: {
      critical: bugs.filter((b) => b.severity === "critical").length,
      high: bugs.filter((b) => b.severity === "high").length,
      medium: bugs.filter((b) => b.severity === "medium").length,
      low: bugs.filter((b) => b.severity === "low").length,
    },
    byStatus: {
      open: bugs.filter((b) => b.status === "open").length,
      resolved: bugs.filter((b) => b.status === "resolved").length,
      duplicate: bugs.filter((b) => b.status === "duplicate").length,
      wontfix: bugs.filter((b) => b.status === "wontfix").length,
    },
    byDiscoveryMethod: {
      automated: bugs.filter((b) => b.discoveryMethod === "automated_test").length,
      manual: bugs.filter((b) => b.discoveryMethod === "manual_test").length,
      customer: bugs.filter((b) => b.discoveryMethod === "customer_report").length,
    },
  };
}

// Get all bugs with their attribution status
export function getAllAttributedBugs() {
  const data = readAttribution();
  return data.bugs;
}

// Get single bug attribution details
export function getBugAttribution(bugId) {
  const data = readAttribution();
  return data.bugs.find((b) => b.bugId === bugId) || null;
}
