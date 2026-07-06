// Release Quality Scorecard Calculator (Phase 1)
//
// New 3-Factor Quality Model:
//   1. SOP & Timeline Adherence (25%)     — process maturity, signoffs, timeline adherence
//   2. Product Quality (40%)              — test coverage, bugs, leakage metrics
//   3. Feature Delivery (20%)             — requirements met, feature gaps
//   4. Automation Readiness (15%)         — test automation coverage
//
// This replaces the old 5-factor model with a focus on quality of release process,
// not just test metrics. Missing inputs are gracefully skipped with weight renormalization.

const FACTOR_WEIGHTS = {
  sopAdherence: 25,
  productQuality: 40,
  featureDelivery: 20,
  automationReadiness: 15,
};

const INVERTED_CAPS = {
  criticalBugsOpen: 20,
  escapedDefects: 20,
};

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function directScore(value) {
  if (value == null || Number.isNaN(value)) return null;
  return clamp(value);
}

function invertedScore(value, cap) {
  if (value == null || Number.isNaN(value)) return null;
  if (value <= 0) return 100;
  if (value >= cap) return 0;
  return clamp(100 * (1 - value / cap));
}

// Factor 1: SOP & Timeline Adherence (25%)
function calculateSopAdherence(release) {
  if (!release.sopCompliance) return null;

  const sop = release.sopCompliance;
  const fields = [sop.preReleaseSopCompleted, sop.releaseNotesReady, sop.signoffObtained, sop.rollbackPlanReady];
  const completed = fields.filter(Boolean).length;
  const sopScore = (completed / fields.length) * 100;

  // Timeline adherence: plan vs actual
  let timelineScore = 100;
  if (sop.plannedReleaseDate && sop.actualReleaseDate) {
    const planned = new Date(sop.plannedReleaseDate);
    const actual = new Date(sop.actualReleaseDate);
    const daysDiff = Math.abs((actual - planned) / (1000 * 60 * 60 * 24));
    timelineScore = invertedScore(daysDiff, 14) || 100;
  }

  return Math.round((sopScore + timelineScore) / 2);
}

// Factor 2: Product Quality (40%) — test coverage + bug metrics + leakage
function calculateProductQuality(release) {
  // Test Coverage (25% of product quality)
  const testPassRate = directScore(release.testPassRate) || 50;
  const automationCov = directScore(release.automationCoverage) || 50;
  const testCoverageScore = (testPassRate + automationCov) / 2;

  // Bug Metrics (50% of product quality)
  const criticalScore = invertedScore(release.criticalBugsOpen, INVERTED_CAPS.criticalBugsOpen);
  const escapedScore = invertedScore(release.escapedDefects, INVERTED_CAPS.escapedDefects);

  // Leakage (25% of product quality) — bugs escaping from SQA to production
  let leakageScore = 100;
  if (release.stages && release.stages.sqa != null && release.stages.production != null) {
    const sqaBugs = release.stages.sqa || 0;
    const prodBugs = release.stages.production || 0;
    const leakageRate = sqaBugs > 0 ? (prodBugs / sqaBugs) * 100 : 0;
    leakageScore = invertedScore(leakageRate, 50) || 100;
  }

  const bugScore = (criticalScore || 50 + escapedScore || 50) / 2;
  return Math.round((testCoverageScore * 0.25 + bugScore * 0.5 + leakageScore * 0.25));
}

// Factor 3: Feature Delivery (20%) — requirements met vs planned
function calculateFeatureDelivery(release) {
  if (!release.requirements) return null;

  const req = release.requirements;
  const planned = req.planned?.length || 0;
  if (planned === 0) return null;

  const delivered = req.delivered?.length || 0;
  const deliveryRate = (delivered / planned) * 100;

  return clamp(Math.round(deliveryRate));
}

// Factor 4: Automation Readiness (15%) — automation coverage as standalone metric
function calculateAutomationReadiness(release) {
  return directScore(release.automationCoverage) || null;
}

export function scoreRelease(release) {
  const factors = {
    sopAdherence: calculateSopAdherence(release),
    productQuality: calculateProductQuality(release),
    featureDelivery: calculateFeatureDelivery(release),
    automationReadiness: calculateAutomationReadiness(release),
  };

  // Weighted combination with renormalization for missing factors
  let totalWeight = 0;
  let weighted = 0;
  const breakdown = {};

  for (const [factor, weight] of Object.entries(FACTOR_WEIGHTS)) {
    const value = factors[factor];
    breakdown[factor] = {
      weight,
      value,
      contribution: value == null ? null : Math.round((value * weight) / 100),
    };
    if (value != null) {
      weighted += value * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight === 0 ? null : Math.round(weighted / totalWeight);

  let recommendation = "unknown";
  if (score != null) {
    if (score >= 80) recommendation = "go";
    else if (score >= 60) recommendation = "conditional";
    else recommendation = "nogo";
  }

  return {
    score,
    breakdown,
    weightsApplied: totalWeight,
    recommendation,
    rationale:
      score == null
        ? "Not enough scoring inputs available."
        : `Quality score ${score}/100 (SOP: ${breakdown.sopAdherence.value || "—"}, Product: ${breakdown.productQuality.value || "—"}, Features: ${breakdown.featureDelivery.value || "—"})`,
    qualityDimensions: {
      sopAdherence: breakdown.sopAdherence.value,
      productQuality: breakdown.productQuality.value,
      featureDelivery: breakdown.featureDelivery.value,
      automationReadiness: breakdown.automationReadiness.value,
    },
  };
}

export function scoreAll(releases) {
  return releases.map((r) => ({ ...r, scorecard: scoreRelease(r) }));
}
