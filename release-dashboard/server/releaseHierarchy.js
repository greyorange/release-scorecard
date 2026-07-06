// Phase 2: Release Hierarchy Management
// Organizes releases into parent-child relationships (major releases contain weekly/hotfix sub-releases)

export function buildReleaseHierarchy(releases = []) {
  // Build parent-child relationships
  const byId = new Map(releases.map((r) => [r.id, r]));
  const byParent = new Map();

  for (const release of releases) {
    if (release.parentReleaseId) {
      if (!byParent.has(release.parentReleaseId)) {
        byParent.set(release.parentReleaseId, []);
      }
      byParent.get(release.parentReleaseId).push(release);
    }
  }

  // Build hierarchy tree
  const roots = releases.filter((r) => !r.parentReleaseId);
  const tree = roots.map((root) => buildNode(root, byParent, byId));

  return {
    tree,
    byId,
    byParent,
    roots: roots.map((r) => r.id),
  };
}

function buildNode(release, byParent, byId) {
  const children = byParent.get(release.id) || [];

  return {
    id: release.id,
    projectName: release.projectName,
    releaseVersion: release.releaseVersion,
    releaseType: release.releaseType,
    releaseDate: release.releaseDate,
    score: release.scorecard?.score,
    recommendation: release.scorecard?.recommendation,
    childCount: children.length,
    children: children
      .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""))
      .map((child) => buildNode(child, byParent, byId)),
  };
}

// Get full parent chain for a release
export function getReleaseLineage(releaseId, byId) {
  const chain = [];
  let current = byId.get(releaseId);

  while (current) {
    chain.unshift(current);
    if (current.parentReleaseId) {
      current = byId.get(current.parentReleaseId);
    } else {
      break;
    }
  }

  return chain;
}

// Flatten hierarchy for display
export function flattenHierarchy(tree) {
  const flat = [];
  const walk = (nodes, depth = 0) => {
    for (const node of nodes) {
      flat.push({ ...node, depth, childCount: node.children.length });
      if (node.children?.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(tree);
  return flat;
}

// Group releases by cycle (e.g., Q2-2026)
export function groupByCycle(releases = []) {
  const cycles = new Map();

  for (const release of releases) {
    const cycle = release.releaseCycle || "uncategorized";
    if (!cycles.has(cycle)) {
      cycles.set(cycle, []);
    }
    cycles.get(cycle).push(release);
  }

  return Object.fromEntries(cycles);
}

// Get all releases in a specific cycle
export function getReleasesCycle(cycleName, releases = []) {
  return releases.filter((r) => r.releaseCycle === cycleName);
}

// Get descendants of a release
export function getDescendants(releaseId, byParent) {
  const descendants = [];

  function walk(parentId) {
    const children = byParent.get(parentId) || [];
    for (const child of children) {
      descendants.push(child);
      walk(child.id);
    }
  }

  walk(releaseId);
  return descendants;
}

// Calculate health of a release family (parent + all children)
export function calculateFamilyHealth(releaseId, releases = []) {
  const family = [releases.find((r) => r.id === releaseId), ...getDescendants(releaseId, buildReleaseHierarchy(releases).byParent)].filter(Boolean);

  if (family.length === 0) return null;

  const scores = family.map((r) => r.scorecard?.score).filter((s) => s != null);
  if (scores.length === 0) return null;

  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const recommendations = family.map((r) => r.scorecard?.recommendation).filter(Boolean);

  let overallRec = "unknown";
  if (recommendations.length > 0) {
    const noGoCount = recommendations.filter((r) => r === "nogo").length;
    const conditionalCount = recommendations.filter((r) => r === "conditional").length;

    if (noGoCount > 0) overallRec = "nogo";
    else if (conditionalCount > 0) overallRec = "conditional";
    else overallRec = "go";
  }

  return {
    averageScore: avg,
    memberCount: family.length,
    recommendation: overallRec,
    releases: family.map((r) => ({ id: r.id, version: r.releaseVersion, score: r.scorecard?.score })),
  };
}

// Determine observation window based on release type
export function getObservationWindow(releaseType = "minor") {
  const windows = {
    major: 30,
    weekly: 7,
    minor: 7,
    patch: 3,
    hotfix: 1,
    default: 7,
  };

  return windows[releaseType] || windows.default;
}
