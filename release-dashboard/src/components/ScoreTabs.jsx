// Phase 2: Multi-Aspect Score Tabs
// Shows 4 independent scores: Automation, Health, Compliance, Features
// Each aspect is independent and can be optimized separately

import { useState } from "react";

export default function ScoreTabs({ scorecard = {} }) {
  const [activeTab, setActiveTab] = useState("quality");

  const aspects = scorecard.aspectScores || {};
  const finalization = scorecard.finalization || {};

  const tabs = [
    {
      id: "quality",
      label: "Quality Score",
      icon: "📊",
      description: "Overall release quality (Phase 1 model)",
      score: scorecard.score,
      breakdown: scorecard.breakdown,
      recommendation: scorecard.recommendation,
    },
    {
      id: "automation",
      label: "Automation",
      icon: "🤖",
      description: "Test automation coverage",
      score: aspects.automationReadiness,
      metricName: "Automation Coverage %",
    },
    {
      id: "health",
      label: "Health",
      icon: "❤️",
      description: "Bug load and production impact",
      score: aspects.releaseHealth,
      metricName: "Critical Bugs + Escaped Defects",
    },
    {
      id: "compliance",
      label: "Compliance",
      icon: "✓",
      description: "SOP adherence and process maturity",
      score: aspects.sopCompliance,
      metricName: "SOP Checklist Completion",
    },
    {
      id: "features",
      label: "Features",
      icon: "🎯",
      description: "Feature delivery vs plan",
      score: aspects.featureDelivery,
      metricName: "Delivery Rate %",
    },
  ];

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className="card">
      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTabData && (
        <div className="space-y-4">
          {/* Description */}
          <p className="text-xs text-slate-500">{activeTabData.description}</p>

          {/* Score Display */}
          {activeTabData.score != null ? (
            <>
              <div className="flex items-baseline gap-3">
                <div className="text-4xl font-bold text-slate-900">{activeTabData.score}</div>
                <div className="text-sm text-slate-500">/100</div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                {activeTabData.id === "quality" && activeTabData.recommendation && (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      activeTabData.recommendation === "go"
                        ? "bg-green-100 text-green-700"
                        : activeTabData.recommendation === "conditional"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {activeTabData.recommendation?.toUpperCase() || "UNKNOWN"}
                  </span>
                )}
                {activeTabData.metricName && (
                  <span className="text-xs text-slate-500">
                    Based on: {activeTabData.metricName}
                  </span>
                )}
              </div>

              {/* Breakdown (for quality score) */}
              {activeTabData.id === "quality" && activeTabData.breakdown && (
                <AspectBreakdown breakdown={activeTabData.breakdown} />
              )}

              {/* Finalization Status */}
              {finalization.isScoringFinalized !== undefined && (
                <FinalizationStatus finalization={finalization} />
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-sm">Not enough data to calculate {activeTabData.label} score</div>
              {activeTabData.metricName && (
                <div className="text-xs text-slate-400 mt-2">Requires: {activeTabData.metricName}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AspectBreakdown({ breakdown }) {
  const aspects = [
    { key: "sopAdherence", label: "SOP & Timeline", icon: "📋" },
    { key: "productQuality", label: "Product Quality", icon: "⚙️" },
    { key: "featureDelivery", label: "Feature Delivery", icon: "📦" },
    { key: "automationReadiness", label: "Automation", icon: "🤖" },
  ];

  return (
    <div className="space-y-2 mt-4">
      {aspects.map((aspect) => {
        const data = breakdown[aspect.key];
        if (!data || data.value == null) return null;

        return (
          <div key={aspect.key} className="flex items-center justify-between p-2 bg-slate-50 rounded">
            <div className="flex items-center gap-2">
              <span>{aspect.icon}</span>
              <span className="text-sm text-slate-700">{aspect.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    data.value >= 80
                      ? "bg-green-500"
                      : data.value >= 60
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${data.value}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 w-10 text-right">{data.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinalizationStatus({ finalization }) {
  if (!finalization.isScoringFinalized) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Score in observation window.</strong> Finalizes in {finalization.daysRemaining}{" "}
        day{finalization.daysRemaining !== 1 ? "s" : ""} (
        {finalization.observationEndDate?.split("T")[0]}).
      </div>
    );
  }

  return (
    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
      <strong>✓ Score finalized.</strong> Locked on {new Date(finalization.frozenAt).toLocaleDateString()}.
    </div>
  );
}
