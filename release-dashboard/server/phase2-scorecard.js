// Phase 2: Enhanced Scorecard with Multi-Aspect Scoring
// Provides separate scores for: Automation Readiness, Release Health, SOP Compliance, Feature Delivery

// Import the original Phase 1 quality scorecard for compatibility
import { scoreRelease as scorePhase1 } from "./scorecard.js";

// Phase 2: Calculate 4 independent aspect scores
export function calculateAspectScores(release) {
  // Aspect 1: Automation Readiness (0–100)
  const automationReadiness = release.automationCoverage ?? null;

  // Aspect 2: Release Health (based on bugs)
  let releaseHealth = null;
  if (release.criticalBugsOpen != null || release.escapedDefects != null) {
    const critical = release.criticalBugsOpen ?? 0;
    const escaped = release.escapedDefects ?? 0;
    const healthScore = Math.max(0, 100 - critical * 5 - escaped * 3);
    releaseHealth = Math.round(healthScore);
  }

  // Aspect 3: SOP Compliance (based on checklist)
  let sopCompliance = null;
  if (release.sopCompliance) {
    const sop = release.sopCompliance;
    const fields = [sop.preReleaseSopCompleted, sop.releaseNotesReady, sop.signoffObtained, sop.rollbackPlanReady];
    const completed = fields.filter(Boolean).length;
    sopCompliance = Math.round((completed / fields.length) * 100);
  }

  // Aspect 4: Feature Delivery (based on requirements)
  let featureDelivery = null;
  if (release.requirements && release.requirements.planned?.length > 0) {
    const planned = release.requirements.planned.length;
    const delivered = release.requirements.delivered?.length ?? 0;
    featureDelivery = Math.round((delivered / planned) * 100);
  }

  return {
    automationReadiness,
    releaseHealth,
    sopCompliance,
    featureDelivery,
  };
}

// Phase 2: Score snapshots — store score evolution over time
export function createScoreSnapshot(release, daysSinceRelease = 0) {
  const phase1Score = scorePhase1(release);
  const aspects = calculateAspectScores(release);

  return {
    timestamp: new Date().toISOString(),
    daysSinceRelease,
    score: phase1Score.score,
    recommendation: phase1Score.recommendation,
    breakdown: phase1Score.breakdown,
    qualityDimensions: phase1Score.qualityDimensions,
    aspectScores: aspects,
  };
}

// Phase 2: Generate score snapshots at specified intervals
export function generateScoreSnapshots(release, observationWindowDays = 7) {
  if (!release.releaseDate) return [];

  const releaseDate = new Date(release.releaseDate);
  const snapshots = [];
  const intervals = [1, 3, 7, 14]; // days post-release

  for (const days of intervals) {
    if (days <= observationWindowDays) {
      // In Phase 2, this would be recalculated for each historical point in time
      // For now, create snapshot with current data
      snapshots.push(createScoreSnapshot(release, days));
    }
  }

  return snapshots;
}

// Phase 2: Score finalization — lock score after observation period
export function finalizeScore(release, observationWindowDays = 7) {
  if (!release.releaseDate) return null;

  const releaseDate = new Date(release.releaseDate);
  const observationEnd = new Date(releaseDate.getTime() + observationWindowDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Score is finalized if observation window has closed
  const isFinalized = now >= observationEnd;

  return {
    isScoringFinalized: isFinalized,
    frozenAt: isFinalized ? observationEnd.toISOString() : null,
    observationEndDate: observationEnd.toISOString(),
    daysRemaining: Math.max(0, Math.ceil((observationEnd - now) / (1000 * 60 * 60 * 24))),
  };
}

// Phase 2: Full enhanced scorecard with all Phase 2 features
export function scoreReleasePhase2(release) {
  const phase1 = scorePhase1(release);
  const aspects = calculateAspectScores(release);
  const finalization = finalizeScore(release);
  const snapshots = generateScoreSnapshots(release);

  return {
    // Phase 1 fields (backward compatible)
    score: phase1.score,
    breakdown: phase1.breakdown,
    recommendation: phase1.recommendation,
    qualityDimensions: phase1.qualityDimensions,
    rationale: phase1.rationale,

    // Phase 2 additions
    aspectScores: aspects,
    snapshots: snapshots.length > 0 ? snapshots : [],
    finalization,

    // Scorecard metadata
    calculatedAt: new Date().toISOString(),
    version: "phase2",
  };
}

export function scoreAllPhase2(releases) {
  return releases.map((r) => ({ ...r, scorecard: scoreReleasePhase2(r) }));
}
