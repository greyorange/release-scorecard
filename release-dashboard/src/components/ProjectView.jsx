import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchProject, fetchHistory, syncProject, pdfUrl, fetchConfig } from "../api.js";
import { mockProjects } from "../data/mockData.js";
import ProjectHeader from "./ProjectHeader.jsx";
import ScoreRing from "./ScoreRing.jsx";
import MetricsGrid from "./MetricsGrid.jsx";
import ScoreBreakdown from "./ScoreBreakdown.jsx";
import HistoryChart from "./HistoryChart.jsx";
import RcaCapaGroups from "./RcaCapaGroups.jsx";
import TeamLearnings from "./TeamLearnings.jsx";
import JiraIssuesTable from "./JiraIssuesTable.jsx";
import BugClassification from "./BugClassification.jsx";
import SopCompliance from "./SopCompliance.jsx";
import LeakageAnalysis from "./LeakageAnalysis.jsx";
import FeatureDelivery from "./FeatureDelivery.jsx";
import ScoreTabs from "./ScoreTabs.jsx";
import StageBreakdown from "./StageBreakdown.jsx";

export default function ProjectView() {
  const { id } = useParams();
  const [release, setRelease] = useState(null);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState({ jiraBaseUrl: null });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  // PDF-export readiness — set true when the page has finished fetching
  // everything it'll show, so puppeteer waits for the JIRA + Stories
  // tables before snapshotting. Tracked as a Set so adding another lazy
  // table later doesn't require new state.
  const [readyTables, setReadyTables] = useState(() => new Set());
  const markReady = (key) =>
    setReadyTables((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  const expectedTables = [];
  if ((release?.jiraIds?.length || 0) > 0) expectedTables.push("issues");
  if ((release?.storyIds?.length || 0) > 0) expectedTables.push("stories");
  const pageReady =
    Boolean(release) && expectedTables.every((k) => readyTables.has(k));

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__pdfReady = pageReady;
    }
  }, [pageReady]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRelease(null);
    setReadyTables(new Set());
    if (typeof window !== "undefined") window.__pdfReady = false;
    (async () => {
      try {
        const [proj, hist, cfg] = await Promise.all([
          fetchProject(id),
          fetchHistory(id),
          fetchConfig().catch(() => ({ jiraBaseUrl: null })),
        ]);
        if (cancelled) return;
        setRelease(proj);
        setHistory(hist.history || []);
        setConfig(cfg);
      } catch (err) {
        if (cancelled) return;
        const fallback = mockProjects.find((p) => p.id === id) || mockProjects[0];
        setRelease(fallback);
        setError("API unreachable — showing mock data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const updated = await syncProject(id);
      setRelease(updated);
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    window.open(pdfUrl(id), "_blank");
  };

  if (!release) {
    return <div className="text-slate-500">Loading release…</div>;
  }

  const score = release.scorecard?.score ?? null;
  const rec = release.scorecard?.recommendation;

  return (
    <div className="space-y-6">
      <ProjectHeader
        release={release}
        onSync={handleSync}
        onExport={handleExport}
        syncing={syncing}
      />

      {error && (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card flex flex-col items-center justify-center">
          <ScoreRing score={score} recommendation={rec} />
          {release.scorecard?.rationale && (
            <p className="mt-3 text-xs text-center text-slate-500">
              {release.scorecard.rationale}
            </p>
          )}
        </div>
        <BugClassification data={release.bugClassification} />
      </section>

      <ScoreTabs scorecard={release.scorecard} />

      <MetricsGrid release={release} />

      {release.sopCompliance && (
        <SopCompliance sopCompliance={release.sopCompliance} />
      )}

      <FeatureDelivery
        requirements={release.requirements}
        featureScore={release.scorecard?.qualityDimensions?.featureDelivery}
      />

      <section className="grid lg:grid-cols-2 gap-4">
        <ScoreBreakdown scorecard={release.scorecard} />
        <LeakageAnalysis stages={release.stages} leakageMetrics={release.leakageMetrics} />
      </section>

      <StageBreakdown stages={release.stages} />

      {history.length > 1 && <HistoryChart history={history} />}

      {release.jiraIds?.length > 0 && (
        <JiraIssuesTable
          ids={release.jiraIds.map((j) => (typeof j === "string" ? j : j.id))}
          jiraBaseUrl={config.jiraBaseUrl}
          onLoaded={() => markReady("issues")}
        />
      )}

      <section>
        <h3 className="section-title">RCA &amp; CAPA</h3>
        {release.issues?.length ? (
          <RcaCapaGroups issues={release.issues} jiraBaseUrl={config.jiraBaseUrl} />
        ) : (
          <div className="card text-sm text-slate-500">No issues logged.</div>
        )}
      </section>

      <section>
        <h3 className="section-title">Team Learnings</h3>
        <TeamLearnings learnings={release.teamLearnings} />
      </section>

      {release.storyIds?.length > 0 && (
        <JiraIssuesTable
          ids={release.storyIds.map((j) => (typeof j === "string" ? j : j.id))}
          jiraBaseUrl={config.jiraBaseUrl}
          onLoaded={() => markReady("stories")}
          title="CAPA Actions"
        />
      )}
    </div>
  );
}
